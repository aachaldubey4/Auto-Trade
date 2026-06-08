# Design Document: Trading Signal Generation System

## Overview

The Trading Signal Generation System is a sophisticated trading signal engine that combines news sentiment analysis with technical indicators to generate high-confidence BUY/SELL trading signals for NSE stocks. The system operates on two schedules: overnight analysis at 8 PM IST for next-day positions, and intraday monitoring every 15 minutes during market hours (9:15 AM - 3:30 PM IST).

The system integrates with the existing TrendRadar news integration to leverage sentiment scores, fetches market data from NSE India API (with Yahoo Finance fallback), calculates technical indicators (EMA-20, RSI-14, MACD, Volume), and enforces strict risk management rules to ensure disciplined trading with maximum 8 concurrent positions.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend (React)                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  SignalsPanel Component (Real-time Signal Display)       │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │ HTTP/REST
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  ASP.NET Core Web API                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  SignalsController (REST Endpoints)                      │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              Signal Generation Engine (Core Logic)               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │ Signal Generator │  │ Technical        │  │ Risk Manager │ │
│  │                  │  │ Analyzer         │  │              │ │
│  └──────────────────┘  └──────────────────┘  └──────────────┘ │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │ Market Data      │  │ Watchlist        │  │ Scheduler    │ │
│  │ Provider         │  │ Manager          │  │ (Background) │ │
│  └──────────────────┘  └──────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Data Layer                                    │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │ Signal Storage   │  │ News Sentiment   │  │ Config Store │ │
│  │ (MongoDB)        │  │ (MongoDB)        │  │ (appsettings)│ │
│  └──────────────────┘  └──────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  External Services                               │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │ NSE India API    │  │ Yahoo Finance    │                    │
│  │ (Primary)        │  │ (Fallback)       │                    │
│  └──────────────────┘  └──────────────────┘                    │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

**SignalsController**: REST API endpoints for signal retrieval and manual generation
**SignalGenerator**: Core orchestrator that combines technical and sentiment analysis
**TechnicalAnalyzer**: Calculates EMA, RSI, MACD, and volume indicators
**RiskManager**: Enforces risk rules (max positions, stop-loss, duplicates)
**MarketDataProvider**: Fetches real-time and historical data with caching
**WatchlistManager**: Manages configurable stock list with priorities
**Scheduler**: Background service using IHostedService for timed jobs
**SignalStorage**: MongoDB repository for signal persistence

## Components and Interfaces

### 1. Market Data Provider

**Purpose**: Fetch and cache market data from NSE India API with Yahoo Finance fallback.

**Interface**:
```csharp
public interface IMarketDataProvider
{
    Task<MarketQuote> GetCurrentQuoteAsync(string symbol);
    Task<List<OhlcData>> GetHistoricalDataAsync(string symbol, int days);
    Task<bool> IsMarketOpenAsync();
    Task<bool> IsMarketHolidayAsync(DateTime date);
}

public class MarketQuote
{
    public string Symbol { get; set; }
    public decimal LastPrice { get; set; }
    public decimal Open { get; set; }
    public decimal High { get; set; }
    public decimal Low { get; set; }
    public decimal Close { get; set; }
    public long Volume { get; set; }
    public DateTime Timestamp { get; set; }
}

public class OhlcData
{
    public DateTime Date { get; set; }
    public decimal Open { get; set; }
    public decimal High { get; set; }
    public decimal Low { get; set; }
    public decimal Close { get; set; }
    public long Volume { get; set; }
}
```

**Implementation Details**:
- Use HttpClient to call NSE India API endpoints
- Implement circuit breaker pattern for fallback to Yahoo Finance
- Cache market quotes for 1 minute using IMemoryCache
- Market hours detection: Check if current time is between 9:15 AM - 3:30 PM IST on weekdays
- Holiday detection: Maintain a list of NSE holidays or check API response

**NSE India API Endpoints**:
- Quote: `https://www.nseindia.com/api/quote-equity?symbol={SYMBOL}`
- Historical: `https://www.nseindia.com/api/historical/cm/equity?symbol={SYMBOL}&from={FROM}&to={TO}`

**Yahoo Finance Fallback**:
- Use YahooFinanceApi NuGet package
- Convert NSE symbols to Yahoo format (e.g., RELIANCE → RELIANCE.NS)

### 2. Technical Analyzer

**Purpose**: Calculate technical indicators from historical price data.

**Interface**:
```csharp
public interface ITechnicalAnalyzer
{
    Task<TechnicalIndicators> CalculateIndicatorsAsync(string symbol);
    decimal CalculateEma(List<decimal> prices, int period);
    decimal CalculateRsi(List<decimal> prices, int period);
    MacdResult CalculateMacd(List<decimal> prices);
    decimal CalculateVolumeRatio(List<OhlcData> data);
}

public class TechnicalIndicators
{
    public string Symbol { get; set; }
    public decimal Ema20 { get; set; }
    public decimal Rsi14 { get; set; }
    public MacdResult Macd { get; set; }
    public decimal VolumeRatio { get; set; }
    public decimal CurrentPrice { get; set; }
    public decimal TechnicalScore { get; set; } // 0-100
    public DateTime CalculatedAt { get; set; }
}

public class MacdResult
{
    public decimal MacdLine { get; set; }
    public decimal SignalLine { get; set; }
    public decimal Histogram { get; set; }
    public bool IsBullish => Histogram > 0;
}
```

