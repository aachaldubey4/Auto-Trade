using AutoTrade.Application.Interfaces;
using AutoTrade.Domain.Models;
using AutoTrade.Infrastructure.Data;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace AutoTrade.Infrastructure.Services;

/// <summary>
/// MongoDB implementation of IUserRepository.
/// All email lookups are case-insensitive (emails stored as lowercase).
/// </summary>
public class UserRepository(
    MongoDbContext dbContext,
    ILogger<UserRepository> logger) : IUserRepository
{
    public async Task<UserDocument?> FindByEmailAsync(string email)
    {
        // Email is stored lowercase → normalize before search
        var normalized = email.ToLowerInvariant().Trim();
        return await dbContext.Users
            .Find(u => u.Email == normalized)
            .FirstOrDefaultAsync();
    }

    public async Task<UserDocument?> FindByRefreshTokenAsync(string refreshToken)
    {
        // Called when frontend hits POST /api/auth/refresh
        // We look up who owns this token and check its expiry
        return await dbContext.Users
            .Find(u => u.RefreshToken == refreshToken)
            .FirstOrDefaultAsync();
    }

    public async Task<UserDocument> CreateAsync(UserDocument user)
    {
        await dbContext.Users.InsertOneAsync(user);
        logger.LogDebug("Created user document: {Email}", user.Email);
        return user;
    }

    public async Task UpdateRefreshTokenAsync(string userId, string? refreshToken, DateTime? expiresAt)
    {
        var update = Builders<UserDocument>.Update
            .Set(u => u.RefreshToken, refreshToken)
            .Set(u => u.RefreshTokenExpiresAt, expiresAt);

        await dbContext.Users.UpdateOneAsync(u => u.Id == userId, update);
    }
}
