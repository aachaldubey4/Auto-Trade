# Implementation Plan: Trading Signal Generation System

## Overview

This implementation plan breaks down the trading signal generation system into discrete coding tasks. The system will be built incrementally, starting with core infrastructure (market data, technical indicators), then signal generation logic, risk management, storage, scheduling, and finally API endpoints and frontend integration. Each task builds on previous work, with testing integrated throughout to catch errors early.

## Tasks

- [x] 1. Set up project structure and configuration
  - Create SignalGeneration folder under Services
  - Add configuration models for TradingSignals section in appsettings.json
  - Add FsCheck NuGet package for property-based testing
  - Create interfaces for all core components (IMarketDataProvider, ITechnicalAnalyzer, ISignalGenerator, IRiskManager, IWatchlistManager, ISignalStorage)
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 2. Implement Market Data Provider
  - [x] 2.1 Create MarketDataProvider service with NSE India API integration
    - Implement GetCurrentQuoteAsync using HttpClient
    - Implement GetHistoricalDataAsync for 50-day OHLC data
    - Add NSE API headers and cookie handling
    - _Requirements: 1.1, 1.3_
  
  - [x] 2.2 Add Yahoo Finance fallback with circuit breaker pattern
    - Install YahooFinanceApi NuGet package
    - Implement fallback logic when NSE API fails
    - Add symbol conversion (NSE → Yahoo format with .NS suffix)
    - _Requirements: 1.2_
  
  - [x] 2.3 Implement market data caching with IMemoryCache
    - Cache quotes for 1 minute
    - Cache historical data for 5 minutes
    - _Requirements: 1.4_
  
  - [x] 2.4 Implement market hours and holiday detection
    - Create IsMarketOpenAsync method (9:15 AM - 3:30 PM IST, Mon-Fri)
    - Create IsMarketHolidayAsync with NSE holiday list
    - _Requirements: 1.5, 1.6_
  
  - [ ]* 2.5 Write property test for market data caching
    - **Property 4: Market Data Caching**
    - **Validates: Requirements 1.4**
  
  - [ ]* 2.6 Write property test for market hours detection
    - **Property 5: Market Hours Detection**
    - **Validates: Requirements 1.5**
  
  - [ ]* 2.7 Write integration tests for API fallback
    - **Property 2: API Fallback on Failure**
    - **Validates: Requirements 1.2**

- [x] 3. Implement Technical Analyzer
  - [x] 3.1 Create TechnicalAnalyzer service with EMA calculation
    - Implement CalculateEma method with standard formula
    - Use multiplier = 2/(period+1)
    - Initialize with SMA for first value
    - _Requirements: 2.1_
  
  - [x] 3.2 Implement RSI-14 calculation
    - Calculate average gains and losses over 14 periods
    - Compute RS = Average Gain / Average Loss
    - Compute RSI = 100 - (100 / (1 + RS))
    - Ensure result is 0-100
    - _Requirements: 2.2_
  
  - [x] 3.3 Implement MACD calculation
    - Calculate MACD Line = EMA(12) - EMA(26)
    - Calculate Signal Line = EMA(9) of MACD Line
    - Calculate Histogram = MACD Line - Signal Line
    - _Requirements: 2.3_
  
  - [x] 3.4 Implement volume ratio calculation
    - Calculate 20-day average volume
    - Compute ratio = current volume / average volume
    - _Requirements: 2.4_
  
  - [x] 3.5 Implement technical score calculation with weighting
    - Calculate EMA score (price vs EMA-20)
    - Calculate RSI score (30-70 range optimal)
    - Calculate MACD score (bullish/bearish)
    - Calculate volume score (ratio thresholds)
    - Combine with equal weights (25% each)
    - Normalize to 0-100 scale
    - _Requirements: 2.5_
  
  - [ ]* 3.6 Write property test for EMA calculation accuracy
    - **Property 6: EMA Calculation Accuracy**
    - **Validates: Requirements 2.1**
  
  - [ ]* 3.7 Write property test for RSI bounds and calculation
    - **Property 7: RSI Bounds and Calculation**
    - **Validates: Requirements 2.2**
  
  - [ ]* 3.8 Write property test for MACD calculation accuracy
    - **Property 8: MACD Calculation Accuracy**
    - **Validates: Requirements 2.3**
  
  - [ ]* 3.9 Write property test for volume ratio calculation
    - **Property 9: Volume Ratio Calculation**
    - **Validates: Requirements 2.4**
  
  - [ ]* 3.10 Write property test for technical score normalization
    - **Property 10: Technical Score Normalization**
    - **Validates: Requirements 2.5**

