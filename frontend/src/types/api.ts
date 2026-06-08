export type ApiErrorCode = string;

export interface ErrorInfo {
  code: ApiErrorCode;
  message: string;
  details?: string | null;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T | null;
  pagination?: PaginationInfo | null;
  error?: ErrorInfo | null;
  timestamp: string;
}

export type MarketCategory = number;

export interface SentimentScore {
  positive: number;
  negative: number;
  neutral: number;
  overall: 'positive' | 'negative' | 'neutral' | (string & {});
  confidence: number;
}

export interface RawArticle {
  title: string;
  content: string;
  url: string;
  publishedAt: string;
  source: string;
  contentHash: string;
}

export interface EntityData {
  type: string;
  text: string;
  confidence: number;
}

export interface ProcessedArticle extends RawArticle {
  sentiment: SentimentScore;
  keywords: string[];
  entities: EntityData[];
  marketCategory: MarketCategory;
  marketRelevance: number;
  processedAt: string;
}

export interface MappedArticle extends ProcessedArticle {
  stockSymbols: string[];
  isGeneralMarket: boolean;
}

export interface AppliedFilters {
  stock?: string | null;
  sentiment?: string | null;
  hours: number;
  category?: MarketCategory | null;
}

export interface NewsResponse {
  articles: MappedArticle[];
  totalCount: number;
  filters: AppliedFilters;
}

export type SignalAction = 'BUY' | 'SELL' | 0 | 1;
export type SignalType = 'Overnight' | 'Intraday' | 0 | 1;
export type SignalStatus = 'active' | 'expired' | 'executed' | (string & {});

export interface MacdResult {
  macdLine: number;
  signalLine: number;
  histogram: number;
  isBullish?: boolean;
}

export interface TechnicalIndicators {
  symbol: string;
  ema20: number;
  rsi14: number;
  macd: MacdResult;
  volumeRatio: number;
  currentPrice: number;
  technicalScore: number;
  calculatedAt: string;
}

export interface TradingSignal {
  id: string;
  symbol: string;
  action: SignalAction;
  signalStrength: number;
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  technicalScore: number;
  sentimentScore: number;
  indicators: TechnicalIndicators;
  generatedAt: string;
  expiresAt: string;
  type: SignalType;
  status: SignalStatus;
}

export interface SignalsResponse {
  success: boolean;
  signals: TradingSignal[];
  count: number;
  message?: string | null;
  error?: string | null;
  timestamp: string;
}

export interface UpdateSignalStatusRequest {
  status: SignalStatus;
}

export interface UpdateSignalStatusResponse {
  success?: boolean;
  message?: string;
  error?: string;
}

export interface ExecuteSignalRequest {
  entryPrice?: number;
  targetPrice?: number;
  stopLoss?: number;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  version: string;
  services: {
    newsProcessing: string;
    trendRadar: string;
  };
}

export interface MarketStatus {
  isOpen: boolean;
  timezone: string;
  serverTimeUtc: string;
  serverTimeIst: string;
  marketOpenTime: string;
  marketCloseTime: string;
}

export interface NiftyIndex {
  symbol: string;
  value: number;
  change: number;
  changePercent: number;
  timestamp: string;
}

export interface MarketQuote {
  symbol: string;
  lastPrice: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: string;
}

export interface OhlcData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface WatchlistItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  sentiment: 'positive' | 'negative' | 'neutral' | (string & {});
  volume: number;
}

export interface FeedSource {
  name: string;
  url: string;
  isHealthy: boolean;
  lastStatusCode: number;
  lastChecked: string | null;
  lastError: string | null;
}

export interface StockSentiment {
  symbol: string;
  score: number;       // -1 to +1 (positive minus negative)
  overall: string;     // 'positive' | 'negative' | 'neutral'
  confidence: number;  // 0 to 1
}

// ─── Auth Types ───────────────────────────────────────────────────────────────

/** Sent to POST /api/auth/login */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Sent to POST /api/auth/register */
export interface RegisterRequest {
  email: string;
  fullName: string;
  password: string;
  confirmPassword: string;
}