**Implementation Details**:

**EMA Calculation** (Exponential Moving Average):
```
Multiplier = 2 / (Period + 1)
EMA_today = (Price_today × Multiplier) + (EMA_yesterday × (1 - Multiplier))
```
- For EMA-20: Period = 20, Multiplier = 2/21 ≈ 0.0952
- Initialize with SMA for first value

**RSI Calculation** (Relative Strength Index):
```
Average Gain = Sum of gains over period / Period
Average Loss = Sum of losses over period / Period
RS = Average Gain / Average Loss
RSI = 100 - (100 / (1 + RS))
```
- For RSI-14: Period = 14
- Values range from 0 (oversold) to 100 (overbought)
- Typical thresholds: < 30 oversold, > 70 overbought

**MACD Calculation**:
```
MACD Line = EMA(12) - EMA(26)
Signal Line = EMA(9) of MACD Line
Histogram = MACD Line - Signal Line
```
- Bullish crossover: MACD Line crosses above Signal Line (Histogram > 0)
- Bearish crossover: MACD Line crosses below Signal Line (Histogram < 0)

**Volume Ratio**:
```
Volume Ratio = Current Volume / Average Volume (20 days)
```
- Ratio > 1.5 indicates high volume
- Ratio < 0.5 indicates low volume

**Technical Score Calculation**:
```
Score = (EMA_Score × 0.25) + (RSI_Score × 0.25) + (MACD_Score × 0.25) + (Volume_Score × 0.25)

EMA_Score:
  - Price > EMA-20: 100
  - Price < EMA-20: 0

RSI_Score:
  - RSI 30-70: 100
  - RSI < 30 or > 70: 50
  - RSI < 20 or > 80: 0

MACD_Score:
  - Bullish (Histogram > 0): 100
  - Bearish (Histogram < 0): 0

Volume_Score:
  - Volume Ratio > 1.5: 100
  - Volume Ratio 1.0-1.5: 75
  - Volume Ratio 0.5-1.0: 50
  - Volume Ratio < 0.5: 25
```

### 3. Signal Generator

**Purpose**: Orchestrate signal generation by combining technical and sentiment analysis.

**Interface**:
```csharp
public interface ISignalGenerator
{
    Task<List<TradingSignal>> GenerateSignalsAsync(SignalType type);
    Task<TradingSignal> GenerateSignalForStockAsync(string symbol, SignalType type);
}

public enum SignalType
{
    Overnight,
    Intraday
}

public enum SignalAction
{
    BUY,
    SELL
}

public class TradingSignal
{
    public string Id { get; set; }
    public string Symbol { get; set; }
    public SignalAction Action { get; set; }
    public decimal SignalStrength { get; set; } // 0-100
    public decimal EntryPrice { get; set; }
    public decimal TargetPrice { get; set; }
    public decimal StopLoss { get; set; }
    public decimal TechnicalScore { get; set; }
    public decimal SentimentScore { get; set; }
    public TechnicalIndicators Indicators { get; set; }
    public DateTime GeneratedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public SignalType Type { get; set; }
    public string Status { get; set; } // "active", "expired", "executed"
}
```

**Implementation Details**:

**Signal Generation Algorithm**:
```
1. For each stock in watchlist:
   a. Fetch technical indicators
   b. Fetch latest sentiment score from news articles (last 24 hours)
   c. Calculate combined score: (Technical × 0.7) + (Sentiment × 0.3)
   d. Evaluate BUY conditions
   e. Evaluate SELL conditions
   f. If conditions met and score > 70, create signal
   g. Validate with Risk Manager
   h. If valid, persist signal

2. Return list of generated signals
```

**BUY Signal Conditions**:
```
ALL of the following must be true:
- Sentiment Score > 0.6 (60%)
- Current Price > EMA-20
- RSI between 30-70
- MACD Histogram > 0 (bullish)
- Volume Ratio > 1.5
- Combined Score > 70
```

**SELL Signal Conditions**:
```
ALL of the following must be true:
- Sentiment Score < 0.4 (40%)
- Current Price < EMA-20 OR RSI > 70
- MACD Histogram < 0 (bearish)
- Volume spike detected (Volume Ratio > 2.0)
- Combined Score > 70
```

**Price Calculations**:
```
For BUY signals:
  Entry Price = Current Market Price
  Target Price = Entry Price × (1 + Random(0.02, 0.05))  // 2-5% gain
  Stop Loss = Entry Price × (1 - Random(0.02, 0.03))     // 2-3% loss

For SELL signals:
  Entry Price = Current Market Price
  Target Price = Entry Price × (1 - Random(0.02, 0.05))  // 2-5% drop
  Stop Loss = Entry Price × (1 + Random(0.02, 0.03))     // 2-3% rise
```

