import axios, { AxiosError } from 'axios';
import { env } from '../config/env';
import type {
  ApiResponse,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  HealthResponse,
  MarketQuote,
  MarketStatus,
  NewsResponse,
  NiftyIndex,
  OhlcData,
  SentimentScore,
  SignalsResponse,
  ExecuteSignalRequest,
  UpdateSignalStatusRequest,
  UpdateSignalStatusResponse,
  WatchlistItem,
  FeedSource,
  StockSentiment,
  AdminStats,
  UserDocument,
  TradingSignalsConfig,
} from '../types/api';

export class ApiClientError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly details?: unknown;

  constructor(message: string, options: { code: string; status?: number; details?: unknown }) {
    super(message);
    this.name = 'ApiClientError';
    this.code = options.code;
    this.status = options.status;
    this.details = options.details;
  }
}

const client = axios.create({
  baseURL: env.apiUrl,
  timeout: env.apiTimeoutMs,
  headers: {
    Accept: 'application/json',
  },
});

const toClientError = (error: unknown): ApiClientError => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<unknown>;
    const status = axiosError.response?.status;
    const data = axiosError.response?.data;
    const messageFromPayload = (() => {
      if (typeof data !== 'object' || data == null) return null;
      const anyData = data as any;
      if (typeof anyData.error === 'string' && anyData.error.trim().length > 0) return anyData.error;
      if (typeof anyData.message === 'string' && anyData.message.trim().length > 0) return anyData.message;
      if (typeof anyData.error?.message === 'string' && anyData.error.message.trim().length > 0) return anyData.error.message;
      return null;
    })();
    const message = messageFromPayload ?? axiosError.message ?? 'Request failed';

    return new ApiClientError(message, {
      code: 'HTTP_ERROR',
      status,
      details: data,
    });
  }

  if (error instanceof Error) {
    return new ApiClientError(error.message, { code: 'UNKNOWN_ERROR', details: error });
  }

  return new ApiClientError('Unknown error', { code: 'UNKNOWN_ERROR', details: error });
};

const unwrapApiResponse = <T>(response: ApiResponse<T>, context: string): T => {
  if (!response.success) {
    throw new ApiClientError(response.error?.message ?? `${context} failed`, {
      code: response.error?.code ?? 'API_ERROR',
      details: response,
    });
  }
  if (response.data == null) {
    throw new ApiClientError(`${context} returned no data`, {
      code: 'EMPTY_RESPONSE',
      details: response,
    });
  }
  return response.data;
};

// ─── Axios Interceptors ───────────────────────────────────────────────────────

/**
 * REQUEST INTERCEPTOR: Attach JWT Access Token to every outgoing request.
 *
 * Flow:
 *   1. Read accessToken from localStorage
 *   2. If it exists, add 'Authorization: Bearer <token>' header
 *   3. Backend middleware validates this header
 *
 * This runs automatically before EVERY API call,
 * so no individual hook/component needs to handle token attachment.
 */
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * RESPONSE INTERCEPTOR: Handle 401 Unauthorized responses.
 *
 * When the access token expires (after 15 min), the server returns 401.
 * This interceptor catches that, silently refreshes the token,
 * and retries the original request — the user never sees an error.
 *
 * Flow:
 *   1. API call returns 401
 *   2. Interceptor calls POST /api/auth/refresh
 *      - Browser auto-sends httpOnly refreshToken cookie
 *   3. Gets new accessToken, saves to localStorage
 *   4. Retries original request with new token
 *   5. If refresh also fails → redirect to /login
 */
let isRefreshing = false;