- [x] 4. Checkpoint - Ensure technical indicators are working
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement Watchlist Manager
  - [x] 5.1 Create WatchlistManager service
    - Load watchlist from configuration
    - Implement GetActiveStocksAsync with filtering by IsEnabled
    - Support default stocks (RELIANCE, TCS, INFY, etc.)
    - _Requirements: 6.1, 6.2, 6.3_
  
  - [x] 5.2 Add volume threshold and priority filtering
    - Filter stocks by minimum volume
    - Sort by priority (High → Medium → Low)
    - _Requirements: 6.4, 6.5, 6.7_
  
  - [ ]* 5.3 Write property test for watchlist filtering
    - **Property 28: Watchlist Filtering by Enabled Status**
    - **Property 29: Volume Threshold Filtering**
    - **Validates: Requirements 6.6, 6.7**

- [x] 6. Implement Sentiment Provider
  - [x] 6.1 Create SentimentProvider service
    - Query MongoDB articles collection for last 24 hours
    - Filter by stock symbol
    - Average TrendRadar and Loughran-McDonald scores
    - Return normalized score 0-1
    - Handle missing sentiment (default to 0.5)
    - _Requirements: 3.1_

- [x] 7. Implement Risk Manager
  - [x] 7.1 Create RiskManager service with concurrent signal validation
    - Implement GetActiveSignalCountAsync
    - Validate count < 8 before allowing new signal
    - _Requirements: 4.1_
  
  - [x] 7.2 Implement position size calculation
    - Calculate position size = capital × 0.125
    - _Requirements: 4.3_
  
  - [x] 7.3 Implement stop-loss and target validation
    - Validate stop-loss is 2-3% from entry
    - Validate target is 2-5% from entry
    - Calculate risk-reward ratio
    - Ensure ratio >= 1:1
    - _Requirements: 4.4, 4.5, 4.6_
  
  - [x] 7.4 Implement duplicate signal prevention
    - Check for signals on same symbol within 6 hours
    - Reject duplicates
    - _Requirements: 4.7_
  
  - [x] 7.5 Implement intraday signal timing validation
    - Validate intraday signals only during market hours
    - _Requirements: 3.8_
  
  - [ ]* 7.6 Write property test for maximum concurrent signals
    - **Property 19: Maximum Concurrent Signals**
    - **Validates: Requirements 4.1**
  
  - [ ]* 7.7 Write property test for position size calculation
    - **Property 20: Position Size Calculation**
    - **Validates: Requirements 4.3**
  
  - [ ]* 7.8 Write property test for stop-loss validation
    - **Property 21: Stop-Loss Validation**
    - **Validates: Requirements 4.4**
  
  - [ ]* 7.9 Write property test for target price validation
    - **Property 22: Target Price Validation**
    - **Validates: Requirements 4.5**
  
  - [ ]* 7.10 Write property test for risk-reward ratio validation
    - **Property 23: Risk-Reward Ratio Validation**
    - **Validates: Requirements 4.6**
  
  - [ ]* 7.11 Write property test for duplicate signal prevention
    - **Property 24: Duplicate Signal Prevention**
    - **Validates: Requirements 4.7**