/** Safe user info returned from the server (no passwords, no tokens) */
export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

/** Returned by /api/auth/login, /api/auth/refresh, /api/auth/register */
export interface AuthResponse {
  success: boolean;
  accessToken?: string;   // JWT — store in localStorage, attach to every request
  user?: AuthUser;        // Display info for UI
  error?: string;         // Error message if success = false
}

// ─── Admin Dashboard Types ───────────────────────────────────────────────────

export interface EnhancedDatabaseStats {
  totalUsers: number;
  activeUsers: number;
  totalSignals: number;
  executedSignals: number;
  totalArticles: number;
  totalStocks: number;
}

export interface SignalStats {
  buySignals: number;
  sellSignals: number;
  activeSignals: number;
  expiredSignals: number;
  executedSignals: number;
  intradaySignals: number;
  overnightSignals: number;
  estimatedProfitPercent: number;
}

export interface TimeSeriesPoint {
  date: string;
  count: number;
}

export interface TopSymbolEntry {
  symbol: string;
  count: number;
  buyCount: number;
  sellCount: number;
}

export interface SystemHealthStats {
  uptime: string;
  memoryUsageMB: string;
  processorCount: number;
  operatingSystem: string;
  environment: string;
}

export interface FeedStatusStats {
  name: string;
  url: string;
  isHealthy: boolean;
  lastStatusCode: number;
  lastChecked: string;
  lastError: string;
}

export interface AdminStats {
  database: EnhancedDatabaseStats;
  signalStats: SignalStats;
  health: SystemHealthStats;
  feeds: FeedStatusStats[];
  userGrowth: TimeSeriesPoint[];
  signalsPerDay: TimeSeriesPoint[];
  topSymbols: TopSymbolEntry[];
}

export interface UserDocument {
  id: string;
  email: string;
  fullName: string;
  role: string;
  createdAt: string;
  isActive: boolean;
}

export interface TradingSignalsConfig {
  signalGeneration: {
    technicalWeight: number;
    sentimentWeight: number;
    minimumSignalStrength: number;
    maxParallelStocks: number;
    buyConditions: {
      minSentiment: number;
      requirePriceAboveEma: boolean;
      rsiMin: number;
      rsiMax: number;
      requireMacdBullish: boolean;
      minVolumeRatio: number;
    };
    sellConditions: {
      maxSentiment: number;
      requirePriceBelowEmaOrHighRsi: boolean;
      rsiOverbought: number;
      requireMacdBearish: boolean;
      minVolumeRatio: number;
    };
  };
  riskManagement: {
    maxConcurrentSignals: number;
    positionSizePercent: number;
    stopLossMinPercent: number;
    stopLossMaxPercent: number;
    targetMinPercent: number;
    targetMaxPercent: number;
    minRiskRewardRatio: number;
    preferredRiskRewardRatio: number;
    duplicateSignalWindowHours: number;
  };
  marketData: {
    primaryProvider: string;
    fallbackProvider: string;
    cacheDurationMinutes: number;
    nseApiUrl: string;
    marketOpenTime: string;
    marketCloseTime: string;
    timezone: string;
    apiCallDelayMs: number;
    nseQuoteRetries: number;
    yahooQuoteRetries: number;
    yahooRetryDelayMs: number;
    bhavcopyCacheMinutes: number;
    quoteFallbackMaxStalenessHours: number;
    watchlistQuoteParallelism: number;
    useSyntheticFallback: boolean;
  };
  watchlist: {
    maxStocks: number;
    defaultStocks: Array<{
      symbol: string;
      isEnabled: boolean;
      minimumVolume: number;
      priority: string;
    }>;
  };
  scheduling: {
    overnightAnalysisTime: string;
    intradayAnalysisIntervalMinutes: number;
    marketDataRefreshIntervalMinutes: number;
    overnightSignalExpiryTime: string;
    intradaySignalDurationHoursMin: number;
    intradaySignalDurationHoursMax: number;
  };
}
