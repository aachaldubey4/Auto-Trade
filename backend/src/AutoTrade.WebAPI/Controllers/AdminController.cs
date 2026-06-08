using AutoTrade.Infrastructure.Data;
using AutoTrade.Domain.Models;
using AutoTrade.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using MongoDB.Bson;
using System.Diagnostics;

namespace AutoTrade.WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")] // Requires user to have 'Admin' role in JWT claims
public class AdminController(
    MongoDbContext db,
    INewsAggregator newsAggregator,
    TradingSignalsConfig config,
    ILogger<AdminController> logger) : ControllerBase
{
    private static readonly DateTime StartTime = DateTime.UtcNow;

    // ─── Stats Endpoint ──────────────────────────────────────────────────────
    [HttpGet("stats")]
    [ProducesResponseType(typeof(AdminStats), StatusCodes.Status200OK)]
    public async Task<ActionResult<AdminStats>> GetStats()
    {
        try
        {
            var cutoff14d = DateTime.UtcNow.AddDays(-14);

            // ── Fetch raw data ────────────────────────────────────────────────
            var totalUsers    = await db.Users.CountDocumentsAsync(new BsonDocument());
            var activeUsers   = await db.Users.CountDocumentsAsync(
                Builders<UserDocument>.Filter.Eq(u => u.IsActive, true));
            var totalArticles = await db.Articles.CountDocumentsAsync(new BsonDocument());
            var totalStocks   = await db.Stocks.CountDocumentsAsync(new BsonDocument());

            // Fetch all signals projected to fields we need (lightweight)
            var allSignals = await db.Signals
                .Find(new BsonDocument())
                .Project(Builders<SignalDocument>.Projection
                    .Include(s => s.Action)
                    .Include(s => s.Status)
                    .Include(s => s.Type)
                    .Include(s => s.Symbol)
                    .Include(s => s.EntryPrice)
                    .Include(s => s.TargetPrice)
                    .Include(s => s.GeneratedAt))
                .As<SignalDocument>()
                .ToListAsync();

            // Fetch users for time-series (last 14 days)
            var recentUsers = await db.Users
                .Find(Builders<UserDocument>.Filter.Gte(u => u.CreatedAt, cutoff14d))
                .Project(Builders<UserDocument>.Projection.Include(u => u.CreatedAt))
                .As<UserDocument>()
                .ToListAsync();

            // ── Signal breakdown ─────────────────────────────────────────────
            long buySignals       = allSignals.Count(s => s.Action == "BUY");
            long sellSignals      = allSignals.Count(s => s.Action == "SELL");
            long activeSignals    = allSignals.Count(s => s.Status == "active");
            long expiredSignals   = allSignals.Count(s => s.Status == "expired");
            long executedSignals  = allSignals.Count(s => s.Status == "executed");
            long intradaySignals  = allSignals.Count(s => s.Type == "Intraday" || s.Type == "1");
            long overnightSignals = allSignals.Count(s => s.Type == "Overnight" || s.Type == "0");

            // ── Estimated Profit (executed signals reaching target) ──────────
            var executed = allSignals.Where(s => s.Status == "executed").ToList();
            double estimatedProfitPercent = 0;
            if (executed.Count > 0)
            {
                estimatedProfitPercent = executed.Average(s =>
                {
                    if (s.EntryPrice == 0) return 0;
                    return s.Action == "BUY"
                        ? (double)((s.TargetPrice - s.EntryPrice) / s.EntryPrice * 100)
                        : (double)((s.EntryPrice - s.TargetPrice) / s.EntryPrice * 100);
                });
                estimatedProfitPercent = Math.Round(estimatedProfitPercent, 2);
            }

            // ── User growth per day (last 14 days) ───────────────────────────
            var userGrowth = recentUsers
                .GroupBy(u => u.CreatedAt.ToUniversalTime().ToString("yyyy-MM-dd"))
                .Select(g => new TimeSeriesPoint { Date = g.Key, Count = g.Count() })
                .OrderBy(x => x.Date)
                .ToList();

            // Fill missing dates in the 14-day window
            var filledUserGrowth = FillDateGaps(cutoff14d, DateTime.UtcNow, userGrowth);

            // ── Signals per day (last 14 days) ───────────────────────────────
            var recentSignals = allSignals.Where(s => s.GeneratedAt >= cutoff14d).ToList();
            var signalsPerDay = recentSignals
                .GroupBy(s => s.GeneratedAt.ToUniversalTime().ToString("yyyy-MM-dd"))
                .Select(g => new TimeSeriesPoint { Date = g.Key, Count = g.Count() })
                .OrderBy(x => x.Date)
                .ToList();

            var filledSignalsPerDay = FillDateGaps(cutoff14d, DateTime.UtcNow, signalsPerDay);

            // ── Top symbols ──────────────────────────────────────────────────
            var topSymbols = allSignals
                .GroupBy(s => s.Symbol)
                .Select(g => new TopSymbolEntry
                {
                    Symbol    = g.Key,
                    Count     = g.Count(),
                    BuyCount  = g.Count(s => s.Action == "BUY"),
                    SellCount = g.Count(s => s.Action == "SELL"),
                })
                .OrderByDescending(x => x.Count)
                .Take(6)
                .ToList();

            // ── Health ───────────────────────────────────────────────────────
            var uptimeDuration = DateTime.UtcNow - StartTime;
            var healthStats = new SystemHealthStats
            {
                Uptime         = $"{(int)uptimeDuration.TotalDays}d {uptimeDuration.Hours}h {uptimeDuration.Minutes}m",
                MemoryUsageMB  = (GC.GetTotalMemory(false) / (1024.0 * 1024.0)).ToString("F2"),
                ProcessorCount = System.Environment.ProcessorCount,
                OperatingSystem = System.Environment.OSVersion.ToString(),
                Environment    = System.Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production"
            };

            var feedsStats = newsAggregator.GetFeedHealth().Select(f => new FeedStatusStats
            {
                Name           = f.Name,
                Url            = f.Url,
                IsHealthy      = f.IsHealthy,
                LastStatusCode = f.LastStatusCode,
                LastChecked    = f.LastChecked?.ToString("o") ?? "Never",
                LastError      = f.LastError ?? string.Empty
            }).ToList();

            var stats = new AdminStats
            {
                Database = new EnhancedDatabaseStats
                {
                    TotalUsers       = totalUsers,
                    ActiveUsers      = activeUsers,
                    TotalSignals     = allSignals.Count,
                    ExecutedSignals  = executedSignals,
                    TotalArticles    = totalArticles,
                    TotalStocks      = totalStocks,
                },
                SignalStats = new SignalStats
                {
                    BuySignals             = buySignals,
                    SellSignals            = sellSignals,
                    ActiveSignals          = activeSignals,
                    ExpiredSignals         = expiredSignals,
                    ExecutedSignals        = executedSignals,
                    IntradaySignals        = intradaySignals,
                    OvernightSignals       = overnightSignals,
                    EstimatedProfitPercent = estimatedProfitPercent,
                },
                Health        = healthStats,
                Feeds         = feedsStats,
                UserGrowth    = filledUserGrowth,
                SignalsPerDay = filledSignalsPerDay,
                TopSymbols    = topSymbols,
            };

            return Ok(stats);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error fetching admin statistics");
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>Fills missing dates with zero-count entries for a continuous chart.</summary>
    private static List<TimeSeriesPoint> FillDateGaps(DateTime from, DateTime to, List<TimeSeriesPoint> data)
    {
        var lookup = data.ToDictionary(x => x.Date, x => x.Count);
        var result = new List<TimeSeriesPoint>();
        for (var d = from.Date; d <= to.Date; d = d.AddDays(1))
        {
            var key = d.ToString("yyyy-MM-dd");
            result.Add(new TimeSeriesPoint { Date = key, Count = lookup.TryGetValue(key, out var c) ? c : 0 });
        }
        return result;
    }


    // ─── User Management Endpoints ──────────────────────────────────────────
    [HttpGet("users")]
    [ProducesResponseType(typeof(List<UserDocument>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<UserDocument>>> GetUsers()
    {
        try
        {
            // Fetch users but exclude password hash and refresh tokens for security
            var users = await db.Users.Find(new BsonDocument())
                .Project<UserDocument>(Builders<UserDocument>.Projection
                    .Exclude(u => u.PasswordHash)
                    .Exclude(u => u.RefreshToken))
                .ToListAsync();
            return Ok(users);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error fetching list of users");
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpPut("users/{userId}/status")]
    public async Task<IActionResult> ToggleUserStatus(string userId, [FromBody] bool isActive)
    {
        try
        {
            var update = Builders<UserDocument>.Update.Set(u => u.IsActive, isActive);
            var result = await db.Users.UpdateOneAsync(u => u.Id == userId, update);

            if (result.MatchedCount == 0)
                return NotFound("User not found");

            logger.LogInformation("Admin updated user {UserId} active status to {IsActive}", userId, isActive);
            return Ok(new { success = true, message = "User status updated successfully" });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error updating user active status");
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpPut("users/{userId}/role")]
    public async Task<IActionResult> UpdateUserRole(string userId, [FromBody] string role)
    {
        try
        {
            if (role != "User" && role != "Admin")
                return BadRequest("Invalid role specification. Must be 'User' or 'Admin'.");

            var update = Builders<UserDocument>.Update.Set(u => u.Role, role);
            var result = await db.Users.UpdateOneAsync(u => u.Id == userId, update);

            if (result.MatchedCount == 0)
                return NotFound("User not found");

            logger.LogInformation("Admin updated user {UserId} role to {Role}", userId, role);
            return Ok(new { success = true, message = "User role updated successfully" });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error updating user role");
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpDelete("users/{userId}")]
    public async Task<IActionResult> DeleteUser(string userId)
    {
        try
        {
            var result = await db.Users.DeleteOneAsync(u => u.Id == userId);
            if (result.DeletedCount == 0)
                return NotFound("User not found");

            logger.LogInformation("Admin deleted user account {UserId}", userId);
            return Ok(new { success = true, message = "User account deleted successfully" });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error deleting user account");
            return StatusCode(500, "Internal server error");
        }
    }

    // ─── Configuration Endpoints ─────────────────────────────────────────────
    [HttpGet("config")]
    [ProducesResponseType(typeof(TradingSignalsConfig), StatusCodes.Status200OK)]
    public IActionResult GetConfig()
    {
        return Ok(config);
    }

    [HttpPut("config")]
    public async Task<IActionResult> UpdateConfig([FromBody] TradingSignalsConfig newConfig)
    {
        try
        {
            if (newConfig == null)
                return BadRequest("Invalid configuration body");

            // Copy config properties to local active singleton
            CopyConfigProperties(newConfig, config);

            // Persist settings in settings collection
            await db.SaveTradingSignalsConfigAsync(config);

            logger.LogInformation("Admin updated and saved trading configuration");
            return Ok(new { success = true, message = "Trading signals configuration updated and saved successfully" });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error saving custom config settings");
            return StatusCode(500, "Internal server error");
        }
    }

    private static void CopyConfigProperties(TradingSignalsConfig source, TradingSignalsConfig target)
    {
        if (source == null || target == null) return;
        
        // SignalGeneration
        target.SignalGeneration.TechnicalWeight = source.SignalGeneration.TechnicalWeight;
        target.SignalGeneration.SentimentWeight = source.SignalGeneration.SentimentWeight;
        target.SignalGeneration.MinimumSignalStrength = source.SignalGeneration.MinimumSignalStrength;
        target.SignalGeneration.MaxParallelStocks = source.SignalGeneration.MaxParallelStocks;
        
        target.SignalGeneration.BuyConditions.MinSentiment = source.SignalGeneration.BuyConditions.MinSentiment;
        target.SignalGeneration.BuyConditions.RequirePriceAboveEma = source.SignalGeneration.BuyConditions.RequirePriceAboveEma;
        target.SignalGeneration.BuyConditions.RsiMin = source.SignalGeneration.BuyConditions.RsiMin;
        target.SignalGeneration.BuyConditions.RsiMax = source.SignalGeneration.BuyConditions.RsiMax;
        target.SignalGeneration.BuyConditions.RequireMacdBullish = source.SignalGeneration.BuyConditions.RequireMacdBullish;
        target.SignalGeneration.BuyConditions.MinVolumeRatio = source.SignalGeneration.BuyConditions.MinVolumeRatio;
        
        target.SignalGeneration.SellConditions.MaxSentiment = source.SignalGeneration.SellConditions.MaxSentiment;
        target.SignalGeneration.SellConditions.RequirePriceBelowEmaOrHighRsi = source.SignalGeneration.SellConditions.RequirePriceBelowEmaOrHighRsi;
        target.SignalGeneration.SellConditions.RsiOverbought = source.SignalGeneration.SellConditions.RsiOverbought;
        target.SignalGeneration.SellConditions.RequireMacdBearish = source.SignalGeneration.SellConditions.RequireMacdBearish;
        target.SignalGeneration.SellConditions.MinVolumeRatio = source.SignalGeneration.SellConditions.MinVolumeRatio;
        
        // RiskManagement
        target.RiskManagement.MaxConcurrentSignals = source.RiskManagement.MaxConcurrentSignals;
        target.RiskManagement.PositionSizePercent = source.RiskManagement.PositionSizePercent;
        target.RiskManagement.StopLossMinPercent = source.RiskManagement.StopLossMinPercent;
        target.RiskManagement.StopLossMaxPercent = source.RiskManagement.StopLossMaxPercent;
        target.RiskManagement.TargetMinPercent = source.RiskManagement.TargetMinPercent;
        target.RiskManagement.TargetMaxPercent = source.RiskManagement.TargetMaxPercent;
        target.RiskManagement.MinRiskRewardRatio = source.RiskManagement.MinRiskRewardRatio;
        target.RiskManagement.PreferredRiskRewardRatio = source.RiskManagement.PreferredRiskRewardRatio;
        target.RiskManagement.DuplicateSignalWindowHours = source.RiskManagement.DuplicateSignalWindowHours;
        
        // MarketData
        target.MarketData.PrimaryProvider = source.MarketData.PrimaryProvider;
        target.MarketData.FallbackProvider = source.MarketData.FallbackProvider;
        target.MarketData.CacheDurationMinutes = source.MarketData.CacheDurationMinutes;
        target.MarketData.NseApiUrl = source.MarketData.NseApiUrl;
        target.MarketData.MarketOpenTime = source.MarketData.MarketOpenTime;
        target.MarketData.MarketCloseTime = source.MarketData.MarketCloseTime;
        target.MarketData.Timezone = source.MarketData.Timezone;
        target.MarketData.ApiCallDelayMs = source.MarketData.ApiCallDelayMs;
        target.MarketData.NseQuoteRetries = source.MarketData.NseQuoteRetries;
        target.MarketData.YahooQuoteRetries = source.MarketData.YahooQuoteRetries;
        target.MarketData.YahooRetryDelayMs = source.MarketData.YahooRetryDelayMs;
        target.MarketData.BhavcopyCacheMinutes = source.MarketData.BhavcopyCacheMinutes;
        target.MarketData.QuoteFallbackMaxStalenessHours = source.MarketData.QuoteFallbackMaxStalenessHours;
        target.MarketData.WatchlistQuoteParallelism = source.MarketData.WatchlistQuoteParallelism;
        target.MarketData.UseSyntheticFallback = source.MarketData.UseSyntheticFallback;
        
        // Watchlist
        target.Watchlist.MaxStocks = source.Watchlist.MaxStocks;
        target.Watchlist.DefaultStocks = source.Watchlist.DefaultStocks;
        
        // Scheduling
        target.Scheduling.OvernightAnalysisTime = source.Scheduling.OvernightAnalysisTime;
        target.Scheduling.IntradayAnalysisIntervalMinutes = source.Scheduling.IntradayAnalysisIntervalMinutes;
        target.Scheduling.MarketDataRefreshIntervalMinutes = source.Scheduling.MarketDataRefreshIntervalMinutes;
        target.Scheduling.OvernightSignalExpiryTime = source.Scheduling.OvernightSignalExpiryTime;
        target.Scheduling.IntradaySignalDurationHoursMin = source.Scheduling.IntradaySignalDurationHoursMin;
        target.Scheduling.IntradaySignalDurationHoursMax = source.Scheduling.IntradaySignalDurationHoursMax;
    }
}
