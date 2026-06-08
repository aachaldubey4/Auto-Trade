export interface Signal {
  id: string;
  stock: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  signalStrength: number;
  timestamp: string;
  reason: string;
}

export interface WatchlistStock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  sentiment: 'positive' | 'negative' | 'neutral';
  volume: number;
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  timestamp: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  relatedStocks: string[];
  url?: string;
}

export interface MarketStatus {
  isOpen: boolean;
  nifty50: number;
  nifty50Change: number;
  nifty50ChangePercent: number;
  lastRefresh: string;
}

export interface ChartData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const mockSignals: Signal[] = [
  {
    id: '1',
    stock: 'Reliance Industries',
    symbol: 'RELIANCE',
    type: 'BUY',
    entryPrice: 2456.50,
    targetPrice: 2530.00,
    stopLoss: 2400.00,
    signalStrength: 85,
    timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
    reason: 'Positive earnings news + Price above 20-EMA + Volume surge',
  },
  {
    id: '2',
    stock: 'TCS',
    symbol: 'TCS',
    type: 'BUY',
    entryPrice: 3850.75,
    targetPrice: 3970.00,
    stopLoss: 3770.00,
    signalStrength: 72,
    timestamp: new Date(Date.now() - 12 * 60000).toISOString(),
    reason: 'Strong technical breakout + Positive sector sentiment',
  },
  {
    id: '3',
    stock: 'Infosys',
    symbol: 'INFY',
    type: 'SELL',
    entryPrice: 1520.00,
    targetPrice: 1475.00,
    stopLoss: 1550.00,
    signalStrength: 68,
    timestamp: new Date(Date.now() - 18 * 60000).toISOString(),
    reason: 'Negative news sentiment + RSI overbought + Volume decline',
  },
  {
    id: '4',
    stock: 'HDFC Bank',
    symbol: 'HDFCBANK',
    type: 'BUY',
    entryPrice: 1680.25,
    targetPrice: 1730.00,
    stopLoss: 1645.00,
    signalStrength: 78,
    timestamp: new Date(Date.now() - 25 * 60000).toISOString(),
    reason: 'Regulatory clarity + Technical support bounce',
  },
  {
    id: '5',
    stock: 'ICICI Bank',
    symbol: 'ICICIBANK',
    type: 'BUY',
    entryPrice: 1125.50,
    targetPrice: 1160.00,
    stopLoss: 1100.00,
    signalStrength: 75,
    timestamp: new Date(Date.now() - 35 * 60000).toISOString(),
    reason: 'Strong quarterly results + Momentum indicator positive',
  },
];

export const mockWatchlist: WatchlistStock[] = [
  {
    symbol: 'RELIANCE',
    name: 'Reliance Industries',
    price: 2456.50,
    change: 45.30,
    changePercent: 1.88,
    sentiment: 'positive',
    volume: 12500000,
  },
  {
    symbol: 'TCS',
    name: 'Tata Consultancy Services',
    price: 3850.75,
    change: 28.50,
    changePercent: 0.75,
    sentiment: 'positive',
    volume: 8500000,
  },
  {
    symbol: 'INFY',
    name: 'Infosys',
    price: 1520.00,
    change: -15.25,
    changePercent: -0.99,
    sentiment: 'negative',
    volume: 12000000,
  },
  {
    symbol: 'HDFCBANK',
    name: 'HDFC Bank',
    price: 1680.25,
    change: 12.75,
    changePercent: 0.76,
    sentiment: 'positive',
    volume: 9500000,
  },
  {
    symbol: 'ICICIBANK',
    name: 'ICICI Bank',
    price: 1125.50,
    change: 8.25,
    changePercent: 0.74,
    sentiment: 'positive',
    volume: 11000000,
  },
  {
    symbol: 'BHARTIARTL',
    name: 'Bharti Airtel',
    price: 1250.00,
    change: -5.50,
    changePercent: -0.44,
    sentiment: 'neutral',
    volume: 7500000,
  },
];

export const mockNews: NewsItem[] = [
  {
    id: '1',
    title: 'Reliance Industries reports strong Q3 earnings, beats estimates',
    source: 'Economic Times',
    timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
    sentiment: 'positive',
    relatedStocks: ['RELIANCE'],
  },
  {
    id: '2',
    title: 'IT sector sees mixed signals as TCS gains while Infosys faces headwinds',
    source: 'Moneycontrol',
    timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
    sentiment: 'neutral',
    relatedStocks: ['TCS', 'INFY'],
  },
  {
    id: '3',
    title: 'Banking stocks rally on RBI policy clarity',
    source: 'Business Standard',
    timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
    sentiment: 'positive',
    relatedStocks: ['HDFCBANK', 'ICICIBANK'],
  },
  {
    id: '4',
    title: 'Infosys faces client concerns over project delays',
    source: 'LiveMint',
    timestamp: new Date(Date.now() - 60 * 60000).toISOString(),
    sentiment: 'negative',
    relatedStocks: ['INFY'],
  },
  {
    id: '5',
    title: 'Nifty 50 hits new high on strong global cues',
    source: 'NDTV Profit',
    timestamp: new Date(Date.now() - 75 * 60000).toISOString(),
    sentiment: 'positive',
    relatedStocks: [],
  },
];

export const mockMarketStatus: MarketStatus = {
  isOpen: true,
  nifty50: 22500.50,
  nifty50Change: 125.75,
  nifty50ChangePercent: 0.56,
  lastRefresh: new Date().toISOString(),
};

export const generateChartData = (symbol: string, hours: number = 6): ChartData[] => {
  const data: ChartData[] = [];
  const basePrice = mockWatchlist.find(s => s.symbol === symbol)?.price || 1000;
  const now = new Date();
  
  for (let i = hours; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 60 * 1000);
    const variation = (Math.random() - 0.5) * 0.02;
    const open = basePrice * (1 + variation);
    const close = open * (1 + (Math.random() - 0.5) * 0.01);
    const high = Math.max(open, close) * (1 + Math.random() * 0.005);
    const low = Math.min(open, close) * (1 - Math.random() * 0.005);
    
    data.push({
      time: time.toISOString(),
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: Math.floor(Math.random() * 1000000) + 500000,
    });
  }
  
  return data;
};
