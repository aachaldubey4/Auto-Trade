namespace AutoTrade.Domain.Models;

// ─── Requests (what the frontend sends) ───────────────────────────────────────

/// <summary>Data sent when a new user registers</summary>
public class RegisterRequest
{
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string ConfirmPassword { get; set; } = string.Empty;
}

/// <summary>Data sent when a user logs in</summary>
public class LoginRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

// ─── Responses (what the backend returns) ─────────────────────────────────────

/// <summary>
/// Returned by /api/auth/login and /api/auth/refresh.
/// AccessToken goes in the JSON body.
/// RefreshToken goes in an httpOnly cookie (set by AuthController, NOT in this response).
/// </summary>
public class AuthResponse
{
    public bool Success { get; set; }

    /// <summary>
    /// Short-lived JWT (15 min).
    /// Frontend stores this in localStorage and attaches it to every API call
    /// as "Authorization: Bearer {AccessToken}"
    /// </summary>
    public string? AccessToken { get; set; }

    /// <summary>Error message if Success = false</summary>
    public string? Error { get; set; }

    /// <summary>Basic user info to display in the UI (name, email, role)</summary>
    public UserInfo? User { get; set; }

    // Internal: controller reads this to set the httpOnly cookie, then clears it
    [System.Text.Json.Serialization.JsonIgnore]
    public string? RefreshToken { get; set; }
}

/// <summary>Safe user info — no password hash, no refresh tokens</summary>
public class UserInfo
{
    public string Id { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
}
