namespace AutoTrade.Domain.Models;

public class AdminStats
{
    public EnhancedDatabaseStats Database { get; set; } = new();
    public SignalStats SignalStats { get; set; } = new();
    public SystemHealthStats Health { get; set; } = new();
    public List<FeedStatusStats> Feeds { get; set; } = new();
    public List<TimeSeriesPoint> UserGrowth { get; set; } = new();
    public List<TimeSeriesPoint> SignalsPerDay { get; set; } = new();
    public List<TopSymbolEntry> TopSymbols { get; set; } = new();
}

public class EnhancedDatabaseStats
{
    public long TotalUsers { get; set; }
    public long ActiveUsers { get; set; }
    public long TotalSignals { get; set; }
    public long ExecutedSignals { get; set; }
    public long TotalArticles { get; set; }
    public long TotalStocks { get; set; }
}

public class SignalStats
{
    public long BuySignals { get; set; }
    public long SellSignals { get; set; }
    public long ActiveSignals { get; set; }
    public long ExpiredSignals { get; set; }
    public long ExecutedSignals { get; set; }
    public long IntradaySignals { get; set; }
    public long OvernightSignals { get; set; }
    public double EstimatedProfitPercent { get; set; }
}

public class TimeSeriesPoint
{
    public string Date { get; set; } = string.Empty;
    public int Count { get; set; }
}

public class TopSymbolEntry
{
    public string Symbol { get; set; } = string.Empty;
    public int Count { get; set; }
    public long BuyCount { get; set; }
    public long SellCount { get; set; }
}

public class SystemHealthStats
{
    public string Uptime { get; set; } = string.Empty;
    public string MemoryUsageMB { get; set; } = string.Empty;
    public int ProcessorCount { get; set; }
    public string OperatingSystem { get; set; } = string.Empty;
    public string Environment { get; set; } = string.Empty;
}

public class FeedStatusStats
{
    public string Name { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public bool IsHealthy { get; set; }
    public int LastStatusCode { get; set; }
    public string LastChecked { get; set; } = string.Empty;
    public string LastError { get; set; } = string.Empty;
}
