# Requirements Document: Trading Signal Generation System

## Introduction

The Trading Signal Generation System is an intelligent trading signal engine that combines news sentiment analysis from the existing TrendRadar news integration with technical indicators to generate actionable BUY/SELL trading signals for NSE stocks. The system performs scheduled analysis (overnight at 8 PM IST and intraday every 15 minutes during market hours) and enforces strict risk management rules to ensure disciplined trading.

## Glossary

- **Signal_Generator**: The core system component that generates trading signals
- **Technical_Analyzer**: Component that calculates technical indicators (EMA, RSI, MACD, Volume)
- **Market_Data_Provider**: Service that fetches real-time and historical market data from NSE India API or Yahoo Finance
- **Risk_Manager**: Component that enforces risk management rules and validates signals
- **Scheduler**: Background service that triggers overnight and intraday analysis
- **Signal_Storage**: MongoDB repository for storing generated signals
- **Watchlist_Manager**: Component that manages the configurable list of stocks to monitor
- **Signal**: A trading recommendation containing action (BUY/SELL), entry price, target price, stop-loss, and metadata
- **Market_Hours**: Trading hours for NSE India (9:15 AM - 3:30 PM IST, Monday-Friday)
- **Overnight_Signal**: A signal generated at 8 PM for execution at market open (9:15 AM)
- **Intraday_Signal**: A signal generated during market hours for same-day execution
- **Signal_Strength**: Combined score (0-100) representing confidence in the signal
- **EMA**: Exponential Moving Average, a trend-following indicator
- **RSI**: Relative Strength Index, a momentum oscillator (0-100)
- **MACD**: Moving Average Convergence Divergence, a trend and momentum indicator
- **Liquid_Stock**: A stock with sufficient trading volume for reliable execution

## Requirements

### Requirement 1: Market Data Integration

**User Story:** As a trading system, I want to fetch real-time and historical market data from reliable sources, so that I can calculate accurate technical indicators and generate valid signals.

#### Acceptance Criteria

1. WHEN the Market_Data_Provider requests current market data for a stock, THE System SHALL fetch real-time quotes from NSE India API
2. WHEN the NSE India API is unavailable or returns an error, THE System SHALL fallback to Yahoo Finance API
3. WHEN historical OHLC data is requested, THE Market_Data_Provider SHALL retrieve the last 50 trading days of data
4. WHEN market data is fetched, THE System SHALL cache the data for 1 minute to minimize API calls
5. WHEN determining market status, THE System SHALL identify Market_Hours as 9:15 AM to 3:30 PM IST on weekdays (Monday-Friday)
6. WHEN a market holiday is detected, THE System SHALL skip intraday signal generation for that day

### Requirement 2: Technical Indicator Calculation

**User Story:** As a signal generator, I want to calculate accurate technical indicators, so that I can assess market conditions and trend strength.

#### Acceptance Criteria

1. WHEN calculating EMA-20, THE Technical_Analyzer SHALL compute the 20-period exponential moving average using the closing prices
2. WHEN calculating RSI-14, THE Technical_Analyzer SHALL compute the 14-period relative strength index with values between 0 and 100
3. WHEN calculating MACD, THE Technical_Analyzer SHALL compute the difference between 12-period and 26-period EMAs with a 9-period signal line
4. WHEN analyzing volume, THE Technical_Analyzer SHALL compare current volume to the 20-day average volume
5. WHEN computing technical scores, THE Technical_Analyzer SHALL weight indicators appropriately and normalize to a 0-100 scale
6. WHEN insufficient historical data exists (less than 50 days), THE Technical_Analyzer SHALL return an error and prevent signal generation

### Requirement 3: Signal Generation Logic

**User Story:** As a trader, I want the system to generate high-confidence BUY/SELL signals by combining technical and sentiment analysis, so that I can make informed trading decisions.

#### Acceptance Criteria