- [x] 8. Implement Signal Generator
  - [x] 8.1 Create SignalGenerator service with core orchestration
    - Implement GenerateSignalsAsync for all watchlist stocks
    - Implement GenerateSignalForStockAsync for single stock
    - Fetch technical indicators from TechnicalAnalyzer
    - Fetch sentiment score from SentimentProvider
    - _Requirements: 3.1_
  
  - [x] 8.2 Implement signal score calculation
    - Combine technical (70%) and sentiment (30%)
    - Calculate signal strength
    - _Requirements: 3.1_
  
  - [x] 8.3 Implement BUY signal condition evaluation
    - Check sentiment > 0.6
    - Check price > EMA-20
    - Check RSI 30-70
    - Check MACD bullish (histogram > 0)
    - Check volume ratio > 1.5
    - Check combined score > 70
    - _Requirements: 3.2_
  
  - [x] 8.4 Implement SELL signal condition evaluation
    - Check sentiment < 0.4
    - Check price < EMA-20 OR RSI > 70
    - Check MACD bearish (histogram < 0)
    - Check volume ratio > 2.0
    - Check combined score > 70
    - _Requirements: 3.3_
  
  - [x] 8.5 Implement price calculations
    - Set entry price = current market price
    - Calculate target price (2-5% from entry)
    - Calculate stop-loss (2-3% from entry)
    - Use Random for percentage within range
    - _Requirements: 3.4, 3.5, 3.6_
  
  - [x] 8.6 Implement overnight vs intraday signal logic
    - Overnight: use closing prices, expire at 10 AM next day
    - Intraday: use real-time prices, expire 3-6 hours from generation
    - _Requirements: 3.7, 3.8_
  
  - [x] 8.7 Integrate risk validation before signal creation
    - Call RiskManager.ValidateSignalAsync
    - Only create signal if validation passes
    - Log rejection reasons
    - _Requirements: 4.1, 4.4, 4.5, 4.6, 4.7_
  
  - [ ]* 8.8 Write property test for signal score weighting
    - **Property 11: Signal Score Weighting**
    - **Validates: Requirements 3.1**
  
  - [ ]* 8.9 Write property test for BUY signal conditions
    - **Property 12: BUY Signal Conditions**
    - **Validates: Requirements 3.2**
  
  - [ ]* 8.10 Write property test for SELL signal conditions
    - **Property 13: SELL Signal Conditions**
    - **Validates: Requirements 3.3**
  
  - [ ]* 8.11 Write property test for entry price assignment
    - **Property 14: Entry Price Assignment**
    - **Validates: Requirements 3.4**
  
  - [ ]* 8.12 Write property test for target price bounds
    - **Property 15: Target Price Bounds**
    - **Validates: Requirements 3.5**
  
  - [ ]* 8.13 Write property test for stop-loss bounds
    - **Property 16: Stop-Loss Bounds**
    - **Validates: Requirements 3.6**
  
  - [ ]* 8.14 Write property test for overnight signal data source
    - **Property 17: Overnight Signal Data Source**
    - **Validates: Requirements 3.7**
  
  - [ ]* 8.15 Write property test for intraday signal timing
    - **Property 18: Intraday Signal Timing and Data**
    - **Validates: Requirements 3.8**

