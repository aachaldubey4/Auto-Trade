# Auto-Trade — In-Depth Research Document

> **Purpose**: A comprehensive reference document for the Auto-Trade codebase so that any developer can understand how every feature works and how all files relate to each other before making changes.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Repository Layout](#3-repository-layout)
4. [Backend — Layer-by-Layer Breakdown](#4-backend--layer-by-layer-breakdown)
   - 4.1 [Domain Layer — `AutoTrade.Domain`](#41-domain-layer--autotradedomain)
   - 4.2 [Application Layer — `AutoTrade.Application`](#42-application-layer--autotradeapplication)
   - 4.3 [Infrastructure Layer — `AutoTrade.Infrastructure`](#43-infrastructure-layer--autotradeinfrastructure)
   - 4.4 [WebAPI Layer — `AutoTrade.WebAPI`](#44-webapi-layer--autotradewebapi)
5. [Feature Deep-Dives — Backend](#5-feature-deep-dives--backend)
   - 5.1 [Startup & Dependency Injection](#51-startup--dependency-injection)
   - 5.2 [News Aggregation Pipeline](#52-news-aggregation-pipeline)
   - 5.3 [Sentiment Analysis Engine](#53-sentiment-analysis-engine)
   - 5.4 [Stock Matching — Aho-Corasick](#54-stock-matching--aho-corasick)
   - 5.5 [NSE Stock Refresh Service](#55-nse-stock-refresh-service)
   - 5.6 [Market Data Provider](#56-market-data-provider)
   - 5.7 [Technical Analysis](#57-technical-analysis)
   - 5.8 [Signal Generation Engine](#58-signal-generation-engine)
   - 5.9 [Risk Manager](#59-risk-manager)
   - 5.10 [Signal Scheduler (Background Service)](#510-signal-scheduler-background-service)
   - 5.11 [Signal Storage (MongoDB)](#511-signal-storage-mongodb)
   - 5.12 [Article Storage Service](#512-article-storage-service)
   - 5.13 [REST API Controllers](#513-rest-api-controllers)
6. [Database — MongoDB Schema](#6-database--mongodb-schema)
7. [Frontend — React Application](#7-frontend--react-application)
   - 7.1 [Tech Stack](#71-tech-stack)
   - 7.2 [Frontend File Layout](#72-frontend-file-layout)
   - 7.3 [API Service (`services/api.ts`)](#73-api-service-servicesapits)
   - 7.4 [React Query Hooks](#74-react-query-hooks)
   - 7.5 [Components Breakdown](#75-components-breakdown)
8. [Configuration Reference (`appsettings.json`)](#8-configuration-reference-appsettingsjson)
9. [Infrastructure — Docker / Deployment](#9-infrastructure--docker--deployment)
10. [Data-Flow Diagrams](#10-data-flow-diagrams)
11. [Key Design Decisions & Gotchas](#11-key-design-decisions--gotchas)
12. [Future Phases — Planned Work](#12-future-phases--planned-work)
13. [Quick-Reference: File → Purpose Map](#13-quick-reference-file--purpose-map)

---

## 1. Project Overview

**Auto-Trade** is an **intraday trading signal system** for the **Indian stock market (NSE)**. It:

- Aggregates **financial news** from multiple Indian RSS feeds (Moneycontrol, Economic Times, LiveMint, etc.).
- Performs **sentiment analysis** using a Loughran-McDonald financial lexicon augmented with Indian market phrases.
- Matches news articles to **NSE-listed stock symbols** using an Aho-Corasick multi-pattern search.
- Fetches **real-time and historical market data** from NSE India API and Yahoo Finance.
- Calculates **technical indicators** (EMA-20, RSI-14, MACD, Volume Ratio).
- Generates **BUY/SELL trading signals** by combining technical and sentiment scores.
- Applies **risk management rules** (stop-loss 2–3%, target 2–5%, max 8 concurrent signals).
- Serves all of this through a **REST API** consumed by a **React dashboard**.
- The dashboard shows signals, watchlist prices, news feed, stock charts, and supports **browser notifications**.

> **Current Status**: Phases 1–3 are implemented. Phase 4 (Zerodha Kite API live order placement) is designed but not coded.

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Frontend (React + Vite)                         │
│  Dashboard → SignalsPanel → Watchlist → NewsFeed → StockChart → Header  │
│  hooks: useSignals / useNews / useWatchlist / useMarketStatus / …        │
│  services/api.ts  (Axios → http://localhost:3001)                        │
└────────────────────────────┬────────────────────────────────────────────┘
                             │ HTTP (REST)
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     AutoTrade.WebAPI (ASP.NET Core)                      │
│  Controllers: News / Signals / Market / Watchlist / Health               │
│  CORS allowed: localhost:5173 & localhost:3000                            │
└──┬──────────────────┬──────────────────┬──────────────────┬─────────────┘
   │                  │                  │                  │
   ▼                  ▼                  ▼                  ▼
NewsProcessing   SignalGenerator    MarketData         WatchlistManager
Service          (Scoped)           Provider           (Singleton)
(Singleton bg)   │                  (Scoped)
   │             ├─ TechnicalAnalyzer
   │             ├─ SentimentProvider
   │             ├─ RiskManager
   │             └─ SignalStorage
   │
   ├─ NewsAggregator (RSS → RawArticle)
   ├─ SentimentAnalyzer
   │    ├─ LoughranMcDonaldAnalyzer
   │    └─ HeadlineHeuristicAnalyzer
   ├─ StockMapper → AhoCorasickStockMatcher
   └─ ArticleStorageService
        │
        ▼
  MongoDB (articles, stocks, signals)

Background Services:
  - NseStockRefreshService  (seeds stocks on startup, refreshes daily @ 6am IST)
  - SignalSchedulerService  (overnight @ 8pm IST, intraday every 15min during market)

External Data Sources:
  - NSE India API (quotes, historical bhavcopy archives)
  - Yahoo Finance (fallback quotes & historical)
  - Indian financial RSS feeds (9 sources configured)
```

---

## 3. Repository Layout

```
Auto-Trade-main/
├── README.md                    ← Quick-start guide (Phase 1 overview)
├── IMPLEMENTATION_GUIDE.md      ← Detailed Phase 2/3/4 design blueprints
├── CLAUDE.md / AGENTS.md        ← AI agent instructions (not runtime code)
├── setup-and-run.sh             ← Shell helper to start backend + frontend
├── backend/
│   ├── docker-compose.yml       ← MongoDB + Mongo-Express containers
│   ├── README.md                ← Backend-specific start instructions
│   ├── README_SWAGGER.md        ← Swagger UI usage
│   ├── data/
│   │   └── nse-stocks.json      ← Static NSE stock seed file (fallback)
│   └── src/
│       ├── AutoTrade.Domain/    ← Pure models (no dependencies)
│       ├── AutoTrade.Application/ ← Interfaces / contracts
│       ├── AutoTrade.Infrastructure/ ← Concrete implementations
│       └── AutoTrade.WebAPI/    ← ASP.NET Core host, controllers, DI wiring
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.ts
    └── src/
        ├── App.tsx
        ├── main.tsx
        ├── components/          ← UI components
        ├── hooks/               ← React Query hooks
        ├── services/api.ts      ← Axios HTTP client
        ├── types/api.ts         ← TypeScript type definitions
        ├── config/env.ts        ← Environment variables
        └── data/mockData.ts     ← Legacy Phase 1 mock data
```

---

## 4. Backend — Layer-by-Layer Breakdown

The backend follows **Clean Architecture** with four projects:

### 4.1 Domain Layer — `AutoTrade.Domain`

**Location**: `backend/src/AutoTrade.Domain/Models/`

Contains **pure data models** with no external dependencies. Every other project references this.

| File | Purpose |
|------|---------|
| `RawArticle.cs` | RSS article before processing: Title, Content, URL, PublishedAt, Source, ContentHash |
| `ProcessedArticle.cs` | After sentiment analysis: adds Sentiment, Keywords, Entities, MarketCategory, MarketRelevance |
| `ArticleDocument.cs` | MongoDB document version: adds `_id`, StockSymbols, ProcessingStatus |
| `MappedArticle.cs` | After stock mapping: adds StockSymbols, IsGeneralMarket |
| `SentimentScore.cs` | Sentiment result: Positive, Negative, Neutral (0–1 each), Overall string, Confidence |
| `LoughranMcDonaldResult.cs` | Raw L-M output before blending: Positive, Negative, Uncertainty, Litigious, Constraining scores |
| `StockDocument.cs` | MongoDB document for NSE stocks: Symbol, CompanyName, ISIN, Series, Sector, Aliases, SearchTerms |
| `StockSymbol.cs` | Lightweight symbol reference |
| `SignalDocument.cs` | MongoDB document for trading signals |
| `TradingSignalsConfig.cs` | Strongly-typed configuration object (mirrors `appsettings.json:TradingSignals`) |
| `SystemConfig.cs` | System-level configuration |
| `MarketCategory.cs` | Enum: GeneralMarket, Banking, IT, Pharma, Auto, Energy, FMCG, Metals, Realty, Telecom, Infrastructure |
| `EntityData.cs` | Named entity: type, text, confidence |
| `MCPModels.cs` | Models for future TrendRadar MCP integration |
| `ApiResponse.cs` | Generic `ApiResponse<T>` envelope: success, data, pagination, error, timestamp |
| `FeedHealthStatus.cs` | RSS feed health: name, url, isHealthy, lastStatusCode, lastChecked, lastError |

> **Key Relationships**: `RawArticle` → `ProcessedArticle` → `ArticleDocument` (persistence). `StockDocument` powers `AhoCorasickStockMatcher`. `TradingSignalsConfig` is injected everywhere that needs scoring/risk/scheduling config.

---

### 4.2 Application Layer — `AutoTrade.Application`

**Location**: `backend/src/AutoTrade.Application/Interfaces/`

Contains **only interfaces** — no implementations. This is the contract layer.

| Interface | What it abstracts |
|-----------|------------------|
| `INewsAggregator` | Start/stop RSS monitoring, fetch from single URL, fetch all sources |
| `INewsProcessingService` | Orchestrates the full news pipeline (aggregate → analyze → map → store) |
| `ISentimentAnalyzer` | Per-article analysis, batch analysis, news sentiment by symbol |
| `ILoughranMcDonaldAnalyzer` | Core L-M lexicon scoring |
| `IHeadlineHeuristicAnalyzer` | Fast headline scoring using pattern matching |
| `ISentimentProvider` | Sentiment score accessor for signal generation |
| `IStockMatcher` | Find mentioned stocks in text; rebuild Aho-Corasick index |
| `IStockMapper` | Map processed articles to stock symbols |
| `IArticleStorageService` | CRUD + query for article documents in MongoDB |
| `INseStockRefreshService` | Refresh NSE stock list |
| `IMarketDataProvider` | Live quotes, historical OHLC, market open/closed status |
| `ITechnicalAnalyzer` | Calculate EMA, RSI, MACD, Volume Ratio indicators |
| `ISignalGenerator` | Generate signals for watchlist, generate for single stock |
| `ISignalStorage` | Save, query (active/overnight/intraday/by-symbol/history), expire, update |
| `IRiskManager` | Validate a signal against risk rules |
| `IWatchlistManager` | Get active stocks from configured watchlist |

---

### 4.3 Infrastructure Layer — `AutoTrade.Infrastructure`

**Location**: `backend/src/AutoTrade.Infrastructure/`

Contains all **concrete implementations**. Split into:

#### Data/
- **`MongoDbContext.cs`** — Connects to MongoDB and exposes typed collections: `Articles`, `Stocks`, `Signals`. Creates indexes on startup (PublishedAt, ContentHash unique, StockSymbols+PublishedAt compound, sentiment, signal status+expiry).

#### Services/ (News Pipeline)
- **`NewsAggregator.cs`** — Fetches RSS feeds. Loads feed configs from `appsettings.json`. Runs `FetchAllSourcesAsync` (parallel HTTP requests, browser-spoofed User-Agent, 10s timeout per feed). Strips HTML via HtmlAgilityPack. Computes SHA256 content hash for deduplication. Runs on a configurable timer (default 5 minutes).
- **`LoughranMcDonaldAnalyzer.cs`** — Scores article text against a built-in financial word dictionary (5 categories: positive, negative, uncertainty, litigious, constraining). Also scores against 35+ **Indian financial phrases** (e.g. "beats estimates", "sebi penalty", "rbi rate cut") with 2× weight multiplier.
- **`HeadlineHeuristicAnalyzer.cs`** — Fast pattern-based headline scoring that returns a single [-1, +1] score. Used to supplement L-M when content is short.
- **`SentimentAnalyzer.cs`** — **Blends** L-M and Headline scores. If article content ≥ 50 chars: 70% L-M + 30% Headline. If headline-only: 40% L-M + 60% Headline. Maps blended score to Positive/Negative/Neutral probabilities. Computes confidence from signal alignment. `GetNewsSentimentAsync(symbol)` queries MongoDB for last-24h articles for that symbol, weights by recency and marketRelevance.
- **`AhoCorasickStockMatcher.cs`** — Implements Aho-Corasick multi-pattern matching algorithm. On startup, reads all active stocks from MongoDB and builds patterns from: symbol, full company name, first-two-word short form, aliases, meaningful individual words. Scanning is O(n) per article. Thread-safe via atomic pointer swap on rebuild.
- **`StockMapper.cs`** — Uses `AhoCorasickStockMatcher` to find which NSE stocks are mentioned in each article.
- **`NewsProcessingService.cs`** — Orchestrates: `NewsAggregator → SentimentAnalyzer → StockMapper → ArticleStorageService`. Runs as background loop.
- **`ArticleStorageService.cs`** — MongoDB CRUD for articles. Handles deduplication via ContentHash unique index. Supports filtered queries (by stock, by sentiment, by timeframe, pagination).
- **`NseStockRefreshService.cs`** — `IHostedService`. On startup, checks if MongoDB has ≥ 100 stocks; if not, seeds from `backend/data/nse-stocks.json`. Then asynchronously fetches the official `EQUITY_L.csv` from NSE archives and upserts all stocks. Runs again daily at 06:00 IST. After each refresh, rebuilds the Aho-Corasick index.

#### Services/SignalGeneration/
- **`MarketDataProvider.cs`** — Fetches market data. Primary: NSE India API (`/api/quote-equity?symbol=X`). Historical: NSE bhavcopy archives (CSV for each day). Fallback: Yahoo Finance (via `YahooFinanceApi` NuGet). Second fallback: stale bhavcopy. Final fallback: **synthetic data** (deterministic seeded random based on symbol hash + date). Circuit breaker (Polly) on NSE API (3 failures → 30s break). Rate limiting (500ms between API calls). In-memory cache (configurable, default 1 min for quotes, 5 min for historical).
- **`TechnicalAnalyzer.cs`** — Fetches 50 days of OHLC. Calculates: `EMA(20)` (standard exponential MA with SMA seed), `RSI(14)` (Wilder's using simple average of last 14 gains/losses), `MACD` (EMA12 - EMA26, signal = EMA9 of MACD values, histogram = MACD - signal), `VolumeRatio` (today's volume / 20-day avg). `TechnicalScore` = 25% EMA + 25% RSI + 25% MACD + 25% Volume (0–100).
- **`SentimentProvider.cs`** — Thin wrapper: delegates to `ISentimentAnalyzer.GetNewsSentimentAsync`. Returns `Confidence` as the decimal sentiment score (0–1) for signal generation.
- **`SignalGenerator.cs`** — **The core engine**. For each watchlist stock (parallel, configurable max 3 at a time): (1) calculate technical indicators → (2) get sentiment score → (3) combine scores (70% technical + 30% sentiment) → (4) evaluate BUY conditions → (5) evaluate SELL conditions → (6) create signal → (7) validate via RiskManager → (8) persist to MongoDB.
- **`RiskManager.cs`** — Validates signals: max 8 concurrent active signals, stop-loss must be 2–3% from entry, target must be 2–5% from entry, risk-reward ratio ≥ 1:1 (preferred 2:1), no duplicate signal for same symbol within 1 hour.
- **`SignalStorage.cs`** — MongoDB CRUD for signals. Methods: `SaveSignalAsync`, `GetActiveSignalsAsync`, `GetOvernightSignalsAsync`, `GetIntradaySignalsAsync`, `GetSignalsBySymbolAsync`, `GetHistoricalSignalsAsync`, `UpdateSignalStatusAsync`, `ExecuteSignalAsync`, `ExpireOldSignalsAsync`.
- **`WatchlistManager.cs`** — Returns active stocks from `TradingSignalsConfig.Watchlist.DefaultStocks`.
- **`SignalSchedulerService.cs`** — `BackgroundService`. Polls every 1 minute. Triggers: overnight analysis at 20:00 IST (once/day), intraday analysis every 15 minutes when market is open, market data refresh every 1 minute when open, signal expiry checks every loop.

---

### 4.4 WebAPI Layer — `AutoTrade.WebAPI`

**Location**: `backend/src/AutoTrade.WebAPI/`

#### `Program.cs`
The application entry point and DI container. Registers all services (see Section 5.1). Starts `NewsProcessingService` in a background `Task.Run` immediately on startup so the first RSS fetch doesn't block the app. Registers lifecycle shutdown for graceful stop.

#### Controllers

| Controller | Route Prefix | Key Endpoints |
|------------|-------------|---------------|
| `HealthController` | `GET /health` | Service status, version info |
| `MarketController` | `GET /api/market/status` | Market open/closed, IST time |
| | `GET /api/market/quote/{symbol}` | Live quote |
| | `GET /api/market/history/{symbol}?days=30` | Historical OHLC |
| | `GET /api/market/index/nifty50` | NIFTY 50 index (cached 30s) |
| `NewsController` | `GET /api/news/latest` | Paginated news with filters |
| | `GET /api/news/by-stock/{symbol}` | News for specific stock |
| | `GET /api/news/sentiment/{symbol}` | Aggregated sentiment score |
| | `GET /api/news/search?query=...` | Full-text search |
| | `POST /api/news/process` | Manual trigger news processing |
| | `GET /api/news/sources` | RSS feed health statuses |
| | `GET /api/news/sentiment-summary` | Sentiment for all watchlist stocks |
| `SignalsController` | `GET /api/signals/active` | All active signals |
| | `GET /api/signals/overnight` | Overnight signals |
| | `GET /api/signals/intraday` | Intraday signals |
| | `GET /api/signals/stock/{symbol}` | Signals for one stock |
| | `GET /api/signals/history` | Historical with filters |
| | `POST /api/signals/generate` | Manual trigger with diagnostics |
| | `PATCH /api/signals/{id}/status` | Update status (expire, etc.) |
| | `POST /api/signals/{id}/execute` | Mark executed with price override |
| `WatchlistController` | `GET /api/watchlist` | Watchlist with live quotes + sentiment |

---

## 5. Feature Deep-Dives — Backend

### 5.1 Startup & Dependency Injection

All wiring is in `Program.cs`:

```
Singletons (shared app-wide, stateful):
  MongoDbContext          ← MongoDB connection
  TradingSignalsConfig    ← Parsed from appsettings.json
  LoughranMcDonaldAnalyzer
  HeadlineHeuristicAnalyzer
  SentimentAnalyzer
  NewsAggregator
  AhoCorasickStockMatcher (IStockMatcher)
  StockMapper
  ArticleStorageService
  NewsProcessingService
  NseStockRefreshService (also IHostedService)
  WatchlistManager

Scoped (per HTTP request):
  MarketDataProvider (has IMemoryCache, which is shared)
  TechnicalAnalyzer
  SentimentProvider
  RiskManager
  SignalStorage
  SignalGenerator

Hosted Services (long-running background):
  NseStockRefreshService  ← stocks seed + daily refresh
  SignalSchedulerService  ← overnight/intraday signal scheduling
```

Memory cache is registered as singleton. CORS allows `localhost:5173` (Vite dev) and `localhost:3000`. Enum serialization uses `JsonStringEnumConverter` so `BUY`/`SELL` are strings in JSON.

---

### 5.2 News Aggregation Pipeline

**Trigger**: Runs automatically every 5 minutes via `NewsAggregator._timer`. Also triggered manually via `POST /api/news/process`.

**Flow**:
```
Timer fires
  │
  ▼
NewsAggregator.FetchAllSourcesAsync()
  ├── FetchFromSourceAsync("Moneycontrol RSS URL")    ─┐
  ├── FetchFromSourceAsync("Economic Times RSS URL")   ├── Parallel Task.WhenAll
  ├── FetchFromSourceAsync("LiveMint RSS URL")         │
  └── ... (enabled feeds only)                        ─┘
  │
  ▼ Returns List<RawArticle> (deduplicated by ContentHash)
  │
NewsProcessingService.ProcessAsync(articles)
  │
  ├── SentimentAnalyzer.AnalyzeArticleAsync(rawArticle) → ProcessedArticle
  │     ├── LoughranMcDonaldAnalyzer.AnalyzeAsync()  (word-level + Indian phrases)
  │     ├── HeadlineHeuristicAnalyzer.ScoreHeadline() (fast pattern matching)
  │     └── Blend → SentimentScore
  │
  ├── StockMapper.MapAsync(processedArticle) → MappedArticle
  │     └── AhoCorasickStockMatcher.FindMentionedStocks(text) → [NSE symbols]
  │
  └── ArticleStorageService.UpsertArticleAsync(mappedArticle)
        └── MongoDB articles collection (upsert on ContentHash)
```

**Feed health tracking**: Each RSS fetch updates `_feedHealth` dict (accessible via `GET /api/news/sources`). Errors (403, timeout, parse failure) are captured per-feed without stopping other feeds.

**Known disabled feeds** (due to Cloudflare/403 blocks on server-side):
- Business Standard
- NDTV Profit

---

### 5.3 Sentiment Analysis Engine

**File**: `SentimentAnalyzer.cs`

#### Blending Algorithm

```
Step 1: Loughran-McDonald score
  words → positiveCount, negativeCount, uncertaintyCount, litigiousCount
  Indian phrases (35+ patterns) → weighted 2× per match
  lmScore = positive - (negative + uncertainty*0.5 + litigious*0.7)  ← range [-1, +1]

Step 2: Headline heuristic score  ← range [-1, +1]

Step 3: Blend
  if content.length >= 50:
    blended = 0.7 * lmScore + 0.3 * headlineScore
  else:
    blended = 0.4 * lmScore + 0.6 * headlineScore

Step 4: Map to probabilities
  positive = clamp(0.5 + blended * 0.5, 0, 1)
  negative = clamp(0.5 - blended * 0.5, 0, 1)
  neutral  = max(0, 1 - positive - negative)

Step 5: Confidence
  signalAlignment = 1 - |sign(lmScore) - sign(headlineScore)| * 0.3
  confidence = clamp(max(|lmScore|, |headlineScore|) * signalAlignment, 0, 1)
```

#### `GetNewsSentimentAsync(symbol)` — for signal generation

Queries last 24h articles for the symbol, then does **time-and-relevance weighted averaging**:
```
weight = max(0.1, 1.0 - hoursOld/24) * marketRelevance
weighted avg of (positive, negative, neutral) across all matching articles
```

#### `MarketRelevance` computation
```
marketRelevance = (sentimentConfidence * 0.6) + (min(1, keywordCount/10) * 0.4)
```

#### Market Category Detection
Keyword-based classification of articles into sectors (Banking, IT, Pharma, Auto, Energy, FMCG, Metals, Realty, Telecom, Infrastructure, GeneralMarket).

---

### 5.4 Stock Matching — Aho-Corasick

**File**: `AhoCorasickStockMatcher.cs`

**Why Aho-Corasick?** Instead of scanning text for each stock separately (O(stocks × articleLength)), this algorithm scans text once (O(articleLength + matchCount)), making it suitable for matching against thousands of NSE stocks simultaneously.

**How the index is built**:
1. Load all active `StockDocument` records from MongoDB.
2. For each stock, generate patterns:
   - Stock symbol (e.g. `RELIANCE`)
   - Full company name (e.g. `Reliance Industries Limited`)
   - First 2 words of company name (e.g. `Reliance Industries`)
   - All aliases from `Aliases` field
   - Individual meaningful words from company name (length > 3, excluding stop-words like "limited", "bank", "india")
3. Build trie with failure links (BFS phase).
4. Atomically swap the `_trie` pointer (volatile field, thread-safe for concurrent readers).

**Rebuild triggers**: On startup after DB seed, after NSE CSV refresh.

**Word boundary checking**: A match is only counted if followed by a non-alphanumeric character (prevents "ITC" matching "ITCH").

---

### 5.5 NSE Stock Refresh Service

**File**: `NseStockRefreshService.cs`

**Startup sequence**:
1. Count stocks in MongoDB.
2. If < 100 → seed from `backend/data/nse-stocks.json` (static fallback with pre-seeded major NSE stocks).
3. After 10-second delay, best-effort refresh from `https://archives.nseindia.com/content/equities/EQUITY_L.csv`.
4. Parse CSV (fields: SYMBOL, NAME OF COMPANY, SERIES, DATE OF LISTING, PAID UP VALUE, MARKET LOT, ISIN NUMBER, FACE VALUE).
5. Only keep `Series == "EQ"` (equity series).
6. Bulk upsert into MongoDB (update name/ISIN/series/sector; SetOnInsert for aliases/searchTerms).
7. Rebuild Aho-Corasick index.
8. Schedule next refresh at 06:00 IST next day.

> **Important**: The NSE CSV URL requires a browser-like User-Agent header — the service spoofs `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36`.

---

### 5.6 Market Data Provider

**File**: `MarketDataProvider.cs`

#### Quote Fetching Chain
```
GetCurrentQuoteAsync(symbol)
  ├── Check MemoryCache (1-min TTL)
  ├── If miss: NSE circuit breaker
  │     ├── FetchFromNseWithRetryAsync (up to 2 retries, 500ms delay)
  │     │     └── GET /api/quote-equity?symbol=X
  │     │           parses: priceInfo.lastPrice, open, intraDayHighLow, previousClose, totalTradedVolume
  │     └── On BrokenCircuitException → FetchQuoteWithFallbackAsync
  │           ├── Yahoo Finance (SYMBOL.NS format, up to 2 retries)
  │           │     5-minute cooldown on 429 Too Many Requests
  │           ├── Bhavcopy fallback (last 7 trading days, max staleness from config)
  │           └── Synthetic fallback (if UseSyntheticFallback=true)
  └── Cache result
```

#### Historical Data Chain
```
GetHistoricalDataAsync(symbol, days)
  ├── Check MemoryCache (5-min TTL)
  ├── FetchHistoricalFromNseArchivesAsync
  │     ├── Download bhavcopy CSV for each trading day backwards
  │     │   URL: https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_{ddMMyyy}.csv
  │     ├── Parse CSV (SYMBOL, SERIES=EQ, OPEN_PRICE, HIGH_PRICE, LOW_PRICE, CLOSE_PRICE, TTL_TRD_QNTY)
  │     ├── Per-date cache (configurable BhavcopyCacheMinutes, default 30)
  │     └── Mutex per cache-key (prevents thundering herd on same date)
  ├── If insufficient: fallback to Yahoo Finance
  └── If all fail and UseSyntheticFallback=true: generate synthetic OHLC series
        (deterministic seeded random based on symbol hash + date)
```

#### Market Open/Closed Check
Uses IST timezone, checks:
- Weekend (Saturday/Sunday) → closed
- Holiday list (hardcoded NSE holidays 2024, needs annual update)
- `MarketOpenTime = "09:15"` and `MarketCloseTime = "15:30"`

#### Synthetic Data
Pre-defined base prices for 30+ Nifty50 stocks. Unknown symbols get deterministic price from symbol hash. Used for demo/development when APIs are blocked.

---

### 5.7 Technical Analysis

**File**: `TechnicalAnalyzer.cs`

Requires 50 days of OHLC data. Calculations:

#### EMA(20) — Exponential Moving Average
```
multiplier = 2 / (period + 1)
EMA_initial = SMA of first 'period' prices
EMA_i = (price_i × multiplier) + (EMA_{i-1} × (1 - multiplier))
```

#### RSI(14) — Relative Strength Index
```
gains  = list of positive daily changes
losses = list of absolute negative daily changes
avgGain = mean of last 14 gains
avgLoss = mean of last 14 losses
RS  = avgGain / avgLoss
RSI = 100 - (100 / (1 + RS))
```
> Note: This is a simplified RSI (no Wilder smoothing). Production-grade RSI uses exponential smoothing on gains/losses.

#### MACD
```
EMA12 = EMA of closing prices, period=12
EMA26 = EMA of closing prices, period=26
MACD_line = EMA12 - EMA26
Signal_line = EMA9 of last 9 MACD values
Histogram = MACD_line - Signal_line
IsBullish = Histogram > 0
```

#### Volume Ratio
```
volumeRatio = today_volume / avg_of_last_20_days_volume
```

#### Technical Score (0–100)
```
EMA_score    = price > EMA20 ? 100 : 0
RSI_score    = RSI 30–70 → 100; RSI < 20 or > 80 → 0; else 50
MACD_score   = IsBullish ? 100 : 0
Volume_score = ratio > 1.5 → 100; > 1.0 → 75; > 0.5 → 50; else 25

TechnicalScore = (EMA_score + RSI_score + MACD_score + Volume_score) / 4
```

---

### 5.8 Signal Generation Engine

**File**: `SignalGenerator.cs`

#### Combined Score Formula
```
sentimentScore100 = sentimentScore × 100  (sentiment is 0–1 from confidence)
combinedScore = (technicalScore × 0.7) + (sentimentScore100 × 0.3)
```

#### BUY Signal Conditions (all must pass):
1. `sentimentScore > MinSentiment` (default 0.45)
2. `price > EMA20` (if `RequirePriceAboveEma = true`)
3. `RSI >= 30 AND RSI <= 70`
4. `MACD.IsBullish` (if `RequireMacdBullish = true`, currently false)
5. `volumeRatio > MinVolumeRatio` (default 1.0)
6. `combinedScore > MinimumSignalStrength` (default 60)

#### SELL Signal Conditions (all must pass):
1. `sentimentScore < MaxSentiment` (default 0.55)
2. `price < EMA20 OR RSI > 70` (if `RequirePriceBelowEmaOrHighRsi = true`)
3. `NOT MACD.IsBullish` (if `RequireMacdBearish = true`, currently false)
4. `volumeRatio > MinVolumeRatio`
5. `combinedScore > MinimumSignalStrength`

#### Price Calculation
Target and stop-loss are randomized within config ranges:
- `targetPercent` = random in [TargetMinPercent, TargetMaxPercent] (2%–5%)
- `stopLossPercent` = random in [StopLossMinPercent, StopLossMaxPercent] (2%–3%)

For BUY: target = entry × (1 + targetPercent), stopLoss = entry × (1 - stopLossPercent)
For SELL: target = entry × (1 - targetPercent), stopLoss = entry × (1 + stopLossPercent)

#### Signal Expiry
- **Overnight**: expires next trading day at `OvernightSignalExpiryTime` (10:00 IST), skipping weekends
- **Intraday**: expires in 3–6 hours (random within config range)

#### Diagnostics
Each signal generation run produces `StockSignalDiagnostic` per stock with: technicalData status, buy/sell eval result, risk validation status, final status, rejection reasons. Returned by `POST /api/signals/generate?includeDiagnostics=true`.

---

### 5.9 Risk Manager

**File**: `RiskManager.cs`

Validates a candidate signal before persistence:

| Rule | Value (default) | Config Path |
|------|----------------|-------------|
| Max concurrent signals | 8 | `RiskManagement.MaxConcurrentSignals` |
| Stop-loss range | 2%–3% | `StopLossMinPercent` / `StopLossMaxPercent` |
| Target range | 2%–5% | `TargetMinPercent` / `TargetMaxPercent` |
| Min risk-reward ratio | 1:1 | `MinRiskRewardRatio` |
| Duplicate window | 1 hour | `DuplicateSignalWindowHours` |

`ValidateSignalWithReasonAsync` returns `(bool isValid, string rejectionReason)`.

---

### 5.10 Signal Scheduler (Background Service)

**File**: `SignalSchedulerService.cs`

Runs as `BackgroundService` (registered in `Program.cs`). Main loop delays 1 minute between checks.

| Trigger | Condition | Action |
|---------|-----------|--------|
| Overnight | `istNow.TimeOfDay == 20:00` (±1 min) AND not run today | `GenerateSignalsAsync(Overnight)` |
| Intraday | Market open AND `istNow.Minute % 15 == 0` AND not run in last 15 min | `GenerateSignalsAsync(Intraday)` |
| Market refresh | Market open AND not run in last 1 min | Placeholder (MarketDataProvider caches itself) |
| Expiry check | Every loop | `SignalStorage.ExpireOldSignalsAsync()` |

Uses `IServiceProvider.CreateScope()` to resolve scoped services (`ISignalGenerator`, `ISignalStorage`) safely from a singleton background service.

---

### 5.11 Signal Storage (MongoDB)

**File**: `SignalStorage.cs`

Key query patterns:
- **Active**: status = "active" AND ExpiresAt > now
- **Overnight**: type = Overnight AND status = "active"
- **Intraday**: type = Intraday AND status = "active"
- **By symbol**: Symbol == X (case insensitive)
- **History**: GeneratedAt between [from, to]
- **Expiry**: bulk update status="expired" where status="active" AND ExpiresAt <= now

---

### 5.12 Article Storage Service

**File**: `ArticleStorageService.cs`

- Upsert by ContentHash (unique index prevents duplicates).
- `GetLatestArticlesAsync(filters)` — supports: stockSymbol, sentiment (positive/negative/neutral), hours window, marketCategory, pagination (page/limit).
- `GetArticlesByStockAsync(symbol)` — filtered by StockSymbols array.
- `GetSentimentSummaryAsync()` — aggregates sentiment per symbol across last 24h articles.

---

### 5.13 REST API Controllers

All controllers follow the same response envelope pattern:

```json
{
  "success": true,
  "data": { ... },
  "pagination": { "page": 1, "limit": 20, "totalCount": 150 },
  "error": null,
  "timestamp": "2026-06-07T00:00:00Z"
}
```

**`POST /api/signals/generate`** has special behavior:
- If requested type = Intraday but market is closed, automatically switches to Overnight.
- Returns `requestedType`, `effectiveType`, `effectiveTypeReason` in response.
- Returns `diagnosticsSummary` (rejection reason counts) and per-stock `stockDiagnostics` (when `includeDiagnostics: true`).

**`POST /api/signals/{id}/execute`** validates:
- Signal must exist.
- Entry, target, stop > 0.
- Stop-loss % within config limits (2–3%).
- Target % within config limits (2–5%).
- Risk-reward ratio ≥ min (1:1).

---

## 6. Database — MongoDB Schema

### Collections

#### `articles`
```js
{
  _id: ObjectId,
  title: String,
  content: String,
  url: String,
  publishedAt: DateTime,
  source: String,             // e.g., "Moneycontrol"
  contentHash: String,        // SHA256, unique index
  sentiment: {
    positive: Double,         // 0-1
    negative: Double,         // 0-1
    neutral: Double,          // 0-1
    overall: String,          // "positive" | "negative" | "neutral"
    confidence: Double        // 0-1
  },
  keywords: [String],         // top 15 meaningful words
  entities: [{ type, text, confidence }],
  marketCategory: Int,        // MarketCategory enum value
  marketRelevance: Double,    // 0-1
  stockSymbols: [String],     // NSE symbols mentioned (from Aho-Corasick)
  isGeneralMarket: Boolean,
  processingStatus: String,   // "processed" | "failed"
  processedAt: DateTime
}
```
**Indexes**: publishedAt↓, (stockSymbols↑, publishedAt↓), (marketCategory↑, publishedAt↓), (sentiment.Overall↑, publishedAt↓), contentHash (unique), keywords↑, processingStatus↑

#### `stocks`
```js
{
  _id: ObjectId,
  symbol: String,             // unique, e.g., "RELIANCE"
  companyName: String,        // "Reliance Industries Limited"
  isin: String,               // e.g., "INE002A01018"
  series: String,             // "EQ"
  sector: Int,                // MarketCategory enum
  isActive: Boolean,
  aliases: [String],          // alternative names
  searchTerms: [String],      // for text search
  lastUpdated: DateTime
}
```
**Indexes**: symbol (unique), searchTerms↑, sector↑, isActive↑

#### `signals`
```js
{
  _id: ObjectId,
  id: String,                 // MongoDB ObjectId as string
  symbol: String,
  action: Int,                // 0=BUY, 1=SELL (enum)
  signalStrength: Decimal,    // 0-100 combined score
  entryPrice: Decimal,
  targetPrice: Decimal,
  stopLoss: Decimal,
  technicalScore: Decimal,
  sentimentScore: Decimal,    // 0-100 scale
  indicators: {
    symbol, ema20, rsi14,
    macd: { macdLine, signalLine, histogram },
    volumeRatio, currentPrice, technicalScore, calculatedAt
  },
  generatedAt: DateTime,
  expiresAt: DateTime,
  type: Int,                  // 0=Overnight, 1=Intraday
  status: String              // "active" | "expired" | "executed"
}
```
**Indexes**: (status↑, expiresAt↑), (symbol↑, generatedAt↓), (type↑, status↑), generatedAt↓

---

## 7. Frontend — React Application

### 7.1 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build tool | Vite |
| UI components | DaisyUI + Tailwind CSS |
| Data fetching | TanStack React Query v5 |
| HTTP client | Axios |
| Charts | Recharts |
| Animations | Framer Motion |
| Notifications | react-hot-toast |
| Theme | DaisyUI theme (dark/light toggle) |

### 7.2 Frontend File Layout

```
frontend/src/
├── App.tsx                  ← Root: wraps with QueryClientProvider, ErrorBoundary, Toaster, renders Dashboard
├── main.tsx                 ← ReactDOM.createRoot entry point
├── index.css                ← Tailwind directives
├── config/
│   └── env.ts               ← Reads VITE_API_URL (defaults to http://localhost:3001/api)
├── types/
│   └── api.ts               ← All TypeScript types: ApiResponse<T>, TradingSignal, WatchlistItem, etc.
├── services/
│   └── api.ts               ← Axios client + all API call functions organized by domain
├── hooks/
│   ├── queryKeys.ts         ← Centralized React Query key definitions
│   ├── useSignals.ts        ← useSignals(kind), useUpdateSignalStatus(), useExecuteSignal()
│   ├── useNews.ts           ← useNews(), useNewsByStock(), useNewsSources(), etc.
│   ├── useWatchlist.ts      ← useWatchlist()
│   ├── useMarketStatus.ts   ← useMarketStatus() (30s refetch)
│   ├── useNiftyIndex.ts     ← useNiftyIndex() (30s refetch)
│   ├── useMarketHistory.ts  ← useMarketHistory(symbol, days)
│   ├── useHealth.ts         ← useHealth()
│   ├── useSignalHistory.ts  ← useSignalHistory(params)
│   ├── useTheme.ts          ← useTheme() with localStorage persistence
│   └── useUserSettings.ts   ← useUserSettings() — notifications, signal strength threshold
└── components/
    ├── Dashboard.tsx         ← Main layout with tab switching + notification logic
    ├── Header.tsx            ← Market status, NIFTY 50, theme toggle, settings
    ├── SignalsPanel.tsx       ← Signals table with kind tabs (active/overnight/intraday)
    ├── Watchlist.tsx          ← Stock list with prices, changes, sentiment badges
    ├── NewsFeed.tsx           ← News for selected stock
    ├── NewsTab.tsx            ← Full news tab with filters, search, sentiment summary
    ├── StockChart.tsx         ← Recharts area chart of historical OHLC
    ├── Portfolio.tsx          ← Portfolio/executed signals tracker
    ├── Settings.tsx           ← User settings: notifications, threshold
    ├── SignalExecutionModal.tsx ← Modal to confirm signal execution with price inputs
    └── ErrorBoundary.tsx      ← React error boundary
```

### 7.3 API Service (`services/api.ts`)

Thin typed wrapper over Axios. All calls go to `VITE_API_URL` (default `http://localhost:3001/api`).

```
api.health.get()                   → GET /health
api.market.status()                → GET /market/status
api.market.nifty50()               → GET /market/index/nifty50
api.market.quote(symbol)           → GET /market/quote/{symbol}
api.market.history(symbol, days)   → GET /market/history/{symbol}?days=N
api.watchlist.get()                → GET /watchlist
api.news.latest({page,limit,...})  → GET /news/latest
api.news.byStock(symbol)           → GET /news/by-stock/{symbol}
api.news.sentiment(symbol)         → GET /news/sentiment/{symbol}
api.news.search(query)             → GET /news/search?query=...
api.news.process()                 → POST /news/process
api.news.sources()                 → GET /news/sources
api.news.sentimentSummary()        → GET /news/sentiment-summary
api.signals.active()               → GET /signals/active
api.signals.overnight()            → GET /signals/overnight
api.signals.intraday()             → GET /signals/intraday
api.signals.updateStatus(id, req)  → PATCH /signals/{id}/status
api.signals.execute(id, req)       → POST /signals/{id}/execute
api.signals.history(params)        → GET /signals/history
api.signals.generate(type)         → POST /signals/generate (120s timeout)
```

Error handling: `toClientError()` converts Axios errors to `ApiClientError` with code, status, details. `unwrapApiResponse<T>()` validates the `success` flag and throws if false or data is null.

### 7.4 React Query Hooks

All queries use `refetchInterval` for auto-refresh:

| Hook | Refetch Interval | Query Key |
|------|-----------------|-----------|
| `useSignals` | 30s | `['signals', kind]` |
| `useWatchlist` | 30s | `['watchlist']` |
| `useMarketStatus` | 30s | `['market', 'status']` |
| `useNiftyIndex` | 30s | `['market', 'index', 'nifty50']` |
| `useNews` | 60s | `['news', 'latest', params]` |

Mutations (`useUpdateSignalStatus`, `useExecuteSignal`) invalidate all signal query keys on success.

### 7.5 Components Breakdown

#### `Dashboard.tsx`
- Manages `selectedStock` state (default: "RELIANCE"), `activeTab` state ('dashboard'/'news').
- Reads `useSignals('active')` and `useUserSettings()` to trigger browser notifications for new high-strength signals (above user-configured threshold).
- Notifications are deduplicated using `localStorage` key `auto-trade-notified-signal-ids` (keeps last 200 IDs).
- Uses `framer-motion` for tab transition animations.
- Layout: `Header` → tabs → (if dashboard: 3-col grid with SignalsPanel+Portfolio+Watchlist+NewsFeed on left, StockChart on right; if news: full-width NewsTab).

#### `Header.tsx`
- Shows market open/closed badge, NIFTY 50 value+change, theme toggle, settings gear.
- Market data auto-refreshes every 30s.

#### `SignalsPanel.tsx`
- Tabs: Active / Overnight / Intraday.
- Table columns: Stock, Signal (BUY/SELL badge), Entry price, Target (with % gain), Stop Loss (with % loss), Strength badge, Time ago, Execute/Expire buttons.
- Loading state: skeleton rows.
- "⚡ Generate Signals" button calls `POST /api/signals/generate` and invalidates queries.
- Execute button opens `SignalExecutionModal`.
- `normaliseAction()` handles both string ("BUY"/"SELL") and numeric (0/1) enum values from backend.

#### `Watchlist.tsx`
- Shows stocks with live price, change%, volume, sentiment badge.
- Clicking a stock updates `selectedStock` in Dashboard (driving NewsFeed and StockChart).

#### `NewsFeed.tsx`
- Shows last 24h news articles for the selected stock.
- Each article shows sentiment badge, title, source, time.

#### `NewsTab.tsx`
- Full-page news view with:
  - Search input
  - Sentiment filter (All/Positive/Negative/Neutral)
  - Time window filter (6h/12h/24h/48h/7d)
  - Stock sentiment summary cards
  - Paginated article list
  - RSS feed health status table

#### `StockChart.tsx`
- Recharts `AreaChart` of last 30 days OHLC.
- Plots close price as area chart with gradient fill.

#### `SignalExecutionModal.tsx`
- Modal dialog to execute a signal.
- Pre-fills entry/target/stop-loss from signal.
- Calls `POST /api/signals/{id}/execute`.

#### `Settings.tsx`
- Toggle: enable browser push notifications.
- Slider: signal strength threshold for notifications (0–100).
- Settings persisted to `localStorage`.

---

## 8. Configuration Reference (`appsettings.json`)

All key configuration values with their defaults:

### News Feeds
| Key | Default | Description |
|-----|---------|-------------|
| `NewsFeeds.MoneycontrolRss` | moneycontrol URL | RSS feed URL |
| `NewsFeeds.EconomicTimesRss` | ET markets RSS | RSS feed URL |
| `NewsFeeds.LiveMintRss` | livemint markets | RSS feed URL |
| *(+ 6 more feeds)* | various | Some disabled (Cloudflare blocks) |
| `NewsFeeds.FetchIntervalMinutes` | 5 | How often to poll RSS feeds |

### Sentiment Analysis
| Key | Default | Description |
|-----|---------|-------------|
| `SentimentAnalysis.LexiconWeightWithContent` | 0.7 | L-M weight when article has content |
| `SentimentAnalysis.HeadlineWeightWithContent` | 0.3 | Headline weight when content exists |
| `SentimentAnalysis.LexiconWeightHeadlineOnly` | 0.4 | L-M weight for headline-only |
| `SentimentAnalysis.HeadlineWeightHeadlineOnly` | 0.6 | Headline weight for headline-only |
| `SentimentAnalysis.IndianPhraseMultiplier` | 2.0 | Weight multiplier for Indian phrases |
| `SentimentAnalysis.MinContentLengthForFullAnalysis` | 50 | Min chars to use content weighting |

### Signal Generation
| Key | Default | Description |
|-----|---------|-------------|
| `TradingSignals.SignalGeneration.TechnicalWeight` | 0.7 | Technical score weight in combined |
| `TradingSignals.SignalGeneration.SentimentWeight` | 0.3 | Sentiment score weight in combined |
| `TradingSignals.SignalGeneration.MinimumSignalStrength` | 60 | Min combined score to generate |
| `TradingSignals.SignalGeneration.MaxParallelStocks` | 3 | Max concurrent signal calculations |
| `BuyConditions.MinSentiment` | 0.45 | Minimum sentiment confidence for BUY |
| `BuyConditions.RequirePriceAboveEma` | true | Price must be above EMA20 |
| `BuyConditions.RsiMin` / `RsiMax` | 30 / 70 | RSI must be in this range |
| `BuyConditions.RequireMacdBullish` | false | MACD bullish not required |
| `BuyConditions.MinVolumeRatio` | 1.0 | Volume must be at/above average |
| `SellConditions.MaxSentiment` | 0.55 | Max sentiment for SELL |
| `SellConditions.RequirePriceBelowEmaOrHighRsi` | true | Price below EMA or RSI > 70 |
| `SellConditions.RsiOverbought` | 70 | RSI overbought threshold for SELL |

### Risk Management
| Key | Default | Description |
|-----|---------|-------------|
| `RiskManagement.MaxConcurrentSignals` | 8 | Max active signals at once |
| `RiskManagement.PositionSizePercent` | 12.5 | Capital % per trade |
| `RiskManagement.StopLossMinPercent` | 2.0 | Min stop-loss distance |
| `RiskManagement.StopLossMaxPercent` | 3.0 | Max stop-loss distance |
| `RiskManagement.TargetMinPercent` | 2.0 | Min target distance |
| `RiskManagement.TargetMaxPercent` | 5.0 | Max target distance |
| `RiskManagement.MinRiskRewardRatio` | 1.0 | Min R:R ratio |
| `RiskManagement.PreferredRiskRewardRatio` | 2.0 | Preferred R:R |
| `RiskManagement.DuplicateSignalWindowHours` | 1 | No duplicate signals for same symbol |

### Market Data
| Key | Default | Description |
|-----|---------|-------------|
| `MarketData.PrimaryProvider` | NSE | Primary data source |
| `MarketData.FallbackProvider` | YahooFinance | Fallback |
| `MarketData.CacheDurationMinutes` | 1 | Quote cache TTL |
| `MarketData.NseApiUrl` | `https://www.nseindia.com/api` | NSE API base URL |
| `MarketData.MarketOpenTime` | "09:15" | Market open (IST) |
| `MarketData.MarketCloseTime` | "15:30" | Market close (IST) |
| `MarketData.Timezone` | "India Standard Time" | Windows TZ ID |
| `MarketData.ApiCallDelayMs` | 500 | Rate limit delay between NSE calls |
| `MarketData.NseQuoteRetries` | 2 | NSE quote retry count |
| `MarketData.YahooQuoteRetries` | 2 | Yahoo retry count |
| `MarketData.BhavcopyCacheMinutes` | 30 | Bhavcopy CSV cache TTL |
| `MarketData.QuoteFallbackMaxStalenessHours` | 72 | Max age of bhavcopy fallback quote |
| `MarketData.UseSyntheticFallback` | true | Use synthetic data when all APIs fail |

### Watchlist
Default stocks: RELIANCE, TCS, INFY, HDFCBANK, ICICIBANK, SBIN, HINDUNILVR, ITC, KOTAKBANK, BHARTIARTL (10 stocks, max 15).

### Scheduling
| Key | Default | Description |
|-----|---------|-------------|
| `Scheduling.OvernightAnalysisTime` | "20:00" | Overnight signal generation time (IST) |
| `Scheduling.IntradayAnalysisIntervalMinutes` | 15 | Intraday generation frequency |
| `Scheduling.MarketDataRefreshIntervalMinutes` | 10 | Market data refresh |
| `Scheduling.OvernightSignalExpiryTime` | "10:00" | Overnight signals expire at this IST time |
| `Scheduling.IntradaySignalDurationHoursMin` | 3 | Min intraday signal lifetime |
| `Scheduling.IntradaySignalDurationHoursMax` | 6 | Max intraday signal lifetime |

---

## 9. Infrastructure — Docker / Deployment

**File**: `backend/docker-compose.yml`

Services:
- **`mongodb`**: `mongo:7.0`, port 27018 (host) → 27017 (container), persistent volume.
- **`mongo-express`**: DB admin UI at `http://localhost:8081` (no auth).

Connection string in `appsettings.json`:
```
mongodb://autotradeuser:autotradepass@localhost:27018/autotrade?authSource=autotrade
```
> Note: Docker compose does NOT configure the user/password. You must create the MongoDB user manually or change the connection string to not use auth.

**Backend**: ASP.NET Core, runs on port 3001 (Kestrel default in appsettings structure).  
**Frontend**: Vite dev server on port 5173.

---

## 10. Data-Flow Diagrams

### News Processing Flow
```
RSS Feeds (9 sources)
    │  every 5 min
    ▼
NewsAggregator.FetchAllSourcesAsync()
    │  List<RawArticle> (deduplicated by ContentHash)
    ▼
SentimentAnalyzer.AnalyzeArticleAsync(rawArticle)
    ├── LoughranMcDonaldAnalyzer → L-M score [-1,+1]
    ├── HeadlineHeuristicAnalyzer → headline score [-1,+1]
    └── Blend → SentimentScore{positive,negative,neutral,overall,confidence}
    │  ProcessedArticle
    ▼
StockMapper.MapAsync(processedArticle)
    └── AhoCorasickStockMatcher.FindMentionedStocks(text)
        └── Scan O(n) → [NSE symbols]
    │  MappedArticle
    ▼
ArticleStorageService.UpsertArticleAsync()
    └── MongoDB articles collection (upsert on ContentHash)
```

### Signal Generation Flow
```
SignalSchedulerService (every 15min during market hours)
    │
    ▼
SignalGenerator.GenerateSignalsAsync(SignalType.Intraday)
    │
    ├── WatchlistManager.GetActiveStocksAsync() → [RELIANCE, TCS, ...]
    │
    └── Parallel.ForEachAsync (max 3 concurrent)
          │  for each symbol:
          ▼
          TechnicalAnalyzer.CalculateIndicatorsAsync(symbol)
              ├── MarketDataProvider.GetHistoricalDataAsync(symbol, 50) ← NSE/Yahoo/bhavcopy
              ├── MarketDataProvider.GetCurrentQuoteAsync(symbol)
              └── Calculate EMA20, RSI14, MACD, VolumeRatio, TechnicalScore
          │
          ▼
          SentimentProvider.GetLatestSentimentAsync(symbol, 24h)
              └── SentimentAnalyzer.GetNewsSentimentAsync(symbol)
                  └── MongoDB: weighted avg of last-24h articles for symbol
          │
          ▼
          CalculateCombinedScore = tech*0.7 + sentiment*0.3
          │
          ├── EvaluateBuyConditions() → bool + rejection reasons
          └── EvaluateSellConditions() → bool + rejection reasons
          │
          ▼
          CreateSignalAsync(symbol, BUY/SELL, type, indicators, scores)
              ├── targetPrice = entryPrice × (1 + random(2%–5%))
              ├── stopLoss   = entryPrice × (1 - random(2%–3%))
              └── expiresAt  = for intraday: +3–6h; for overnight: next trading day 10:00 IST
          │
          ▼
          RiskManager.ValidateSignalWithReasonAsync(signal)
              ├── Active signals < 8
              ├── StopLoss % in [2%, 3%]
              ├── Target % in [2%, 5%]
              ├── R:R ≥ 1:1
              └── No duplicate for symbol in last 1h
          │ (if valid)
          ▼
          SignalStorage.SaveSignalAsync(signal)
              └── MongoDB signals collection
```

### Frontend Data Flow
```
User opens Dashboard
    │
    ├── useMarketStatus (30s) → GET /api/market/status
    ├── useNiftyIndex (30s)   → GET /api/market/index/nifty50
    ├── useSignals('active') (30s) → GET /api/signals/active
    ├── useWatchlist (30s)    → GET /api/watchlist
    └── useNews (60s)         → GET /api/news/latest
    
User clicks stock in Watchlist
    └── setSelectedStock(symbol)
        ├── StockChart re-renders → GET /api/market/history/{symbol}?days=30
        └── NewsFeed re-renders  → GET /api/news/by-stock/{symbol}
    
User clicks "⚡ Generate Signals"
    └── POST /api/signals/generate {type:"Intraday"}
        → triggers full signal generation pipeline
        → invalidates all signal queries → UI refreshes
    
User clicks "Execute" on a signal
    └── Opens SignalExecutionModal
        └── POST /api/signals/{id}/execute {entryPrice, targetPrice, stopLoss}
            → signal.status = "executed"
            → invalidates signal queries
```

---

## 11. Key Design Decisions & Gotchas

### 1. NSE API Requires Browser Headers
The NSE India API (`nseindia.com/api`) blocks server-side requests without a browser User-Agent. `NewsAggregator` and `NseStockRefreshService` both spoof: `Mozilla/5.0 (Macintosh/Windows...) AppleWebKit/537.36`.

### 2. Yahoo Finance Rate Limiting
Yahoo Finance enforces 429 errors. A 5-minute cooldown (`_yahooCooldownUntilUtc`) is set globally when a 429 is detected to prevent rapid retry loops.

### 3. Business Standard / NDTV Profit Disabled
These RSS feeds return 403 on server-side requests (Cloudflare protection). They are configured but `Enabled = false`. Re-enable if you have a proxy.

### 4. Synthetic Data Mode
When `UseSyntheticFallback = true` (default), the system generates deterministic fake prices/history when all real data sources fail. This is good for development/demo but must be disabled in production.

### 5. SimplIFied RSI
The current RSI implementation uses a simple average of the last 14 gains/losses, NOT Wilder's smoothed average. This produces slightly different values than industry-standard RSI. For production accuracy, implement the smoothed (Wilder) method.

### 6. MACD Uses Simplified Signal Line
The signal line is calculated from the last 9 MACD values computed from a sliding window of the closing prices. This is accurate but recomputes many EMAs — could be optimized by tracking running MACD history.

### 7. Target/Stop-Loss Are Randomized
Prices use `Random.NextDouble()` within the configured percentage ranges. This means each generation run produces slightly different stop-loss/target values for the same entry price. **If reproducibility matters**, replace with fixed midpoint values.

### 8. Signal Type Auto-Switch
`POST /api/signals/generate {type:"Intraday"}` automatically switches to Overnight if the market is closed. The response includes `effectiveType` and `effectiveTypeReason` to explain the switch.

### 9. `SignalAction` Enum Is Both String and Number
Due to .NET enum serialization and TypeScript types, `action` field may arrive as `"BUY"/"SELL"` (strings) or `0/1` (numbers). The frontend `normaliseAction()` helper handles both cases.

### 10. NSE Holiday List Needs Annual Update
`MarketDataProvider` has a hardcoded `_marketHolidays` HashSet with 2024 dates. **Add 2025 and 2026 holiday dates** to keep market open/closed detection accurate.

### 11. MongoDB Auth Not Configured in Docker
The `docker-compose.yml` doesn't set `MONGO_INITDB_ROOT_USERNAME` or create the `autotradeuser`. The connection string in `appsettings.json` expects this user to exist. Either create the user manually or use a connection string without credentials: `mongodb://localhost:27018/autotrade`.

### 12. Scoped vs Singleton Lifetime for Signal Services
`SignalGenerator`, `TechnicalAnalyzer`, etc. are `Scoped`. The background `SignalSchedulerService` (Singleton) resolves these by creating a new `IServiceScope` per run — correct pattern to avoid captive dependency bugs.

---

## 12. Future Phases — Planned Work

### Phase 4: Zerodha Kite API Integration (Designed, Not Implemented)
- OAuth flow: login → get request token → exchange for access token.
- `KiteClient.cs`: wraps KiteConnect NuGet package.
- Live price streaming via WebSocket (`KiteTicker`).
- Order placement infrastructure.
- Config: `ZERODHA_API_KEY`, `ZERODHA_API_SECRET`, redirect URL.

### Phase 5: Backtesting & Performance Tracking (Planned)
- Track signal outcomes (hit target / hit stop-loss / expired neutral).
- Historical performance dashboard.
- Signal accuracy metrics.

### TrendRadar MCP Integration (Referenced in Design Docs)
- `TrendRadarClient.cs`: connects to a TrendRadar MCP server for enhanced sentiment.
- Designed but not implemented. The current system uses its own L-M-based sentiment.

---

## 13. Quick-Reference: File → Purpose Map

### Backend

| File | Purpose |
|------|---------|
| `Program.cs` | DI wiring, middleware, startup |
| `appsettings.json` | All runtime configuration |
| `docker-compose.yml` | MongoDB container |
| `MongoDbContext.cs` | DB connection, collections, indexes |
| `NewsAggregator.cs` | RSS feed fetching, HTML cleaning, hashing |
| `LoughranMcDonaldAnalyzer.cs` | Financial sentiment word scoring + Indian phrases |
| `HeadlineHeuristicAnalyzer.cs` | Fast pattern-based headline scoring |
| `SentimentAnalyzer.cs` | Blends L-M + Headline, market categorization |
| `AhoCorasickStockMatcher.cs` | Multi-pattern stock mention detection |
| `StockMapper.cs` | Article → stock symbols mapping |
| `NewsProcessingService.cs` | Orchestrates full news pipeline |
| `ArticleStorageService.cs` | Article MongoDB CRUD |
| `NseStockRefreshService.cs` | NSE equity list seed & daily refresh |
| `MarketDataProvider.cs` | Live quotes + historical OHLC (NSE → Yahoo → Bhavcopy → Synthetic) |
| `TechnicalAnalyzer.cs` | EMA, RSI, MACD, Volume, TechnicalScore |
| `SentimentProvider.cs` | Thin wrapper to get sentiment for signal generation |
| `SignalGenerator.cs` | Core engine: combine scores, evaluate conditions, create signals |
| `RiskManager.cs` | Validate signal against risk rules |
| `SignalStorage.cs` | Signal MongoDB CRUD |
| `WatchlistManager.cs` | Returns configured watchlist stocks |
| `SignalSchedulerService.cs` | Background: schedule signal generation |
| `SignalsController.cs` | REST API: signals CRUD + generation |
| `MarketController.cs` | REST API: quotes, history, NIFTY50, market status |
| `NewsController.cs` | REST API: news, sentiment, search, sources |
| `WatchlistController.cs` | REST API: watchlist with live quotes |
| `HealthController.cs` | REST API: health check |
| `TradingSignalsConfig.cs` | Typed config POCO |
| `ArticleDocument.cs` | MongoDB article schema |
| `SignalDocument.cs` | MongoDB signal schema |
| `StockDocument.cs` | MongoDB stock schema |
| `SentimentScore.cs` | Sentiment result model |
| `LoughranMcDonaldResult.cs` | Raw L-M analysis result |
| `RawArticle.cs` | Unprocessed article model |
| `ProcessedArticle.cs` | Analyzed article model |
| `MarketCategory.cs` | Market sector enum |
| `data/nse-stocks.json` | Static NSE stock seed (fallback) |

### Frontend

| File | Purpose |
|------|---------|
| `App.tsx` | Root: QueryClient, ErrorBoundary, Toaster, Dashboard |
| `main.tsx` | ReactDOM entry point |
| `config/env.ts` | API URL from env vars |
| `types/api.ts` | All TypeScript types |
| `services/api.ts` | Axios client + all API functions |
| `hooks/queryKeys.ts` | Centralized React Query key constants |
| `hooks/useSignals.ts` | useSignals, useUpdateSignalStatus, useExecuteSignal |
| `hooks/useNews.ts` | useNews, useNewsByStock, useNewsSources, etc. |
| `hooks/useWatchlist.ts` | useWatchlist (30s refresh) |
| `hooks/useMarketStatus.ts` | useMarketStatus (30s refresh) |
| `hooks/useNiftyIndex.ts` | useNiftyIndex (30s refresh) |
| `hooks/useMarketHistory.ts` | useMarketHistory(symbol, days) |
| `hooks/useUserSettings.ts` | Notification toggle, signal strength threshold |
| `hooks/useTheme.ts` | DaisyUI dark/light theme with localStorage |
| `hooks/useHealth.ts` | useHealth |
| `hooks/useSignalHistory.ts` | useSignalHistory(params) |
| `components/Dashboard.tsx` | Main layout, tab switching, browser notifications |
| `components/Header.tsx` | Market status, NIFTY50, theme toggle |
| `components/SignalsPanel.tsx` | Signal table with tabs, generate button |
| `components/Watchlist.tsx` | Stock list with live prices/sentiment |
| `components/NewsFeed.tsx` | News for selected stock |
| `components/NewsTab.tsx` | Full news tab with search/filters/sentiment summary |
| `components/StockChart.tsx` | Recharts OHLC area chart |
| `components/Portfolio.tsx` | Executed signals tracker |
| `components/Settings.tsx` | Notification settings |
| `components/SignalExecutionModal.tsx` | Execute signal modal |
| `components/ErrorBoundary.tsx` | React error boundary |

---

*This document was generated by in-depth analysis of all source files. Last updated: 2026-06-07.*