client.interceptors.response.use(
  // Success: pass response through unchanged
  (response) => response,

  // Error: check if it's a 401 and try to refresh
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      // Prevent infinite refresh loop
      if (isRefreshing) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Try to get a new access token using the refresh token cookie
        // (browser sends the httpOnly cookie automatically)
        const { data } = await client.post<AuthResponse>('/auth/refresh');
        const newToken = data.accessToken!;

        // Save the new token
        localStorage.setItem('accessToken', newToken);

        // Retry the original failed request with the new token
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        isRefreshing = false;
        return client(originalRequest);
      } catch {
        // Refresh token is also expired or invalid → force logout
        isRefreshing = false;
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export const api = {
  /**
   * Auth endpoints — login, register, logout, refresh.
   * These do NOT go through the error interceptor for 401 (they're the source of tokens).
   */
  auth: {
    async register(request: RegisterRequest): Promise<AuthResponse> {
      const { data } = await client.post<AuthResponse>('/auth/register', request);
      return data;
    },
    async login(request: LoginRequest): Promise<AuthResponse> {
      const { data } = await client.post<AuthResponse>('/auth/login', request);
      return data;
    },
    async refresh(): Promise<AuthResponse> {
      // Browser automatically sends the httpOnly refreshToken cookie
      const { data } = await client.post<AuthResponse>('/auth/refresh');
      return data;
    },
    async logout(): Promise<void> {
      await client.post('/auth/logout');
    },
    async me(): Promise<AuthResponse['user']> {
      const { data } = await client.get<{ user: AuthResponse['user']; success: boolean }>('/auth/me');
      return data.user;
    },
  },
  admin: {
    async getStats(): Promise<AdminStats> {
      const { data } = await client.get<AdminStats>('/admin/stats');
      return data;
    },
    async getUsers(): Promise<UserDocument[]> {
      const { data } = await client.get<UserDocument[]>('/admin/users');
      return data;
    },
    async toggleUserStatus(userId: string, isActive: boolean): Promise<void> {
      await client.put(`/admin/users/${encodeURIComponent(userId)}/status`, isActive, {
        headers: { 'Content-Type': 'application/json' },
      });
    },
    async updateUserRole(userId: string, role: string): Promise<void> {
      await client.put(`/admin/users/${encodeURIComponent(userId)}/role`, JSON.stringify(role), {
        headers: { 'Content-Type': 'application/json' },
      });
    },
    async deleteUser(userId: string): Promise<void> {
      await client.delete(`/admin/users/${encodeURIComponent(userId)}`);
    },
    async getConfig(): Promise<TradingSignalsConfig> {
      const { data } = await client.get<TradingSignalsConfig>('/admin/config');
      return data;
    },
    async updateConfig(newConfig: TradingSignalsConfig): Promise<void> {
      await client.put('/admin/config', newConfig);
    },
  },
  health: {
    async get(): Promise<HealthResponse> {
      try {
        const { data } = await client.get<ApiResponse<HealthResponse>>('/health');
        return unwrapApiResponse(data, 'Health');
      } catch (error) {
        throw toClientError(error);
      }
    },
  },
  market: {
    async status(): Promise<MarketStatus> {
      try {
        const { data } = await client.get<ApiResponse<MarketStatus>>('/market/status');
        return unwrapApiResponse(data, 'Market status');
      } catch (error) {
        throw toClientError(error);
      }
    },
    async nifty50(): Promise<NiftyIndex> {
      try {
        const { data } = await client.get<ApiResponse<NiftyIndex>>('/market/index/nifty50');
        return unwrapApiResponse(data, 'NIFTY 50');
      } catch (error) {
        throw toClientError(error);
      }
    },
    async quote(symbol: string): Promise<MarketQuote> {
      try {
        const { data } = await client.get<ApiResponse<MarketQuote>>(`/market/quote/${encodeURIComponent(symbol)}`);
        return unwrapApiResponse(data, 'Quote');
      } catch (error) {
        throw toClientError(error);
      }
    },
    async history(symbol: string, days: number): Promise<OhlcData[]> {
      try {
        const { data } = await client.get<ApiResponse<OhlcData[]>>(`/market/history/${encodeURIComponent(symbol)}`, {
          params: { days },
        });
        return unwrapApiResponse(data, 'History');
      } catch (error) {
        throw toClientError(error);
      }
    },
  },
  watchlist: {
    async get(): Promise<WatchlistItem[]> {
      try {
        const { data } = await client.get<ApiResponse<WatchlistItem[]>>('/watchlist');
        return unwrapApiResponse(data, 'Watchlist');
      } catch (error) {
        throw toClientError(error);
      }
    },
  },
  news: {
    async latest(params: {
      page?: number;
      limit?: number;
      stock?: string;
      sentiment?: string;
      hours?: number;
    }): Promise<{ response: NewsResponse; pagination?: ApiResponse<NewsResponse>['pagination'] }> {
      try {
        const { data } = await client.get<ApiResponse<NewsResponse>>('/news/latest', { params });
        return { response: unwrapApiResponse(data, 'Latest news'), pagination: data.pagination };
      } catch (error) {
        throw toClientError(error);
      }
    },
    async byStock(symbol: string, params: { page?: number; limit?: number } = {}): Promise<NewsResponse> {
      try {
        const { data } = await client.get<ApiResponse<NewsResponse>>(`/news/by-stock/${encodeURIComponent(symbol)}`, {
          params,
        });
        return unwrapApiResponse(data, 'News by stock');
      } catch (error) {
        throw toClientError(error);
      }
    },
    async sentiment(symbol: string): Promise<SentimentScore> {
      try {
        const { data } = await client.get<ApiResponse<SentimentScore>>(
          `/news/sentiment/${encodeURIComponent(symbol)}`,
        );
        return unwrapApiResponse(data, 'Sentiment');
      } catch (error) {
        throw toClientError(error);
      }
    },
    async search(query: string, params: { page?: number; limit?: number } = {}): Promise<NewsResponse> {
      try {
        const { data } = await client.get<ApiResponse<NewsResponse>>('/news/search', {
          params: { query, ...params },
        });
        return unwrapApiResponse(data, 'Search news');
      } catch (error) {
        throw toClientError(error);
      }
    },
    async process(): Promise<unknown> {
      try {
        const { data } = await client.post<ApiResponse<unknown>>('/news/process');
        return unwrapApiResponse(data, 'Process news');
      } catch (error) {
        throw toClientError(error);
      }
    },
    async sources(): Promise<FeedSource[]> {
      try {
        const { data } = await client.get<ApiResponse<FeedSource[]>>('/news/sources');
        return unwrapApiResponse(data, 'Feed sources');
      } catch (error) {
        throw toClientError(error);
      }
    },
    async sentimentSummary(): Promise<StockSentiment[]> {
      try {
        const { data } = await client.get<ApiResponse<StockSentiment[]>>('/news/sentiment-summary');
        return unwrapApiResponse(data, 'Sentiment summary');
      } catch (error) {
        throw toClientError(error);
      }
    },
  },
  signals: {
    async active(): Promise<SignalsResponse> {
      try {
        const { data } = await client.get<SignalsResponse>('/signals/active');
        if (!data.success) {
          throw new ApiClientError(data.error ?? 'Failed to load active signals', {
            code: 'API_ERROR',
            details: data,
          });
        }
        return data;
      } catch (error) {
        throw toClientError(error);
      }
    },
    async overnight(): Promise<SignalsResponse> {
      try {
        const { data } = await client.get<SignalsResponse>('/signals/overnight');
        if (!data.success) {
          throw new ApiClientError(data.error ?? 'Failed to load overnight signals', {
            code: 'API_ERROR',
            details: data,
          });
        }
        return data;
      } catch (error) {
        throw toClientError(error);
      }
    },
    async intraday(): Promise<SignalsResponse> {
      try {
        const { data } = await client.get<SignalsResponse>('/signals/intraday');
        if (!data.success) {
          throw new ApiClientError(data.error ?? 'Failed to load intraday signals', {
            code: 'API_ERROR',
            details: data,
          });
        }
        return data;
      } catch (error) {
        throw toClientError(error);
      }
    },
    async updateStatus(signalId: string, payload: UpdateSignalStatusRequest): Promise<UpdateSignalStatusResponse> {
      try {
        const { data } = await client.patch<UpdateSignalStatusResponse>(
          `/signals/${encodeURIComponent(signalId)}/status`,
          payload,
        );
        if (data?.error) {
          throw new ApiClientError(data.error, { code: 'API_ERROR', details: data });
        }
        return data;
      } catch (error) {
        throw toClientError(error);
      }
    },
    async execute(signalId: string, payload: ExecuteSignalRequest): Promise<UpdateSignalStatusResponse> {
      try {
        const { data } = await client.post<UpdateSignalStatusResponse>(
          `/signals/${encodeURIComponent(signalId)}/execute`,
          payload,
        );
        if (data?.error) {
          throw new ApiClientError(data.error, { code: 'API_ERROR', details: data });
        }
        return data;
      } catch (error) {
        throw toClientError(error);
      }
    },
    async history(params: {
      from?: string;
      to?: string;
      symbol?: string;
      action?: string;
      status?: string;
    }): Promise<SignalsResponse> {
      try {
        const { data } = await client.get<SignalsResponse>('/signals/history', { params });
        if (!data.success) {
          throw new ApiClientError(data.error ?? 'Failed to load signal history', {
            code: 'API_ERROR',
            details: data,
          });
        }
        return data;
      } catch (error) {
        throw toClientError(error);
      }
    },
    async generate(type: 'Intraday' | 'Overnight' = 'Intraday'): Promise<SignalsResponse> {
      try {
        const { data } = await client.post<SignalsResponse>('/signals/generate', { type }, { timeout: 120_000 });
        return data;
      } catch (error) {
        throw toClientError(error);
      }
    },
  },
};