**Expiration Times**:
```
Overnight signals: Expires at 10:00 AM IST next trading day
Intraday signals: Expires 3-6 hours from generation (random within range)
```

### 4. Risk Manager

**Purpose**: Enforce risk management rules and validate signals.

**Interface**:
```csharp
public interface IRiskManager
{
    Task<bool> ValidateSignalAsync(TradingSignal signal);
    Task<int> GetActiveSignalCountAsync();
    Task<bool> IsDuplicateSignalAsync(string symbol, TimeSpan window);
    decimal CalculatePositionSize(decimal totalCapital);
    bool ValidateStopLoss(decimal entryPrice, decimal stopLoss, SignalAction action);
    bool ValidateTarget(decimal entryPrice, decimal target, SignalAction action);
    decimal CalculateRiskRewardRatio(decimal entry, decimal target, decimal stopLoss);
}
```

**Implementation Details**:

**Validation Rules**:
```
1. Check active signal count < 8
2. Check no duplicate signal for same symbol within 6 hours
3. Validate stop-loss is 2-3% from entry
4. Validate target is 2-5% from entry
5. Validate risk-reward ratio >= 1:1
6. For intraday signals, validate market is open
7. Return true if all checks pass, false otherwise
```

**Position Size Calculation**:
```
Position Size = Total Capital × 0.125  // 12.5% per trade (100% / 8 max positions)
```

**Stop-Loss Validation**:
```
For BUY:
  Stop Loss % = (Entry - Stop Loss) / Entry × 100
  Valid if 2% <= Stop Loss % <= 3%

For SELL:
  Stop Loss % = (Stop Loss - Entry) / Entry × 100
  Valid if 2% <= Stop Loss % <= 3%
```

**Target Validation**:
```
For BUY:
  Target % = (Target - Entry) / Entry × 100
  Valid if 2% <= Target % <= 5%

For SELL:
  Target % = (Entry - Target) / Entry × 100
  Valid if 2% <= Target % <= 5%
```

**Risk-Reward Ratio**:
```
Risk = |Entry - Stop Loss|
Reward = |Target - Entry|
Ratio = Reward / Risk
Valid if Ratio >= 1.0 (prefer >= 2.0)
```

### 5. Watchlist Manager

**Purpose**: Manage configurable list of stocks to monitor.

**Interface**:
```csharp
public interface IWatchlistManager
{
    Task<List<WatchlistStock>> GetActiveStocksAsync();
    Task<WatchlistStock> GetStockAsync(string symbol);
    Task UpdateStockAsync(WatchlistStock stock);
    Task<bool> IsStockEnabledAsync(string symbol);
}

public class WatchlistStock
{
    public string Symbol { get; set; }
    public bool IsEnabled { get; set; }
    public long MinimumVolume { get; set; }
    public StockPriority Priority { get; set; }
    public DateTime LastAnalyzed { get; set; }
}

public enum StockPriority
{
    High,
    Medium,
    Low
}
```

**Implementation Details**:
- Load watchlist from configuration (appsettings.json)
- Default stocks: RELIANCE, TCS, INFY, HDFCBANK, ICICIBANK, SBIN, HINDUNILVR, ITC, KOTAKBANK, BHARTIARTL
- Support runtime enable/disable without restart
- Filter stocks by minimum volume threshold before signal generation
- Priority affects order of analysis (high priority first)

### 6. Scheduler Service

**Purpose**: Execute scheduled jobs for overnight and intraday analysis.

**Interface**:
```csharp
public class SignalSchedulerService : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken);
    private async Task RunOvernightAnalysisAsync();
    private async Task RunIntradayAnalysisAsync();
    private async Task RefreshMarketDataAsync();
}
```

**Implementation Details**:

**Job Schedule**:
```
Overnight Analysis:
  - Trigger: Daily at 8:00 PM IST
  - Action: Generate overnight signals for next day
  - Uses: Previous day's closing prices

Intraday Analysis:
  - Trigger: Every 15 minutes during market hours (9:15 AM - 3:30 PM IST)
  - Action: Generate intraday signals for same-day execution
  - Uses: Real-time market prices

Market Data Refresh:
  - Trigger: Every 1 minute during market hours
  - Action: Update cached market data
  - Ensures fresh data for intraday analysis
```

