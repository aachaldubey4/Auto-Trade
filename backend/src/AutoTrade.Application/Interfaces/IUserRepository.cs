using AutoTrade.Domain.Models;

namespace AutoTrade.Application.Interfaces;

/// <summary>
/// Repository interface for user database operations.
/// The Infrastructure layer implements this using MongoDB.
/// </summary>
public interface IUserRepository
{
    /// <summary>Find a user by email (case-insensitive). Returns null if not found.</summary>
    Task<UserDocument?> FindByEmailAsync(string email);

    /// <summary>Find a user by their refresh token. Returns null if not found or token is invalid.</summary>
    Task<UserDocument?> FindByRefreshTokenAsync(string refreshToken);

    /// <summary>Create a new user. Throws if email already exists (MongoDB unique index).</summary>
    Task<UserDocument> CreateAsync(UserDocument user);

    /// <summary>
    /// Update the refresh token for a user.
    /// Pass null values to clear the token (used on logout).
    /// </summary>
    Task UpdateRefreshTokenAsync(string userId, string? refreshToken, DateTime? expiresAt);
}
