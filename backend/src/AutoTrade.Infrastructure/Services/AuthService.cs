using AutoTrade.Application.Interfaces;
using AutoTrade.Domain.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace AutoTrade.Infrastructure.Services;

/// <summary>
/// Core authentication service.
///
/// HOW IT WORKS:
///
/// REGISTER:
///   1. Validate inputs (email format, password length, passwords match)
///   2. Check email not already in use
///   3. BCrypt.HashPassword("mySecret123") → "$2a$12$randomSalt...hashedValue"
///   4. Save UserDocument to MongoDB (password hash, NOT the real password)
///
/// LOGIN:
///   1. Find user by email
///   2. BCrypt.Verify("mySecret123", storedHash) → true/false
///   3. If valid: generate Access Token (JWT, 15 min) + Refresh Token (random, 7 days)
///   4. Save Refresh Token to MongoDB so we can invalidate on logout
///   5. Return both tokens (controller will put refresh in httpOnly cookie)
///
/// REFRESH:
///   1. Find user by refresh token in MongoDB
///   2. Check if refresh token expired
///   3. Issue new Access Token + rotate Refresh Token
///
/// LOGOUT:
///   1. Clear refresh token from MongoDB → now invalid even if someone stole it
/// </summary>
public class AuthService(
    IUserRepository userRepository,
    IConfiguration configuration,
    ILogger<AuthService> logger) : IAuthService
{
    // Read JWT settings from appsettings.json
    private string JwtSecret => configuration["Jwt:Secret"]
        ?? throw new InvalidOperationException("Jwt:Secret is required in appsettings.json");

    private int AccessTokenMinutes =>
        configuration.GetValue("Jwt:AccessTokenExpiryMinutes", 15);

    private int RefreshTokenDays =>
        configuration.GetValue("Jwt:RefreshTokenExpiryDays", 7);

    // ─── Register ─────────────────────────────────────────────────────────────

    public async Task<AuthResponse> RegisterAsync(RegisterRequest request)
    {
        // Input validation
        if (string.IsNullOrWhiteSpace(request.Email) || !request.Email.Contains('@'))
            return Fail("Please enter a valid email address");

        if (string.IsNullOrWhiteSpace(request.FullName))
            return Fail("Full name is required");

        if (request.Password.Length < 8)
            return Fail("Password must be at least 8 characters");

        if (request.Password != request.ConfirmPassword)
            return Fail("Passwords do not match");

        // Check if email is already registered
        var existing = await userRepository.FindByEmailAsync(request.Email);
        if (existing != null)
            return Fail("An account with this email already exists");

        // Hash the password with BCrypt
        // workFactor 12 = ~250ms per hash — intentionally slow to resist brute-force
        // BCrypt also generates a random salt internally, embedded in the hash string
        var passwordHash = BCrypt.Net.BCrypt.HashPassword(request.Password, workFactor: 12);

        var user = new UserDocument
        {
            Email = request.Email.ToLowerInvariant().Trim(),
            FullName = request.FullName.Trim(),
            PasswordHash = passwordHash,
            Role = "User",
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };

        await userRepository.CreateAsync(user);
        logger.LogInformation("User registered: {Email}", user.Email);

        return new AuthResponse
        {
            Success = true,
            User = ToUserInfo(user)
            // No token on register — user must explicitly login
        };
    }

    // ─── Login ────────────────────────────────────────────────────────────────

    public async Task<AuthResponse> LoginAsync(LoginRequest request)
    {
        var user = await userRepository.FindByEmailAsync(request.Email);

        // SECURITY: Use the SAME error message for wrong email AND wrong password.
        // If we said "email not found" or "wrong password" separately,
        // attackers could enumerate which emails are registered.
        if (user == null)
            return Fail("Invalid email or password");

        // BCrypt.Verify re-hashes the provided password with the stored salt
        // and compares to the stored hash
        var passwordValid = BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash);
        if (!passwordValid)
            return Fail("Invalid email or password");

        if (!user.IsActive)
            return Fail("Your account has been disabled. Please contact support.");

        // Generate tokens
        var accessToken = GenerateAccessToken(user);           // JWT, short-lived
        var refreshToken = GenerateRefreshToken();             // Random bytes, long-lived

        // Save refresh token to DB so we can verify + invalidate it later
        var refreshExpiry = DateTime.UtcNow.AddDays(RefreshTokenDays);
        await userRepository.UpdateRefreshTokenAsync(user.Id, refreshToken, refreshExpiry);

        logger.LogInformation("User logged in: {Email}", user.Email);

        return new AuthResponse
        {
            Success = true,
            AccessToken = accessToken,
            RefreshToken = refreshToken,   // Controller will set this as httpOnly cookie
            User = ToUserInfo(user)
        };
    }

    // ─── Refresh Token ────────────────────────────────────────────────────────

    public async Task<AuthResponse> RefreshTokenAsync(string refreshToken)
    {
        // Look up the user who owns this refresh token
        var user = await userRepository.FindByRefreshTokenAsync(refreshToken);
        if (user == null)
            return Fail("Invalid refresh token");

        // Check if the refresh token has expired
        if (user.RefreshTokenExpiresAt < DateTime.UtcNow)
        {
            // Clear expired token from DB
            await userRepository.UpdateRefreshTokenAsync(user.Id, null, null);
            return Fail("Your session has expired. Please login again.");
        }

        // Issue a new access token
        var newAccessToken = GenerateAccessToken(user);

        // TOKEN ROTATION: issue a brand new refresh token every time it's used.
        // This means if someone steals the refresh token and uses it,
        // the original user's next refresh will fail (token mismatch) — detectable!
        var newRefreshToken = GenerateRefreshToken();
        await userRepository.UpdateRefreshTokenAsync(
            user.Id, newRefreshToken, DateTime.UtcNow.AddDays(RefreshTokenDays));

        return new AuthResponse
        {
            Success = true,
            AccessToken = newAccessToken,
            RefreshToken = newRefreshToken,  // Controller updates the cookie
            User = ToUserInfo(user)
        };
    }

    // ─── Logout ───────────────────────────────────────────────────────────────

    public async Task LogoutAsync(string userId)
    {
        // Clear the refresh token from DB.
        // Even if someone stole the token, it no longer works.
        await userRepository.UpdateRefreshTokenAsync(userId, null, null);
        logger.LogInformation("User logged out: {UserId}", userId);
    }

    // ─── Token Generation ─────────────────────────────────────────────────────

    /// <summary>
    /// Creates a signed JWT token.
    ///
    /// The token contains CLAIMS (embedded user info):
    ///   - sub:    email address (standard JWT subject claim)
    ///   - userId: MongoDB ObjectId
    ///   - role:   "User" or "Admin" (enables [Authorize(Roles="Admin")])
    ///   - jti:    unique token ID (can be used for token blacklisting)
    ///
    /// The token is signed with HMAC-SHA256 using the Jwt:Secret.
    /// If anyone tampers with the payload, the signature breaks.
    /// The server validates the signature on every request.
    /// </summary>
    public string GenerateAccessToken(UserDocument user)
    {
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Email),
            new Claim("userId", user.Id),
            new Claim("fullName", user.FullName),
            new Claim(ClaimTypes.Role, user.Role),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var keyBytes = Encoding.UTF8.GetBytes(JwtSecret);
        var key = new SymmetricSecurityKey(keyBytes);
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: "AutoTrade",
            audience: "AutoTradeClient",
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: DateTime.UtcNow.AddMinutes(AccessTokenMinutes),
            signingCredentials: credentials
        );

        // Serializes to: "header.payload.signature" (the familiar JWT string)
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    /// <summary>
    /// Creates a cryptographically secure random refresh token.
    /// This is NOT a JWT — it's just a random opaque string.
    /// We store it in MongoDB and use it as a lookup key.
    /// </summary>
    private static string GenerateRefreshToken()
    {
        var bytes = new byte[64];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(bytes);
        return Convert.ToBase64String(bytes);
        // Result: a ~88-character base64 string, e.g., "xK3m+N9p2...XQa="
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private static AuthResponse Fail(string error) =>
        new() { Success = false, Error = error };

    private static UserInfo ToUserInfo(UserDocument u) => new()
    {
        Id = u.Id,
        Email = u.Email,
        FullName = u.FullName,
        Role = u.Role
    };
}