**Implementation using IHostedService**:
```csharp
public class SignalSchedulerService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<SignalSchedulerService> _logger;
    private Timer _overnightTimer;
    private Timer _intradayTimer;
    private Timer _refreshTimer;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Schedule overnight job at 8:00 PM IST daily
        var overnightTime = GetNextOvernightTime();
        _overnightTimer = new Timer(
            async _ => await RunOvernightAnalysisAsync(),
            null,
            overnightTime,
            TimeSpan.FromDays(1)
        );

        // Schedule intraday job every 15 minutes during market hours
        _intradayTimer = new Timer(
            async _ => await RunIntradayAnalysisAsync(),
            null,
            TimeSpan.Zero,
            TimeSpan.FromMinutes(15)
        );

        // Schedule market data refresh every 1 minute during market hours
        _refreshTimer = new Timer(
            async _ => await RefreshMarketDataAsync(),
            null,
            TimeSpan.Zero,
            TimeSpan.FromMinutes(1)
        );

        await Task.CompletedTask;
    }
}
```

### 7. Signal Storage

**Purpose**: Persist signals to MongoDB with query capabilities.

**Interface**:
```csharp
public interface ISignalStorage
{
    Task<string> SaveSignalAsync(TradingSignal signal);
    Task<List<TradingSignal>> GetActiveSignalsAsync();
    Task<List<TradingSignal>> GetOvernightSignalsAsync();
    Task<List<TradingSignal>> GetIntradaySignalsAsync();
    Task<List<TradingSignal>> GetSignalsBySymbolAsync(string symbol);
    Task<List<TradingSignal>> GetHistoricalSignalsAsync(DateTime from, DateTime to);
    Task UpdateSignalStatusAsync(string signalId, string status);
    Task ExpireOldSignalsAsync();
}
```

**MongoDB Schema**:
```json
{
  "_id": "ObjectId",
  "symbol": "string",
  "action": "BUY|SELL",
  "signalStrength": "decimal",
  "entryPrice": "decimal",
  "targetPrice": "decimal",
  "stopLoss": "decimal",
  "technicalScore": "decimal",
  "sentimentScore": "decimal",
  "indicators": {
    "ema20": "decimal",
    "rsi14": "decimal",
    "macd": {
      "macdLine": "decimal",
      "signalLine": "decimal",
      "histogram": "decimal"
    },
    "volumeRatio": "decimal"
  },
  "generatedAt": "ISODate",
  "expiresAt": "ISODate",
  "type": "Overnight|Intraday",
  "status": "active|expired|executed",
  "executedAt": "ISODate"
}
```

**Indexes**:
```
- { status: 1, expiresAt: 1 } - For active signal queries
- { symbol: 1, generatedAt: -1 } - For symbol-specific queries
- { type: 1, status: 1 } - For overnight/intraday filtering
- { generatedAt: -1 } - For historical queries
```

### 8. Signals Controller

**Purpose**: Expose REST API endpoints for signal access.

**Interface**:
```csharp
[ApiController]
[Route("api/signals")]
public class SignalsController : ControllerBase
{
    [HttpGet("active")]
    Task<ActionResult<List<TradingSignal>>> GetActiveSignals();

    [HttpGet("overnight")]
    Task<ActionResult<List<TradingSignal>>> GetOvernightSignals();

    [HttpGet("intraday")]
    Task<ActionResult<List<TradingSignal>>> GetIntradaySignals();

    [HttpGet("stock/{symbol}")]
    Task<ActionResult<List<TradingSignal>>> GetSignalsByStock(string symbol);

    [HttpGet("history")]
    Task<ActionResult<List<TradingSignal>>> GetHistoricalSignals(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] string symbol,
        [FromQuery] string action,
        [FromQuery] string status
    );

    [HttpPost("generate")]
    Task<ActionResult<List<TradingSignal>>> GenerateSignals(
        [FromBody] GenerateSignalsRequest request
    );
}

public class GenerateSignalsRequest
{
    public SignalType Type { get; set; }
    public List<string> Symbols { get; set; } // Optional, null = all watchlist
}
```

**Response Format**:
```json
{
  "signals": [
    {
      "id": "507f1f77bcf86cd799439011",
      "symbol": "RELIANCE",
      "action": "BUY",
      "signalStrength": 78.5,
      "entryPrice": 2450.00,
      "targetPrice": 2572.50,
      "stopLoss": 2401.00,
      "technicalScore": 82.0,
      "sentimentScore": 68.0,
      "indicators": {
        "ema20": 2420.00,
        "rsi14": 55.0,
        "macd": {
          "macdLine": 12.5,
          "signalLine": 10.2,
          "histogram": 2.3
        },
        "volumeRatio": 1.8
      },
      "generatedAt": "2024-01-15T20:00:00Z",
      "expiresAt": "2024-01-16T10:00:00Z",
      "type": "Overnight",
      "status": "active"
    }
  ]
}
```

## Data Models

### Configuration Model

