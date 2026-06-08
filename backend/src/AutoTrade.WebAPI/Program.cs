using AutoTrade.Infrastructure.Data;
using AutoTrade.Domain.Models;
using AutoTrade.Application.Interfaces;
using AutoTrade.Infrastructure.Services;
using AutoTrade.Infrastructure.Services.SignalGeneration;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers()
    .AddJsonOptions(opts =>
        opts.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter()));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new()
    {
        Title = "AutoTrade News API",
        Version = "v1",
        Description = "Indian financial news aggregation and sentiment analysis API"
    });
});

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://localhost:3000") // React dev server
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Add HttpClient factory for dependency injection
builder.Services.AddHttpClient();

// Add Memory Cache for market data
builder.Services.AddMemoryCache();

// Add MongoDB context
builder.Services.AddSingleton<MongoDbContext>();

// Add Trading Signals Configuration
var tradingSignalsConfig = builder.Configuration.GetSection("TradingSignals").Get<TradingSignalsConfig>() 
    ?? new TradingSignalsConfig();
builder.Services.AddSingleton(tradingSignalsConfig);

// Add News Processing Services
builder.Services.AddSingleton<ILoughranMcDonaldAnalyzer, LoughranMcDonaldAnalyzer>();
builder.Services.AddSingleton<IHeadlineHeuristicAnalyzer, HeadlineHeuristicAnalyzer>();
builder.Services.AddSingleton<ISentimentAnalyzer, SentimentAnalyzer>();
builder.Services.AddSingleton<INewsAggregator, NewsAggregator>();
builder.Services.AddSingleton<IStockMatcher, AhoCorasickStockMatcher>();
builder.Services.AddSingleton<IStockMapper, StockMapper>();
builder.Services.AddSingleton<IArticleStorageService, ArticleStorageService>();
builder.Services.AddSingleton<INewsProcessingService, NewsProcessingService>();

// NSE Stock Refresh — seeds DB on startup and refreshes daily
builder.Services.AddSingleton<INseStockRefreshService, NseStockRefreshService>();
builder.Services.AddHostedService(sp => (NseStockRefreshService)sp.GetRequiredService<INseStockRefreshService>());

// Add Signal Generation Services
builder.Services.AddScoped<IMarketDataProvider, MarketDataProvider>();
builder.Services.AddScoped<ITechnicalAnalyzer, TechnicalAnalyzer>();
builder.Services.AddScoped<ISentimentProvider, SentimentProvider>();
builder.Services.AddScoped<IRiskManager, RiskManager>();
builder.Services.AddSingleton<IWatchlistManager, WatchlistManager>();
builder.Services.AddScoped<ISignalStorage, SignalStorage>();
builder.Services.AddScoped<ISignalGenerator, SignalGenerator>();

// Add Signal Scheduler as Hosted Service
builder.Services.AddHostedService<SignalSchedulerService>();

// ─── JWT Authentication ───────────────────────────────────────────────────────
// This validates the JWT token on every protected request.
// Order matters: AddAuthentication → AddJwtBearer (validation config)
var jwtSecret = builder.Configuration["Jwt:Secret"]
    ?? throw new InvalidOperationException("Jwt:Secret is required in appsettings.json");

builder.Services.AddAuthentication(options =>
{
    // Tell ASP.NET Core to use JWT Bearer as the default scheme
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        // WHAT TO VALIDATE in every incoming JWT:
        ValidateIssuer = true,              // Check the 'iss' claim = "AutoTrade"
        ValidateAudience = true,            // Check the 'aud' claim = "AutoTradeClient"
        ValidateLifetime = true,            // Reject tokens past their 'exp' claim
        ValidateIssuerSigningKey = true,    // Verify the signature with our secret key

        ValidIssuer = "AutoTrade",
        ValidAudience = "AutoTradeClient",
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),

        // No extra time after expiry — expired = invalid immediately
        ClockSkew = TimeSpan.Zero
    };
});

builder.Services.AddAuthorization();

// ─── Auth Services ────────────────────────────────────────────────────────────
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IAuthService, AuthService>();

// Add logging
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.AddDebug();

var app = builder.Build();

// Load trading configuration from MongoDB on startup:
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<MongoDbContext>();
    var activeConfig = scope.ServiceProvider.GetRequiredService<TradingSignalsConfig>();
    try
    {
        var savedConfig = dbContext.LoadTradingSignalsConfigAsync().GetAwaiter().GetResult();
        if (savedConfig != null)
        {
            CopyConfigProperties(savedConfig, activeConfig);
            app.Logger.LogInformation("Loaded custom trading signals configuration from MongoDB settings");
        }
        else
        {
            dbContext.SaveTradingSignalsConfigAsync(activeConfig).GetAwaiter().GetResult();
            app.Logger.LogInformation("Seeded default trading signals configuration to MongoDB settings");
        }
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Failed to load/seed trading signals configuration on startup");
    }
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "AutoTrade News API v1");
        c.RoutePrefix = "swagger"; // Set Swagger UI at /swagger
        c.DocumentTitle = "AutoTrade API Documentation";
        c.DefaultModelsExpandDepth(-1); // Hide models section by default
        c.DisplayRequestDuration();
    });
}

app.UseCors("AllowFrontend");

// Authentication: validates JWT from "Authorization: Bearer ..." header
// MUST come before UseAuthorization()
app.UseAuthentication();

// Authorization: enforces [Authorize] attributes on controllers/actions
app.UseAuthorization();

app.MapControllers();

// Start news processing in background so app.Run() isn't blocked by initial RSS fetch.
var newsProcessingService = app.Services.GetService<INewsProcessingService>();
if (newsProcessingService != null)
{
    var startupLogger = app.Services.GetRequiredService<ILogger<Program>>();
    _ = Task.Run(async () =>
    {
        try
        {
            await newsProcessingService.StartProcessingAsync();
        }
        catch (Exception ex)
        {
            startupLogger.LogError(ex, "Failed to start news processing service");
        }
    });

    var lifetime = app.Services.GetRequiredService<IHostApplicationLifetime>();
    lifetime.ApplicationStopping.Register(() =>
    {
        try { newsProcessingService.StopProcessingAsync().GetAwaiter().GetResult(); }
        catch (Exception ex) { startupLogger.LogError(ex, "Error stopping news processing service"); }
    });
}

app.Run();

void CopyConfigProperties(TradingSignalsConfig source, TradingSignalsConfig target)
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