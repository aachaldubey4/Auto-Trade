using AutoTrade.Application.Interfaces;
using AutoTrade.Domain.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AutoTrade.WebAPI.Controllers;

/// <summary>
/// Authentication endpoints — all public (no JWT required to login/register!).
///
/// Routes:
///   POST /api/auth/register  → create account
///   POST /api/auth/login     → get tokens
///   POST /api/auth/refresh   → exchange refresh token for new access token
///   POST /api/auth/logout    → invalidate refresh token
///   GET  /api/auth/me        → get current user info (requires login)
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class AuthController(
    IAuthService authService,
    ILogger<AuthController> logger) : ControllerBase
{
    // Name of the cookie that holds the refresh token
    private const string RefreshTokenCookieName = "refreshToken";

    // Cookie options — same across all auth endpoints
    private static CookieOptions RefreshCookieOptions(int daysExpiry) => new()
    {
        HttpOnly = true,            // JavaScript CANNOT read this cookie → prevents XSS
        Secure = false,             // Set to true in production (requires HTTPS)
        SameSite = SameSiteMode.Strict, // Cookie only sent on same-origin requests → prevents CSRF
        Expires = DateTimeOffset.UtcNow.AddDays(daysExpiry)
    };

    // ─── Register ─────────────────────────────────────────────────────────────

    /// <summary>
    /// Create a new user account.
    /// [AllowAnonymous] means no JWT required — anyone can call this.
    /// </summary>
    [HttpPost("register")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<AuthResponse>> Register([FromBody] RegisterRequest request)
    {
        var result = await authService.RegisterAsync(request);

        if (!result.Success)
            return BadRequest(result);

        logger.LogInformation("Registration successful for {Email}", request.Email);
        return Ok(result);
    }

    // ─── Login ────────────────────────────────────────────────────────────────

    /// <summary>
    /// Login with email and password.
    /// Returns:
    ///   - Access Token in JSON body (frontend stores in localStorage)
    ///   - Refresh Token in httpOnly cookie (browser stores, JS cannot read)
    /// </summary>
    [HttpPost("login")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest request)
    {
        var result = await authService.LoginAsync(request);

        if (!result.Success)
            return Unauthorized(result);

        // Set refresh token as an httpOnly cookie
        // The frontend JavaScript CANNOT read this (httpOnly = true)
        // The browser sends it automatically on requests to the same domain
        if (result.RefreshToken != null)
        {
            Response.Cookies.Append(
                RefreshTokenCookieName,
                result.RefreshToken,
                RefreshCookieOptions(7));

            // Clear it from the response body — it should ONLY be in the cookie
            result.RefreshToken = null;
        }

        logger.LogInformation("Login successful for {Email}", request.Email);
        return Ok(result);
    }

    // ─── Refresh Token ────────────────────────────────────────────────────────

    /// <summary>
    /// Exchange a refresh token for a new access token.
    /// The browser sends the refreshToken cookie automatically (httpOnly).
    /// Frontend calls this when it gets a 401 response on any API call.
    /// </summary>
    [HttpPost("refresh")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AuthResponse>> Refresh()
    {
        // Read refresh token from the httpOnly cookie
        // (browser sends it automatically — frontend doesn't need to do anything special)
        var refreshToken = Request.Cookies[RefreshTokenCookieName];

        if (string.IsNullOrEmpty(refreshToken))
            return Unauthorized(new AuthResponse { Success = false, Error = "No refresh token provided" });

        var result = await authService.RefreshTokenAsync(refreshToken);

        if (!result.Success)
        {
            // Invalid or expired token — clear the cookie
            Response.Cookies.Delete(RefreshTokenCookieName);
            return Unauthorized(result);
        }

        // Update the cookie with the new (rotated) refresh token
        if (result.RefreshToken != null)
        {
            Response.Cookies.Append(
                RefreshTokenCookieName,
                result.RefreshToken,
                RefreshCookieOptions(7));

            result.RefreshToken = null;
        }

        return Ok(result);
    }

    // ─── Logout ───────────────────────────────────────────────────────────────

    /// <summary>
    /// Logout the current user.
    /// [Authorize] requires a valid JWT — must be logged in to logout.
    /// Clears refresh token from DB and deletes the cookie.
    /// </summary>
    [HttpPost("logout")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Logout()
    {
        // Read userId from the JWT claims (set by JWT middleware)
        var userId = User.FindFirst("userId")?.Value;

        if (!string.IsNullOrEmpty(userId))
            await authService.LogoutAsync(userId);

        // Delete the refresh token cookie
        Response.Cookies.Delete(RefreshTokenCookieName);

        return Ok(new { success = true, message = "Logged out successfully" });
    }

    // ─── Me ───────────────────────────────────────────────────────────────────

    /// <summary>
    /// Get the currently authenticated user's info.
    /// Useful for the frontend to restore user state after a page refresh.
    /// </summary>
    [HttpGet("me")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public IActionResult Me()
    {
        // Read claims that were embedded in the JWT when it was generated
        var userId = User.FindFirst("userId")?.Value;
        var email = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                 ?? User.FindFirst("sub")?.Value;
        var role = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;
        var fullName = User.FindFirst("fullName")?.Value;

        return Ok(new
        {
            success = true,
            user = new
            {
                id = userId,
                email,
                role,
                fullName
            }
        });
    }
}