**appsettings.json Structure**:
```json
{
  "TradingSignals": {
    "SignalGeneration": {
      "TechnicalWeight": 0.7,
      "SentimentWeight": 0.3,
      "MinimumSignalStrength": 70,
      "BuyConditions": {
        "MinSentiment": 0.6,
        "RequirePriceAboveEma": true,
        "RsiMin": 30,
        "RsiMax": 70,
        "RequireMacdBullish": true,
        "MinVolumeRatio": 1.5
      },
      "SellConditions": {
        "MaxSentiment": 0.4,
        "RequirePriceBelowEmaOrHighRsi": true,
        "RsiOverbought": 70,
        "RequireMacdBearish": true,
        "MinVolumeRatio": 2.0
      }
    },
    "RiskManagement": {
      "MaxConcurrentSignals": 8,
      "PositionSizePercent": 12.5,
      "StopLossMinPercent": 2.0,
      "StopLossMaxPercent": 3.0,
      "TargetMinPercent": 2.0,
      "TargetMaxPercent": 5.0,
      "MinRiskRewardRatio": 1.0,
      "PreferredRiskRewardRatio": 2.0,
      "DuplicateSignalWindowHours": 6
    },
    "MarketData": {
      "PrimaryProvider": "NSE",
      "FallbackProvider": "YahooFinance",
      "CacheDurationMinutes": 1,
      "NseApiUrl": "https://www.nseindia.com/api",
      "MarketOpenTime": "09:15",
      "MarketCloseTime": "15:30",
      "Timezone": "India Standard Time"
    },
    "Watchlist": {
      "MaxStocks": 15,
      "DefaultStocks": [
        {
          "Symbol": "RELIANCE",
          "IsEnabled": true,
          "MinimumVolume": 1000000,
          "Priority": "High"
        },
        {
          "Symbol": "TCS",
          "IsEnabled": true,
          "MinimumVolume": 500000,
          "Priority": "High"
        },
        {
          "Symbol": "INFY",
          "IsEnabled": true,
          "MinimumVolume": 800000,
          "Priority": "High"
        }
      ]
    },
    "Scheduling": {
      "OvernightAnalysisTime": "20:00",
      "IntradayAnalysisIntervalMinutes": 15,
      "MarketDataRefreshIntervalMinutes": 1,
      "OvernightSignalExpiryTime": "10:00",
      "IntradaySignalDurationHoursMin": 3,
      "IntradaySignalDurationHoursMax": 6
    }
  }
}
```

### Sentiment Score Integration

The system integrates with existing news sentiment data:

```csharp
public interface ISentimentProvider
{
    Task<decimal> GetLatestSentimentAsync(string symbol, TimeSpan window);
}

// Query MongoDB for articles in last 24 hours
// Average the sentiment scores (TrendRadar + Loughran-McDonald)
// Return normalized score 0-1
```

## Data Models

### Entity Relationships