- [x] 9. Checkpoint - Ensure signal generation is working
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement Signal Storage
  - [x] 10.1 Create SignalStorage service with MongoDB integration
    - Define TradingSignal MongoDB model with all fields
    - Implement SaveSignalAsync
    - Create indexes for performance (status, expiresAt, symbol, generatedAt)
    - _Requirements: 7.1, 7.2_
  
  - [x] 10.2 Implement signal query methods
    - Implement GetActiveSignalsAsync (status=active, expiresAt > now)
    - Implement GetOvernightSignalsAsync (type=Overnight)
    - Implement GetIntradaySignalsAsync (type=Intraday)
    - Implement GetSignalsBySymbolAsync
    - Implement GetHistoricalSignalsAsync with filtering
    - _Requirements: 7.5, 7.6_
  
  - [x] 10.3 Implement signal status updates
    - Implement UpdateSignalStatusAsync
    - Implement ExpireOldSignalsAsync (background task)
    - _Requirements: 7.3, 7.4_
  
  - [x] 10.4 Set expiration times based on signal type
    - Overnight: expires_at = 10:00 AM next trading day
    - Intraday: expires_at = generated_at + Random(3-6 hours)
    - _Requirements: 5.2, 5.4, 7.7_
  
  - [ ]* 10.5 Write property test for signal storage round-trip
    - **Property 30: Signal Storage Round-Trip**
    - **Validates: Requirements 7.1**
  
  - [ ]* 10.6 Write property test for signal schema completeness
    - **Property 31: Signal Schema Completeness**
    - **Validates: Requirements 7.2**
  
  - [ ]* 10.7 Write property test for active signal query filtering
    - **Property 33: Active Signal Query Filtering**
    - **Validates: Requirements 7.5**
  
  - [ ]* 10.8 Write property test for historical signal query filtering
    - **Property 34: Historical Signal Query Filtering**
    - **Validates: Requirements 7.6**
  
  - [ ]* 10.9 Write property test for overnight signal expiration
    - **Property 25: Overnight Signal Expiration**
    - **Validates: Requirements 5.2, 7.7**
  
  - [ ]* 10.10 Write property test for intraday signal expiration
    - **Property 26: Intraday Signal Expiration**
    - **Validates: Requirements 5.4**

- [x] 11. Implement Scheduler Service
  - [x] 11.1 Create SignalSchedulerService as BackgroundService
    - Implement ExecuteAsync with timer setup
    - Calculate next overnight time (8:00 PM IST daily)
    - Schedule intraday timer (every 15 minutes)
    - Schedule market data refresh timer (every 1 minute)
    - _Requirements: 5.1, 5.3, 5.5_
  
  - [x] 11.2 Implement overnight analysis job
    - Trigger at 8:00 PM IST
    - Call SignalGenerator.GenerateSignalsAsync(SignalType.Overnight)
    - Use previous day's closing prices
    - _Requirements: 5.1, 5.2_
  
  - [x] 11.3 Implement intraday analysis job
    - Trigger every 15 minutes during market hours
    - Check IsMarketOpenAsync before running
    - Call SignalGenerator.GenerateSignalsAsync(SignalType.Intraday)
    - Use real-time prices
    - _Requirements: 5.3, 5.4_
  
  - [x] 11.4 Implement market data refresh job
    - Trigger every 1 minute during market hours
    - Clear cache to force fresh data fetch
    - _Requirements: 5.5_
  
  - [x] 11.5 Add error handling and retry logic
    - Wrap all job executions in try-catch
    - Log errors with full context
    - Continue to next scheduled execution on failure
    - _Requirements: 5.7_
  
  - [ ]* 11.6 Write property test for scheduled job retry on failure
    - **Property 27: Scheduled Job Retry on Failure**
    - **Validates: Requirements 5.7**
  
  - [ ]* 11.7 Write integration tests for job scheduling
    - Test overnight job timing
    - Test intraday job timing
    - Test market data refresh timing

- [x] 12. Implement Signals Controller
  - [x] 12.1 Create SignalsController with GET endpoints
    - Implement GET /api/signals/active
    - Implement GET /api/signals/overnight
    - Implement GET /api/signals/intraday
    - Implement GET /api/signals/stock/{symbol}
    - Implement GET /api/signals/history with query parameters
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  
  - [x] 12.2 Implement POST endpoint for manual generation
    - Implement POST /api/signals/generate
    - Accept SignalType and optional symbol list
    - Trigger signal generation
    - Return generated signals
    - _Requirements: 8.6_
  
  - [x] 12.3 Add error handling and status codes
    - Return 400 for bad requests
    - Return 404 for not found
    - Return 500 for server errors
    - Include error messages in response
    - _Requirements: 8.7_
  
  - [x] 12.4 Ensure response completeness
    - Include all signal metadata in JSON
    - Format timestamps as ISO 8601
    - _Requirements: 8.8_
  
  - [ ]* 12.5 Write integration tests for API endpoints
    - Test GET /api/signals/active
    - Test GET /api/signals/overnight
    - Test GET /api/signals/intraday
    - Test GET /api/signals/stock/{symbol}
    - Test GET /api/signals/history
    - Test POST /api/signals/generate
  
  - [ ]* 12.6 Write property test for API error status codes
    - **Property 35: API Error Status Codes**
    - **Validates: Requirements 8.7**
  
  - [ ]* 12.7 Write property test for API response completeness
    - **Property 36: API Response Completeness**
    - **Validates: Requirements 8.8**