1. WHEN generating a signal, THE Signal_Generator SHALL combine technical scores (70% weight) with news sentiment scores (30% weight)
2. WHEN evaluating a BUY signal, THE Signal_Generator SHALL require sentiment > 0.6, price > EMA-20, RSI between 30-70, MACD bullish crossover, volume > 1.5x average, and combined score > 70
3. WHEN evaluating a SELL signal, THE Signal_Generator SHALL require sentiment < 0.4, price < EMA-20 OR RSI > 70, MACD bearish crossover, volume spike detected, and combined score > 70
4. WHEN a signal is generated, THE Signal_Generator SHALL calculate entry price as the current market price
5. WHEN calculating target price, THE Signal_Generator SHALL set it 2-5% above entry for BUY signals and 2-5% below entry for SELL signals
6. WHEN calculating stop-loss, THE Signal_Generator SHALL set it 2-3% below entry for BUY signals and 2-3% above entry for SELL signals
7. WHEN generating overnight signals, THE Signal_Generator SHALL use closing prices from the previous trading day
8. WHEN generating intraday signals, THE Signal_Generator SHALL use real-time market prices and only generate signals during Market_Hours

### Requirement 4: Risk Management Rules

**User Story:** As a risk manager, I want the system to enforce strict risk controls, so that trading capital is protected and diversification is maintained.

#### Acceptance Criteria

1. WHEN counting active signals, THE Risk_Manager SHALL enforce a maximum of 8 concurrent signals
2. WHEN a new signal would exceed the maximum, THE Risk_Manager SHALL reject the signal
3. WHEN calculating position size, THE Risk_Manager SHALL limit capital allocation to 12.5% per trade (100% / 8)
4. WHEN validating a signal, THE Risk_Manager SHALL ensure stop-loss is between 2-3% from entry price
5. WHEN validating a signal, THE Risk_Manager SHALL ensure target price is between 2-5% from entry price
6. WHEN calculating risk-reward ratio, THE Risk_Manager SHALL ensure minimum ratio of 1:1 and prefer 1:2
7. WHEN checking for duplicate signals, THE Risk_Manager SHALL prevent generating a signal for the same stock within 6 hours of the previous signal
8. WHEN validating intraday signals, THE Risk_Manager SHALL only allow generation during Market_Hours

### Requirement 5: Scheduled Analysis Jobs

**User Story:** As a system operator, I want automated scheduled jobs to run analysis at specific times, so that signals are generated consistently without manual intervention.

#### Acceptance Criteria

1. WHEN the overnight job executes, THE Scheduler SHALL trigger analysis daily at 8:00 PM IST
2. WHEN the overnight job runs, THE System SHALL analyze the previous trading day's data and generate Overnight_Signals for the next market open at 9:15 AM
3. WHEN the intraday job executes, THE Scheduler SHALL trigger analysis every 15 minutes during Market_Hours (9:15 AM - 3:30 PM IST)
4. WHEN the intraday job runs, THE System SHALL generate Intraday_Signals for same-day execution with 3-6 hour holding periods
5. WHEN market data refresh is needed, THE Scheduler SHALL update cached data every 1 minute during Market_Hours
6. WHEN the system starts, THE Scheduler SHALL initialize all scheduled jobs and verify timing configuration
7. WHEN a scheduled job fails, THE System SHALL log the error and retry on the next scheduled interval

### Requirement 6: Watchlist Configuration

**User Story:** As a system administrator, I want to configure which stocks to monitor, so that I can focus on liquid stocks with reliable trading characteristics.

#### Acceptance Criteria

1. WHEN initializing the watchlist, THE Watchlist_Manager SHALL load a configurable list of 10-15 Liquid_Stocks
2. WHEN no custom watchlist is provided, THE Watchlist_Manager SHALL use default stocks: RELIANCE, TCS, INFY, HDFCBANK, ICICIBANK, SBIN, HINDUNILVR, ITC, KOTAKBANK, BHARTIARTL
3. WHEN configuring a stock, THE Watchlist_Manager SHALL support enabling/disabling individual stocks
4. WHEN configuring a stock, THE Watchlist_Manager SHALL allow setting minimum volume thresholds
5. WHEN configuring a stock, THE Watchlist_Manager SHALL support priority levels (high, medium, low)
6. WHEN generating signals, THE Signal_Generator SHALL only analyze stocks that are enabled in the watchlist
7. WHEN a stock's volume falls below the minimum threshold, THE System SHALL skip signal generation for that stock

### Requirement 7: Signal Storage and Persistence