```
TradingSignal
  ├── Symbol (string) - Stock symbol
  ├── Action (enum) - BUY/SELL
  ├── SignalStrength (decimal) - Combined score
  ├── EntryPrice (decimal)
  ├── TargetPrice (decimal)
  ├── StopLoss (decimal)
  ├── TechnicalScore (decimal)
  ├── SentimentScore (decimal)
  ├── Indicators (TechnicalIndicators)
  │   ├── Ema20 (decimal)
  │   ├── Rsi14 (decimal)
  │   ├── Macd (MacdResult)
  │   │   ├── MacdLine (decimal)
  │   │   ├── SignalLine (decimal)
  │   │   └── Histogram (decimal)
  │   └── VolumeRatio (decimal)
  ├── GeneratedAt (DateTime)
  ├── ExpiresAt (DateTime)
  ├── Type (enum) - Overnight/Intraday
  └── Status (string) - active/expired/executed

WatchlistStock
  ├── Symbol (string)
  ├── IsEnabled (bool)
  ├── MinimumVolume (long)
  ├── Priority (enum) - High/Medium/Low
  └── LastAnalyzed (DateTime)

MarketQuote
  ├── Symbol (string)
  ├── LastPrice (decimal)
  ├── Open (decimal)
  ├── High (decimal)
  ├── Low (decimal)
  ├── Close (decimal)
  ├── Volume (long)
  └── Timestamp (DateTime)

OhlcData
  ├── Date (DateTime)
  ├── Open (decimal)
  ├── High (decimal)
  ├── Low (decimal)
  ├── Close (decimal)
  └── Volume (long)
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: NSE API Primary Data Source
*For any* stock symbol, when requesting current market data, the system should attempt to fetch from NSE India API before falling back to Yahoo Finance.
**Validates: Requirements 1.1**

### Property 2: API Fallback on Failure
*For any* stock symbol, when the NSE India API is unavailable or returns an error, the system should successfully retrieve data from Yahoo Finance API.
**Validates: Requirements 1.2**

### Property 3: Historical Data Completeness
*For any* stock symbol with sufficient trading history, historical OHLC data requests should return exactly 50 trading days of data.
**Validates: Requirements 1.3**

### Property 4: Market Data Caching
*For any* stock symbol, when market data is fetched twice within 1 minute, only one API call should be made (second request served from cache).
**Validates: Requirements 1.4**

### Property 5: Market Hours Detection
*For any* timestamp, the system should correctly identify whether it falls within Market_Hours (9:15 AM - 3:30 PM IST, Monday-Friday).
**Validates: Requirements 1.5**

### Property 6: EMA Calculation Accuracy
*For any* price series with at least 20 data points, the calculated EMA-20 should match the standard exponential moving average formula with multiplier 2/(20+1).
**Validates: Requirements 2.1**

### Property 7: RSI Bounds and Calculation
*For any* price series with at least 14 data points, the calculated RSI-14 should be between 0 and 100 (inclusive) and follow the standard RSI formula.
**Validates: Requirements 2.2**

### Property 8: MACD Calculation Accuracy
*For any* price series with at least 26 data points, the calculated MACD should equal EMA(12) - EMA(26), with signal line equal to EMA(9) of MACD line.
**Validates: Requirements 2.3**

### Property 9: Volume Ratio Calculation
*For any* OHLC data series with at least 20 days, the volume ratio should equal current volume divided by the 20-day average volume.
**Validates: Requirements 2.4**

### Property 10: Technical Score Normalization
*For any* set of technical indicators, the computed technical score should be between 0 and 100 (inclusive) and apply the correct indicator weights.
**Validates: Requirements 2.5**

### Property 11: Signal Score Weighting
*For any* technical score and sentiment score, the combined signal strength should equal (technical × 0.7) + (sentiment × 0.3).
**Validates: Requirements 3.1**

### Property 12: BUY Signal Conditions
*For any* market conditions, a BUY signal should only be generated when ALL of the following are true: sentiment > 0.6, price > EMA-20, RSI between 30-70, MACD bullish (histogram > 0), volume ratio > 1.5, and combined score > 70.
**Validates: Requirements 3.2**

### Property 13: SELL Signal Conditions
*For any* market conditions, a SELL signal should only be generated when ALL of the following are true: sentiment < 0.4, (price < EMA-20 OR RSI > 70), MACD bearish (histogram < 0), volume ratio > 2.0, and combined score > 70.
**Validates: Requirements 3.3**

### Property 14: Entry Price Assignment
*For any* generated signal, the entry price should equal the current market price at the time of signal generation.
**Validates: Requirements 3.4**

### Property 15: Target Price Bounds
*For any* generated signal, the target price should be 2-5% above entry for BUY signals and 2-5% below entry for SELL signals.
**Validates: Requirements 3.5**

### Property 16: Stop-Loss Bounds
*For any* generated signal, the stop-loss should be 2-3% below entry for BUY signals and 2-3% above entry for SELL signals.
**Validates: Requirements 3.6**

### Property 17: Overnight Signal Data Source
*For any* overnight signal, the entry price and technical indicators should be calculated using the previous trading day's closing prices, not real-time prices.
**Validates: Requirements 3.7**

### Property 18: Intraday Signal Timing and Data
*For any* intraday signal, it should only be generated during Market_Hours and use real-time market prices.
**Validates: Requirements 3.8, 4.8**

### Property 19: Maximum Concurrent Signals
*For any* attempt to generate a new signal, when there are already 8 active signals, the new signal should be rejected by the Risk_Manager.
**Validates: Requirements 4.1, 4.2**

### Property 20: Position Size Calculation
*For any* total capital amount, the calculated position size should equal exactly 12.5% (capital × 0.125).
**Validates: Requirements 4.3**

### Property 21: Stop-Loss Validation
*For any* signal, the Risk_Manager should validate that stop-loss is between 2-3% from entry price, rejecting signals outside this range.
**Validates: Requirements 4.4**

### Property 22: Target Price Validation
*For any* signal, the Risk_Manager should validate that target price is between 2-5% from entry price, rejecting signals outside this range.
**Validates: Requirements 4.5**

### Property 23: Risk-Reward Ratio Validation
*For any* signal, the calculated risk-reward ratio (|target - entry| / |entry - stop_loss|) should be at least 1:1, with signals below this threshold rejected.
**Validates: Requirements 4.6**

### Property 24: Duplicate Signal Prevention
*For any* stock symbol, when a signal was generated less than 6 hours ago, attempting to generate another signal for the same stock should be rejected.
**Validates: Requirements 4.7**

### Property 25: Overnight Signal Expiration
*For any* overnight signal generated at 8 PM, the expires_at timestamp should be set to 10:00 AM IST the next trading day.
**Validates: Requirements 5.2, 7.7**

### Property 26: Intraday Signal Expiration
*For any* intraday signal, the expires_at timestamp should be set to 3-6 hours from the generation time.
**Validates: Requirements 5.4, 7.8**

### Property 27: Scheduled Job Retry on Failure
*For any* scheduled job that fails, the system should log the error and retry on the next scheduled interval without crashing.
**Validates: Requirements 5.7**

### Property 28: Watchlist Filtering by Enabled Status
*For any* signal generation run, only stocks with IsEnabled=true in the watchlist should be analyzed.
**Validates: Requirements 6.6**

### Property 29: Volume Threshold Filtering
*For any* stock in the watchlist, if its current volume is below the configured minimum volume threshold, signal generation should be skipped for that stock.
**Validates: Requirements 6.7**

### Property 30: Signal Storage Round-Trip
*For any* generated signal, saving it to MongoDB and then retrieving it should produce an equivalent signal with all fields preserved (symbol, action, prices, scores, indicators, timestamps).
**Validates: Requirements 7.1**

### Property 31: Signal Schema Completeness
*For any* signal stored in MongoDB, it should contain all required fields: symbol, action, signal_strength, entry_price, target_price, stop_loss, technical_score, sentiment_score, EMA, RSI, MACD, volume_ratio, generated_at, expires_at, status.
**Validates: Requirements 7.2**

### Property 32: Signal Status Updates
*For any* signal, when its expires_at timestamp is in the past, updating its status should set it to "expired"; when marked as executed, status should be "executed" with execution timestamp.
**Validates: Requirements 7.3, 7.4**

### Property 33: Active Signal Query Filtering
*For any* query for active signals, only signals with status="active" AND expires_at in the future should be returned.
**Validates: Requirements 7.5**

### Property 34: Historical Signal Query Filtering
*For any* historical signal query with filters (date range, symbol, action, status), only signals matching ALL specified filters should be returned.
**Validates: Requirements 7.6**

### Property 35: API Error Status Codes
*For any* API request that fails, the system should return appropriate HTTP status codes: 400 for bad requests, 404 for not found, 500 for server errors.
**Validates: Requirements 8.7**

### Property 36: API Response Completeness
*For any* signal returned by API endpoints, the JSON response should include all signal metadata fields.
**Validates: Requirements 8.8**

### Property 37: Environment-Specific Configuration
*For any* environment (development, production), when environment-specific configuration overrides exist, they should be applied correctly over default values.
**Validates: Requirements 10.5**

### Property 38: Configuration Default Fallback
*For any* invalid or missing configuration value, the system should use safe default values and log a warning without crashing.
**Validates: Requirements 10.6**

### Property 39: Configuration Hot-Reload
*For any* configuration change, the system should pick up the new values without requiring an application restart.
**Validates: Requirements 10.7**

## Error Handling

### Market Data Errors

**NSE API Failures**:
- Implement circuit breaker pattern with 3 consecutive failures triggering fallback
- Log all API failures with timestamps and error details
- Automatically retry NSE API after 5 minutes of successful Yahoo Finance usage
- Return cached data if both APIs fail and cache is less than 5 minutes old

**Yahoo Finance Fallback**:
- Convert NSE symbols to Yahoo format (append .NS suffix)
- Handle rate limiting with exponential backoff
- Cache Yahoo Finance data with same 1-minute TTL as NSE data

**Insufficient Data**:
- Return clear error message when less than 50 days of historical data available
- Skip signal generation for stocks with insufficient data
- Log warning with stock symbol and available data count

### Technical Indicator Errors

**Division by Zero**:
- Handle zero average loss in RSI calculation (return RSI=100)
- Handle zero denominator in volume ratio (return ratio=0)

**Invalid Input Data**:
- Validate price data is positive and non-null
- Validate volume data is non-negative
- Skip indicator calculation and log error if validation fails

### Signal Generation Errors

**Risk Validation Failures**:
- Log detailed reason for signal rejection (which rule failed)
- Continue processing other stocks if one fails validation
- Return partial results with error summary

**Sentiment Data Missing**:
- Use neutral sentiment (0.5) if no news articles found in last 24 hours
- Log warning when using default sentiment
- Consider skipping signal generation if sentiment is critical

### Storage Errors

**MongoDB Connection Failures**:
- Implement retry logic with exponential backoff (3 attempts)
- Queue signals in memory if MongoDB is temporarily unavailable
- Alert administrators if MongoDB is down for > 5 minutes

**Duplicate Key Errors**:
- Handle duplicate signal IDs gracefully
- Regenerate ID and retry save operation
- Log warning if duplicate occurs

### Scheduler Errors

**Job Execution Failures**:
- Catch all exceptions in scheduled jobs
- Log full stack trace and context
- Continue with next scheduled execution
- Send alert if same job fails 3 consecutive times

**Timing Errors**:
- Validate system clock is synchronized (NTP)
- Handle daylight saving time transitions for IST
- Log warning if job execution is delayed > 1 minute

## Testing Strategy

### Dual Testing Approach

The system will use both unit tests and property-based tests for comprehensive coverage:

**Unit Tests**: Focus on specific examples, edge cases, and integration points
- Test specific market scenarios (bull market, bear market, sideways)
- Test edge cases (market holidays, insufficient data, API failures)
- Test integration between components (signal generator + risk manager)
- Test API endpoints with specific request/response examples

**Property-Based Tests**: Verify universal properties across randomized inputs
- Generate random price series and verify indicator calculations
- Generate random market conditions and verify signal generation rules
- Generate random signals and verify risk validation rules
- Generate random timestamps and verify market hours detection

### Property-Based Testing Configuration

**Library**: Use FsCheck for C# property-based testing
- Minimum 100 iterations per property test (due to randomization)
- Each test tagged with: **Feature: trading-signal-generation, Property {number}: {property_text}**
- Custom generators for domain objects (MarketQuote, OhlcData, TradingSignal)

**Example Property Test Structure**:
```csharp
[Property]
[Tag("Feature: trading-signal-generation, Property 6: EMA Calculation Accuracy")]
public Property EmaCalculationShouldMatchFormula()
{
    return Prop.ForAll(
        GeneratePriceSeries(minLength: 20),
        prices =>
        {
            var ema = _technicalAnalyzer.CalculateEma(prices, 20);
            var expectedEma = CalculateExpectedEma(prices, 20);
            return Math.Abs(ema - expectedEma) < 0.01m; // Allow small floating point error
        }
    );
}
```

### Test Coverage Requirements

**Technical Indicators** (Unit + Property Tests):
- EMA calculation accuracy with known price series
- RSI bounds (0-100) and calculation correctness
- MACD formula verification
- Volume ratio calculation
- Technical score normalization and weighting

**Signal Generation** (Unit + Property Tests):
- BUY signal condition enforcement
- SELL signal condition enforcement
- Score weighting (70% technical, 30% sentiment)
- Entry/target/stop-loss price calculations
- Overnight vs intraday signal differences

**Risk Management** (Unit + Property Tests):
- Maximum 8 concurrent signals enforcement
- Position size calculation (12.5%)
- Stop-loss validation (2-3%)
- Target validation (2-5%)
- Risk-reward ratio validation (>= 1:1)
- Duplicate signal prevention (6-hour window)

**Market Data** (Unit + Integration Tests):
- NSE API integration
- Yahoo Finance fallback
- Caching behavior (1-minute TTL)
- Market hours detection
- Holiday detection

**Storage** (Unit + Integration Tests):
- Signal persistence round-trip
- Query filtering (active, overnight, intraday, by symbol)
- Status updates (active → expired, active → executed)
- Historical queries with date ranges

**API Endpoints** (Integration Tests):
- GET /api/signals/active returns active signals
- GET /api/signals/overnight returns overnight signals
- GET /api/signals/intraday returns intraday signals
- GET /api/signals/stock/{symbol} returns symbol-specific signals
- GET /api/signals/history supports filtering
- POST /api/signals/generate triggers manual generation
- Error responses return correct HTTP status codes

**Scheduled Jobs** (Integration Tests):
- Overnight job executes at 8:00 PM IST
- Intraday job executes every 15 minutes during market hours
- Market data refresh executes every 1 minute during market hours
- Job retry on failure

### Test Data Generators

**Custom FsCheck Generators**:
```csharp
// Generate realistic price series
public static Arbitrary<List<decimal>> GeneratePriceSeries(int minLength = 50)
{
    return Arb.From(
        Gen.ListOf(minLength, Gen.Choose(100, 5000))
           .Select(prices => prices.Select(p => (decimal)p).ToList())
    );
}