- [ ] 13. Checkpoint - Ensure backend is fully functional
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Update Frontend SignalsPanel Component
  - [ ] 14.1 Remove mock data from SignalsPanel
    - Delete all hardcoded signal arrays
    - Remove mock data generation functions
    - _Requirements: 9.6_
  
  - [ ] 14.2 Implement API integration
    - Add fetch call to /api/signals/active on component mount
    - Parse JSON response into signal objects
    - Update state with fetched signals
    - _Requirements: 9.1_
  
  - [ ] 14.3 Update signal display to show all metadata
    - Display signal_strength, entry_price, target_price, stop_loss
    - Display action (BUY/SELL) and symbol
    - Show technical_score and sentiment_score separately
    - _Requirements: 9.2, 9.3_
  
  - [ ] 14.4 Implement real-time polling
    - Poll /api/signals/active every 30 seconds during market hours
    - Poll every 5 minutes outside market hours
    - Use market hours detection (9:15 AM - 3:30 PM IST)
    - _Requirements: 9.4, 9.5_
  
  - [ ] 14.5 Add empty state handling
    - Display "No active signals" message when array is empty
    - Show loading state while fetching
    - _Requirements: 9.7_

- [ ] 15. Add Configuration Management
  - [ ] 15.1 Create configuration models
    - Create TradingSignalsConfig class
    - Create nested classes for SignalGeneration, RiskManagement, MarketData, Watchlist, Scheduling
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
  
  - [ ] 15.2 Add configuration to appsettings.json
    - Add TradingSignals section with all settings
    - Add Development and Production overrides
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
  
  - [ ] 15.3 Implement configuration loading in Startup
    - Bind configuration to TradingSignalsConfig
    - Register as singleton
    - Inject into services
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
  
  - [ ] 15.4 Add environment-specific overrides
    - Create appsettings.Development.json
    - Create appsettings.Production.json
    - Test override behavior
    - _Requirements: 10.5_
  
  - [ ] 15.5 Add configuration validation and defaults
    - Validate required settings on startup
    - Use safe defaults for missing values
    - Log warnings for invalid configuration
    - _Requirements: 10.6_
  
  - [ ]* 15.6 Write property test for environment-specific configuration
    - **Property 37: Environment-Specific Configuration**
    - **Validates: Requirements 10.5**
  
  - [ ]* 15.7 Write property test for configuration default fallback
    - **Property 38: Configuration Default Fallback**
    - **Validates: Requirements 10.6**

- [x] 16. Wire all components together in Startup
  - [x] 16.1 Register all services in dependency injection
    - Register IMarketDataProvider → MarketDataProvider
    - Register ITechnicalAnalyzer → TechnicalAnalyzer
    - Register ISignalGenerator → SignalGenerator
    - Register IRiskManager → RiskManager
    - Register IWatchlistManager → WatchlistManager
    - Register ISignalStorage → SignalStorage
    - Register ISentimentProvider → SentimentProvider
    - Register SignalSchedulerService as HostedService
  
  - [x] 16.2 Configure MongoDB connection for signals
    - Add signals collection to existing MongoDB database
    - Create indexes for performance
  
  - [x] 16.3 Configure HttpClient for market data APIs
    - Add HttpClient with retry policy
    - Configure timeouts and headers

- [x] 17. Final checkpoint - End-to-end testing
  - Ensure all tests pass, ask the user if questions arise.
  - Test overnight job execution
  - Test intraday job execution
  - Test signal generation with real market data
  - Test API endpoints return correct data
  - Test frontend displays signals correctly

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties using FsCheck
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end flows and external dependencies
- The system builds incrementally: infrastructure → core logic → storage → scheduling → API → frontend