**User Story:** As a signal consumer, I want signals to be stored with complete metadata, so that I can track performance and analyze historical patterns.

#### Acceptance Criteria

1. WHEN a signal is generated, THE Signal_Storage SHALL persist it to MongoDB with all metadata including technical scores, news scores, indicator values, and timestamps
2. WHEN storing a signal, THE Signal_Storage SHALL include fields: symbol, action (BUY/SELL), signal_strength, entry_price, target_price, stop_loss, technical_score, sentiment_score, EMA, RSI, MACD, volume_ratio, generated_at, expires_at, status
3. WHEN a signal expires, THE Signal_Storage SHALL update the status field to "expired"
4. WHEN a signal is executed, THE Signal_Storage SHALL update the status field to "executed" with execution timestamp
5. WHEN querying active signals, THE Signal_Storage SHALL return only signals with status "active" and expires_at in the future
6. WHEN querying historical signals, THE Signal_Storage SHALL support filtering by date range, symbol, action, and status
7. WHEN storing overnight signals, THE Signal_Storage SHALL set expires_at to 10:00 AM IST the next trading day
8. WHEN storing intraday signals, THE Signal_Storage SHALL set expires_at to 3-6 hours from generation time

### Requirement 8: REST API Endpoints

**User Story:** As a frontend application, I want to access trading signals through REST API endpoints, so that I can display them to users in real-time.

#### Acceptance Criteria

1. WHEN a GET request is made to /api/signals/active, THE System SHALL return all active signals with status "active"
2. WHEN a GET request is made to /api/signals/overnight, THE System SHALL return signals generated by the overnight job
3. WHEN a GET request is made to /api/signals/intraday, THE System SHALL return signals generated during Market_Hours
4. WHEN a GET request is made to /api/signals/stock/{symbol}, THE System SHALL return all signals for the specified stock symbol
5. WHEN a GET request is made to /api/signals/history, THE System SHALL return historical signals with optional query parameters for filtering
6. WHEN a POST request is made to /api/signals/generate, THE System SHALL trigger manual signal generation for all watchlist stocks and return the results
7. WHEN an API request fails, THE System SHALL return appropriate HTTP status codes (400 for bad requests, 404 for not found, 500 for server errors)
8. WHEN returning signals, THE System SHALL include all signal metadata in JSON format

### Requirement 9: Frontend Integration

**User Story:** As a user, I want to see real trading signals in the frontend interface, so that I can act on trading opportunities.

#### Acceptance Criteria

1. WHEN the SignalsPanel component loads, THE System SHALL fetch active signals from the /api/signals/active endpoint
2. WHEN displaying a signal, THE SignalsPanel SHALL show signal_strength, entry_price, target_price, stop_loss, action, and symbol
3. WHEN displaying signal scores, THE SignalsPanel SHALL show technical_score and sentiment_score separately
4. WHEN Market_Hours are active, THE SignalsPanel SHALL poll the API every 30 seconds to refresh signals
5. WHEN Market_Hours are inactive, THE SignalsPanel SHALL poll the API every 5 minutes
6. WHEN removing mock data, THE System SHALL delete all hardcoded signal data and rely exclusively on API responses
7. WHEN no active signals exist, THE SignalsPanel SHALL display a message indicating no current opportunities

### Requirement 10: Configuration Management

**User Story:** As a system administrator, I want centralized configuration for all signal generation parameters, so that I can tune the system without code changes.

#### Acceptance Criteria

1. WHEN loading configuration, THE System SHALL read signal generation settings including score thresholds, weight percentages, and timing parameters
2. WHEN loading configuration, THE System SHALL read risk management rules including max_concurrent_signals, stop_loss_percentage, target_percentage, and min_risk_reward_ratio
3. WHEN loading configuration, THE System SHALL read market data provider settings including NSE API URL, Yahoo Finance fallback, and cache_duration
4. WHEN loading configuration, THE System SHALL read watchlist settings including default stocks, max_stocks, and refresh_interval
5. WHEN environment-specific overrides exist, THE System SHALL apply them based on the current environment (development, production)
6. WHEN configuration is invalid or missing, THE System SHALL use safe default values and log a warning
7. WHEN configuration is updated, THE System SHALL support hot-reloading without requiring application restart