// Generate realistic OHLC data
public static Arbitrary<OhlcData> GenerateOhlcData()
{
    return Arb.From(
        from open in Gen.Choose(100, 5000)
        from high in Gen.Choose(open, open + 100)
        from low in Gen.Choose(open - 100, open)
        from close in Gen.Choose(low, high)
        from volume in Gen.Choose(100000, 10000000)
        select new OhlcData
        {
            Date = DateTime.Today,
            Open = open,
            High = high,
            Low = low,
            Close = close,
            Volume = volume
        }
    );
}

// Generate realistic trading signals
public static Arbitrary<TradingSignal> GenerateTradingSignal()
{
    return Arb.From(
        from symbol in Gen.Elements("RELIANCE", "TCS", "INFY", "HDFCBANK")
        from action in Gen.Elements(SignalAction.BUY, SignalAction.SELL)
        from entry in Gen.Choose(100, 5000).Select(x => (decimal)x)
        from strength in Gen.Choose(70, 100).Select(x => (decimal)x)
        select new TradingSignal
        {
            Symbol = symbol,
            Action = action,
            EntryPrice = entry,
            SignalStrength = strength,
            // ... other fields
        }
    );
}
```

### Integration Test Scenarios

**End-to-End Signal Generation**:
1. Mock NSE API with realistic market data
2. Seed MongoDB with historical sentiment data
3. Trigger signal generation
4. Verify signals are generated, validated, and stored
5. Verify signals can be retrieved via API

**Fallback Scenario**:
1. Configure NSE API to fail
2. Trigger signal generation
3. Verify Yahoo Finance is used
4. Verify signals are still generated successfully

**Risk Rejection Scenario**:
1. Create 8 active signals in database
2. Attempt to generate 9th signal
3. Verify signal is rejected
4. Verify error is logged

**Scheduled Job Scenario**:
1. Configure overnight job for immediate execution
2. Wait for job to execute
3. Verify overnight signals are generated
4. Verify signals expire at 10:00 AM next day
