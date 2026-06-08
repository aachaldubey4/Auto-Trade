using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace AutoTrade.Domain.Models;

/// <summary>
/// MongoDB document representing a registered user.
/// 
/// IMPORTANT: The real password is NEVER stored here.
/// We only store the BCrypt hash in PasswordHash.
/// Even if the DB is hacked, attacker cannot recover the password.
/// </summary>
public class UserDocument
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    /// <summary>Email address — stored lowercase, unique index in MongoDB</summary>
    public string Email { get; set; } = string.Empty;

    public string FullName { get; set; } = string.Empty;

    /// <summary>
    /// BCrypt hash of the password.
    /// Format: "$2a$12$saltBase64Hash..."
    /// The cost factor (12) and salt are embedded in the hash string.
    /// </summary>
    public string PasswordHash { get; set; } = string.Empty;

    /// <summary>"User" or "Admin" — used by [Authorize(Roles="Admin")]</summary>
    public string Role { get; set; } = "User";

    /// <summary>
    /// The active refresh token (random 64-byte base64 string).
    /// Stored so we can invalidate it on logout.
    /// Set to null on logout.
    /// </summary>
    public string? RefreshToken { get; set; }

    /// <summary>When the refresh token expires (typically 7 days from login)</summary>
    public DateTime? RefreshTokenExpiresAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>Set to false to disable an account without deleting it</summary>
    public bool IsActive { get; set; } = true;
}
