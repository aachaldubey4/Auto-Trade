using AutoTrade.Domain.Models;

namespace AutoTrade.Application.Interfaces;

/// <summary>
/// Interface for authentication logic: register, login, token refresh, and logout.
/// The Infrastructure layer implements this with BCrypt + JWT.
/// </summary>
public interface IAuthService
{
    /// <summary>Register a new user. Hashes password with BCrypt. Returns error if email already used.</summary>
    Task<AuthResponse> RegisterAsync(RegisterRequest request);

    /// <summary>
    /// Authenticate a user. Verifies BCrypt hash.
    /// On success, returns an Access Token in the response body
    /// and a Refresh Token in AuthResponse.RefreshToken (the controller sets this as a cookie).
    /// </summary>
    Task<AuthResponse> LoginAsync(LoginRequest request);

    /// <summary>
    /// Use a refresh token to get a new access token.
    /// The refresh token is rotated (new one issued each time).
    /// Returns error if the token is invalid or expired.
    /// </summary>
    Task<AuthResponse> RefreshTokenAsync(string refreshToken);

    /// <summary>
    /// Invalidate the user's refresh token server-side.
    /// Even if someone stole the refresh token, it won't work after this.
    /// </summary>
    Task LogoutAsync(string userId);

    /// <summary>Generate a signed JWT access token for the given user. Used internally by Login and Refresh.</summary>
    string GenerateAccessToken(UserDocument user);
}
