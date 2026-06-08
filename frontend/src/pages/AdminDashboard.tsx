import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type {
  AdminStats,
  UserDocument,
  TradingSignalsConfig,
  TradingSignal,
} from '../types/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import Tooltip from '../components/Tooltip';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Sliders,
  Activity,
  UserCheck,
  UserX,
  Trash2,
  Database,
  Save,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  BarChart2,
  Zap,
  ShieldCheck,
  Newspaper,
  LineChart as LineChartIcon,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

type AdminTab = 'overview' | 'users' | 'signals' | 'config';

// ─── Colour palette ─────────────────────────────────────────────────────────
const CHART_COLORS = {
  primary: '#8b5cf6',
  secondary: '#ec4899',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#06b6d4',
  neutral: '#64748b',
};

const DONUT_COLORS = [
  CHART_COLORS.success,
  CHART_COLORS.error,
  CHART_COLORS.primary,
  CHART_COLORS.neutral,
  CHART_COLORS.warning,
];

// ─── Sub-components ──────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  gradient: string;
  sub?: string;
}

function StatCard({ label, value, icon, gradient, sub }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl p-5 border border-base-300 shadow-sm"
      style={{ background: 'oklch(var(--b2))' }}
    >
      {/* gradient accent top-left */}
      <div
        className="absolute -top-6 -right-6 w-20 h-20 rounded-full opacity-20"
        style={{ background: gradient, filter: 'blur(16px)' }}
      />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider opacity-50 mb-1">{label}</p>
          <p className="text-3xl font-black tracking-tight">{value}</p>
          {sub && <p className="text-xs opacity-50 mt-1">{sub}</p>}
        </div>
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center opacity-90"
          style={{ background: gradient }}
        >
          {icon}
        </div>
      </div>
    </motion.div>
  );
}

// Custom tooltip for recharts
function ChartTooltipContent({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-base-300 border border-base-content/10 rounded-xl px-4 py-3 shadow-xl text-sm">
      <p className="font-bold mb-1 opacity-60">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<UserDocument[]>([]);
  const [config, setConfig] = useState<TradingSignalsConfig | null>(null);
  const [allSignals, setAllSignals] = useState<TradingSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Signals filter state
  const [sigFilter, setSigFilter] = useState({ status: 'all', action: 'all', type: 'all' });

  // ── Data loading ───────────────────────────────────────────────────────────

  const loadStats = async () => {
    try {
      const data = await api.admin.getStats();
      setStats(data);
    } catch (err: any) {
      toast.error('Failed to load system stats: ' + err.message);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await api.admin.getUsers();
      setUsers(data);
    } catch (err: any) {
      toast.error('Failed to load user list: ' + err.message);
    }
  };

  const loadConfig = async () => {
    try {
      const data = await api.admin.getConfig();
      setConfig(data);
    } catch (err: any) {
      toast.error('Failed to load config settings: ' + err.message);
    }
  };

  const loadSignals = async () => {
    try {
      const [active, history] = await Promise.allSettled([
        api.signals.active(),
        api.signals.history({}),
      ]);
      const activeList = active.status === 'fulfilled' ? active.value.signals : [];
      const histList = history.status === 'fulfilled' ? history.value.signals : [];
      // Merge + deduplicate by id
      const map = new Map<string, TradingSignal>();
      [...histList, ...activeList].forEach(s => map.set(s.id, s));
      setAllSignals(Array.from(map.values()).sort(
        (a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
      ));
    } catch (err: any) {
      // silent — signals are supplementary
    }
  };

  const initDashboard = async () => {
    setLoading(true);
    await Promise.all([loadStats(), loadUsers(), loadConfig(), loadSignals()]);
    setLoading(false);
  };

  useEffect(() => {
    initDashboard();
  }, []);

  // ── User actions ───────────────────────────────────────────────────────────

  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    if (userId === currentUser?.id) {
      toast.error('You cannot disable your own administrator account!');
      return;
    }
    try {
      await api.admin.toggleUserStatus(userId, !currentStatus);
      toast.success(`User ${currentStatus ? 'disabled' : 'enabled'} successfully`);
      await loadUsers();
      await loadStats();
    } catch (err: any) {
      toast.error('Failed to toggle status: ' + err.message);
    }
  };

  const handleRoleChange = async (userId: string, currentRole: string) => {
    if (userId === currentUser?.id) {
      toast.error('You cannot change your own administrator role!');
      return;
    }
    const nextRole = currentRole === 'Admin' ? 'User' : 'Admin';
    try {
      await api.admin.updateUserRole(userId, nextRole);
      toast.success(`User role updated to ${nextRole}`);
      await loadUsers();
    } catch (err: any) {
      toast.error('Failed to update role: ' + err.message);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === currentUser?.id) {
      toast.error('You cannot delete your own administrator account!');
      return;
    }
    if (!confirm('Permanently delete this user account? This cannot be undone.')) return;
    try {
      await api.admin.deleteUser(userId);
      toast.success('User account deleted');
      await loadUsers();
      await loadStats();
    } catch (err: any) {
      toast.error('Failed to delete user: ' + err.message);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setSaving(true);
    try {
      await api.admin.updateConfig(config);
      toast.success('Trading configuration saved and applied!');
      await loadConfig();
    } catch (err: any) {
      toast.error('Failed to save configuration: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Derived data for charts ────────────────────────────────────────────────

  const donutData = stats
    ? [
        { name: 'Active', value: stats.signalStats?.activeSignals ?? 0 },
        { name: 'Executed', value: stats.signalStats?.executedSignals ?? 0 },
        { name: 'BUY', value: stats.signalStats?.buySignals ?? 0 },
        { name: 'SELL', value: stats.signalStats?.sellSignals ?? 0 },
        { name: 'Expired', value: stats.signalStats?.expiredSignals ?? 0 },
      ].filter(d => d.value > 0)
    : [];

  const filteredSignals = allSignals.filter(s => {
    const actionStr = typeof s.action === 'number' ? (s.action === 0 ? 'BUY' : 'SELL') : String(s.action);
    const typeStr = typeof s.type === 'number' ? (s.type === 0 ? 'Overnight' : 'Intraday') : String(s.type);
    if (sigFilter.status !== 'all' && s.status !== sigFilter.status) return false;
    if (sigFilter.action !== 'all' && actionStr !== sigFilter.action) return false;
    if (sigFilter.type !== 'all' && typeStr !== sigFilter.type) return false;
    return true;
  });

  // ── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-base-100">
        <Header />
        <div className="flex flex-col items-center justify-center h-[calc(100vh-80px)] gap-4">
          <span className="loading loading-spinner loading-lg text-primary" />
          <p className="text-sm opacity-50">Loading admin dashboard…</p>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const TABS: { key: AdminTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: 'overview', label: 'Overview', icon: <Activity size={15} /> },
    { key: 'users', label: 'Users', icon: <Users size={15} />, badge: users.length },
    { key: 'signals', label: 'Signals & Trades', icon: <BarChart2 size={15} />, badge: allSignals.length },
    { key: 'config', label: 'Strategy Config', icon: <Sliders size={15} /> },
  ];

  return (
    <div className="min-h-screen bg-base-100 text-base-content">
      <Header />
      <div className="container mx-auto p-4 sm:p-6 max-w-7xl space-y-6">

        {/* ── Page Header ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-base-300 pb-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              Admin Panel
            </h1>
            <p className="text-sm opacity-50 mt-0.5">System analytics, user management & strategy configuration</p>
          </div>
          <button
            className="btn btn-outline btn-sm gap-2 rounded-xl"
            onClick={initDashboard}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* ── Tab Bar ── */}
        <div className="flex flex-wrap gap-2">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                activeTab === tab.key
                  ? 'bg-primary text-primary-content shadow-md'
                  : 'bg-base-200 text-base-content/70 hover:bg-base-300 hover:text-base-content'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.badge !== undefined && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.key ? 'bg-white/20' : 'bg-base-300'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* ══════════════════════════════════════════════════════════════════
              TAB 1 — OVERVIEW
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'overview' && stats && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              {/* ── Stat Cards Row 1 — Users ── */}
              <div>
                <h2 className="text-xs font-bold uppercase tracking-widest opacity-40 mb-3">👥 User Metrics</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard
                    label="Total Users"
                    value={stats.database.totalUsers}
                    icon={<Users size={22} className="text-white" />}
                    gradient="linear-gradient(135deg,#8b5cf6,#6d28d9)"
                    sub="All registered accounts"
                  />
                  <StatCard
                    label="Active Users"
                    value={stats.database.activeUsers}
                    icon={<UserCheck size={22} className="text-white" />}
                    gradient="linear-gradient(135deg,#22c55e,#16a34a)"
                    sub={`${stats.database.totalUsers > 0 ? Math.round((stats.database.activeUsers / stats.database.totalUsers) * 100) : 0}% of total`}
                  />
                  <StatCard
                    label="Admin Accounts"
                    value={users.filter(u => u.role === 'Admin').length}
                    icon={<ShieldCheck size={22} className="text-white" />}
                    gradient="linear-gradient(135deg,#f59e0b,#d97706)"
                    sub="With admin privileges"
                  />
                  <StatCard
                    label="Disabled Accounts"
                    value={users.filter(u => !u.isActive).length}
                    icon={<UserX size={22} className="text-white" />}
                    gradient="linear-gradient(135deg,#ef4444,#dc2626)"
                    sub="Blocked users"
                  />
                </div>
              </div>

              {/* ── Stat Cards Row 2 — Trading ── */}
              <div>
                <h2 className="text-xs font-bold uppercase tracking-widest opacity-40 mb-3">⚡ Signal & Trade Metrics</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard
                    label="Total Signals"
                    value={stats.database.totalSignals}
                    icon={<Zap size={22} className="text-white" />}
                    gradient="linear-gradient(135deg,#06b6d4,#0284c7)"
                    sub="All generated signals"
                  />
                  <StatCard
                    label="Executed Trades"
                    value={stats.database.executedSignals}
                    icon={<BarChart2 size={22} className="text-white" />}
                    gradient="linear-gradient(135deg,#ec4899,#db2777)"
                    sub="Signals acted upon"
                  />
                  <StatCard
                    label="Est. Avg Profit"
                    value={`${stats.signalStats?.estimatedProfitPercent ?? 0}%`}
                    icon={<TrendingUp size={22} className="text-white" />}
                    gradient="linear-gradient(135deg,#22c55e,#16a34a)"
                    sub="From executed signals"
                  />
                  <StatCard
                    label="News Articles"
                    value={stats.database.totalArticles}
                    icon={<Newspaper size={22} className="text-white" />}
                    gradient="linear-gradient(135deg,#8b5cf6,#7c3aed)"
                    sub="Indexed & processed"
                  />
                </div>
              </div>

              {/* ── Charts Row ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Line Chart — User Growth */}
                <div className="card bg-base-200 border border-base-300 shadow rounded-2xl">
                  <div className="card-body p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <LineChartIcon size={16} className="text-primary" />
                      <h3 className="font-bold text-base">User Registrations (Last 14 Days)</h3>
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={stats.userGrowth ?? []} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10, opacity: 0.5 }}
                          tickFormatter={d => d.slice(5)}
                        />
                        <YAxis tick={{ fontSize: 10, opacity: 0.5 }} allowDecimals={false} />
                        <RechartsTooltip content={<ChartTooltipContent />} />
                        <Line
                          type="monotone"
                          dataKey="count"
                          name="New Users"
                          stroke={CHART_COLORS.primary}
                          strokeWidth={2.5}
                          dot={{ r: 3, fill: CHART_COLORS.primary }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Bar Chart — Signals Per Day */}
                <div className="card bg-base-200 border border-base-300 shadow rounded-2xl">
                  <div className="card-body p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <BarChart2 size={16} className="text-secondary" />
                      <h3 className="font-bold text-base">Signals Generated (Last 14 Days)</h3>
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={stats.signalsPerDay ?? []} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10, opacity: 0.5 }}
                          tickFormatter={d => d.slice(5)}
                        />
                        <YAxis tick={{ fontSize: 10, opacity: 0.5 }} allowDecimals={false} />
                        <RechartsTooltip content={<ChartTooltipContent />} />
                        <Bar
                          dataKey="count"
                          name="Signals"
                          fill={CHART_COLORS.secondary}
                          radius={[4, 4, 0, 0]}
                          maxBarSize={32}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* ── Donut + Top Symbols Row ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Donut — Signal Breakdown */}
                <div className="card bg-base-200 border border-base-300 shadow rounded-2xl">
                  <div className="card-body p-5">
                    <h3 className="font-bold text-base mb-4">Signal Status Breakdown</h3>
                    {donutData.length > 0 ? (
                      <div className="flex items-center gap-4">
                        <ResponsiveContainer width="55%" height={200}>
                          <PieChart>
                            <Pie
                              data={donutData}
                              cx="50%"
                              cy="50%"
                              innerRadius={55}
                              outerRadius={80}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {donutData.map((_, i) => (
                                <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                              ))}
                            </Pie>
                            <RechartsTooltip content={<ChartTooltipContent />} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex-1 space-y-2">
                          {donutData.map((entry, i) => (
                            <div key={entry.name} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full inline-block" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                                <span className="opacity-70">{entry.name}</span>
                              </div>
                              <span className="font-bold">{entry.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 opacity-40">No signal data yet</div>
                    )}

                    {/* BUY vs SELL mini stats */}
                    {stats.signalStats && (
                      <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-base-300">
                        <div className="text-center">
                          <div className="text-xs opacity-50 mb-1">Intraday</div>
                          <div className="text-xl font-black text-info">{stats.signalStats.intradaySignals}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs opacity-50 mb-1">Overnight</div>
                          <div className="text-xl font-black text-warning">{stats.signalStats.overnightSignals}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Top Symbols */}
                <div className="card bg-base-200 border border-base-300 shadow rounded-2xl">
                  <div className="card-body p-5">
                    <h3 className="font-bold text-base mb-4">Top Traded Symbols</h3>
                    {(stats.topSymbols ?? []).length > 0 ? (
                      <div className="space-y-3">
                        {stats.topSymbols.map((sym, i) => {
                          const pct = stats.database.totalSignals > 0
                            ? Math.round((sym.count / stats.database.totalSignals) * 100)
                            : 0;
                          return (
                            <div key={sym.symbol}>
                              <div className="flex items-center justify-between text-sm mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold opacity-40 w-4">{i + 1}</span>
                                  <span className="font-bold">{sym.symbol}</span>
                                  <span className="text-[10px] text-success font-semibold">▲{sym.buyCount}B</span>
                                  <span className="text-[10px] text-error font-semibold">▼{sym.sellCount}S</span>
                                </div>
                                <span className="font-bold text-primary">{sym.count}</span>
                              </div>
                              <div className="w-full h-1.5 bg-base-300 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${pct}%`,
                                    background: `linear-gradient(90deg, ${CHART_COLORS.primary}, ${CHART_COLORS.secondary})`,
                                    transition: 'width 0.5s ease',
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 opacity-40">No symbol data yet</div>
                    )}

                    {/* System Health Summary */}
                    <div className="mt-4 pt-4 border-t border-base-300">
                      <h4 className="text-xs font-bold uppercase tracking-wider opacity-40 mb-2">System Health</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {[
                          { label: 'Uptime', value: stats.health.uptime },
                          { label: 'Memory', value: `${stats.health.memoryUsageMB} MB` },
                          { label: 'CPU Cores', value: `${stats.health.processorCount}` },
                          { label: 'Environment', value: stats.health.environment },
                        ].map(item => (
                          <div key={item.label} className="bg-base-300 rounded-lg p-2">
                            <div className="opacity-50 mb-0.5">{item.label}</div>
                            <div className="font-bold truncate">{item.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Feed Health */}
              <div className="card bg-base-200 border border-base-300 shadow rounded-2xl">
                <div className="card-body p-5">
                  <h3 className="font-bold text-base mb-4">📡 RSS News Feed Health</h3>
                  <div className="overflow-x-auto">
                    <table className="table table-sm w-full">
                      <thead>
                        <tr>
                          <th>Feed Name</th>
                          <th>Status</th>
                          <th>HTTP Code</th>
                          <th>Last Checked</th>
                          <th>Last Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.feeds.map(feed => (
                          <tr key={feed.url}>
                            <td className="font-medium">{feed.name}</td>
                            <td>
                              <span className={`badge badge-sm font-bold ${feed.isHealthy ? 'badge-success' : 'badge-error'}`}>
                                {feed.isHealthy ? '✓ Healthy' : '✗ Error'}
                              </span>
                            </td>
                            <td className="font-mono">{feed.lastStatusCode || '—'}</td>
                            <td>
                              {feed.lastChecked !== 'Never'
                                ? new Date(feed.lastChecked).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                                : 'Never'}
                            </td>
                            <td className="text-xs text-error/80 truncate max-w-[200px]">
                              {feed.lastError || <span className="opacity-30">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 2 — USER MANAGEMENT
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'users' && (
            <motion.div
              key="users"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <div className="card bg-base-200 shadow border border-base-300 rounded-2xl">
                <div className="card-body p-5">
                  {/* Summary bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                    <h3 className="card-title text-xl">Registered Accounts</h3>
                    <div className="flex gap-2 flex-wrap text-xs font-semibold">
                      <span className="badge badge-neutral gap-1">
                        <Users size={11} /> {users.length} Total
                      </span>
                      <span className="badge badge-success gap-1">
                        <UserCheck size={11} /> {users.filter(u => u.isActive).length} Active
                      </span>
                      <span className="badge badge-secondary gap-1">
                        <ShieldCheck size={11} /> {users.filter(u => u.role === 'Admin').length} Admins
                      </span>
                      <span className="badge badge-error gap-1">
                        <UserX size={11} /> {users.filter(u => !u.isActive).length} Disabled
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="table table-zebra w-full text-sm">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Role</th>
                          <th>Status</th>
                          <th>Registered</th>
                          <th className="text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u, idx) => (
                          <tr key={u.id} className={u.id === currentUser?.id ? 'opacity-60' : ''}>
                            <td className="text-xs opacity-40 font-mono">{idx + 1}</td>
                            <td className="font-bold">{u.fullName}</td>
                            <td className="text-xs opacity-70">{u.email}</td>
                            <td>
                              <span className={`badge badge-sm font-bold ${u.role === 'Admin' ? 'badge-secondary' : 'badge-ghost'}`}>
                                {u.role}
                              </span>
                            </td>
                            <td>
                              <span className={`badge badge-sm font-semibold ${u.isActive ? 'badge-success' : 'badge-error'}`}>
                                {u.isActive ? 'Active' : 'Disabled'}
                              </span>
                            </td>
                            <td className="text-xs opacity-60">{new Date(u.createdAt).toLocaleDateString('en-IN')}</td>
                            <td className="text-right">
                              <div className="flex gap-1.5 justify-end items-center">
                                <Tooltip text={u.isActive ? 'Disable User' : 'Enable User'}>
                                  <button
                                    type="button"
                                    className={`btn btn-xs w-8 h-8 p-0 rounded-lg font-bold hover:scale-105 active:scale-95 transition-all duration-200 shadow-sm border ${
                                      u.isActive
                                        ? 'bg-base-300/50 hover:bg-error/20 hover:text-error hover:border-error/50 border-base-300 text-base-content/70'
                                        : 'bg-success/15 hover:bg-success hover:text-success-content border-success/30 hover:border-success text-success'
                                    }`}
                                    onClick={() => handleToggleStatus(u.id, u.isActive)}
                                    disabled={u.id === currentUser?.id}
                                  >
                                    {u.isActive ? <UserX size={13} /> : <UserCheck size={13} />}
                                  </button>
                                </Tooltip>

                                <Tooltip text={u.role === 'Admin' ? 'Demote to User' : 'Promote to Admin'}>
                                  <button
                                    type="button"
                                    className="btn btn-xs h-8 px-2.5 rounded-lg font-bold bg-secondary/15 hover:bg-secondary hover:text-secondary-content border border-secondary/35 hover:border-secondary text-secondary hover:scale-105 active:scale-95 transition-all duration-200 shadow-sm text-[11px] tracking-tight whitespace-nowrap"
                                    onClick={() => handleRoleChange(u.id, u.role)}
                                    disabled={u.id === currentUser?.id}
                                  >
                                    {u.role === 'Admin' ? '↓ User' : '↑ Admin'}
                                  </button>
                                </Tooltip>

                                <Tooltip text="Delete Account">
                                  <button
                                    type="button"
                                    className="btn btn-xs w-8 h-8 p-0 rounded-lg font-bold bg-error/15 hover:bg-error hover:text-error-content border border-error/30 hover:border-error text-error hover:scale-105 active:scale-95 transition-all duration-200 shadow-sm"
                                    onClick={() => handleDeleteUser(u.id)}
                                    disabled={u.id === currentUser?.id}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </Tooltip>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 3 — SIGNALS & TRADES TABLE
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'signals' && (
            <motion.div
              key="signals"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <div className="card bg-base-200 shadow border border-base-300 rounded-2xl">
                <div className="card-body p-5">
                  {/* Header + filters */}
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                    <div>
                      <h3 className="card-title text-xl">All Signals & Trades</h3>
                      <p className="text-xs opacity-50 mt-0.5">Showing {filteredSignals.length} of {allSignals.length} total</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {/* Status filter */}
                      <select
                        className="select select-sm bg-base-300 border-base-300 rounded-xl text-xs font-semibold"
                        value={sigFilter.status}
                        onChange={e => setSigFilter(f => ({ ...f, status: e.target.value }))}
                      >
                        <option value="all">All Status</option>
                        <option value="active">Active</option>
                        <option value="executed">Executed</option>
                        <option value="expired">Expired</option>
                      </select>
                      {/* Action filter */}
                      <select
                        className="select select-sm bg-base-300 border-base-300 rounded-xl text-xs font-semibold"
                        value={sigFilter.action}
                        onChange={e => setSigFilter(f => ({ ...f, action: e.target.value }))}
                      >
                        <option value="all">BUY + SELL</option>
                        <option value="BUY">BUY only</option>
                        <option value="SELL">SELL only</option>
                      </select>
                      {/* Type filter */}
                      <select
                        className="select select-sm bg-base-300 border-base-300 rounded-xl text-xs font-semibold"
                        value={sigFilter.type}
                        onChange={e => setSigFilter(f => ({ ...f, type: e.target.value }))}
                      >
                        <option value="all">All Types</option>
                        <option value="Intraday">Intraday</option>
                        <option value="Overnight">Overnight</option>
                      </select>
                    </div>
                  </div>

                  {filteredSignals.length === 0 ? (
                    <div className="text-center py-16 opacity-40">
                      <BarChart2 size={40} className="mx-auto mb-3 opacity-30" />
                      <p>No signals match your filters</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="table table-zebra table-sm w-full text-xs">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Symbol</th>
                            <th>Action</th>
                            <th>Type</th>
                            <th>Entry ₹</th>
                            <th>Target ₹</th>
                            <th>Stop Loss ₹</th>
                            <th>Strength</th>
                            <th>Status</th>
                            <th>Generated</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredSignals.map((s, idx) => {
                            const actionStr = typeof s.action === 'number'
                              ? (s.action === 0 ? 'BUY' : 'SELL')
                              : String(s.action);
                            const typeStr = typeof s.type === 'number'
                              ? (s.type === 0 ? 'Overnight' : 'Intraday')
                              : String(s.type);
                            const profitPct = actionStr === 'BUY'
                              ? ((s.targetPrice - s.entryPrice) / s.entryPrice * 100).toFixed(2)
                              : ((s.entryPrice - s.targetPrice) / s.entryPrice * 100).toFixed(2);

                            return (
                              <tr key={s.id}>
                                <td className="opacity-40 font-mono">{idx + 1}</td>
                                <td className="font-black">{s.symbol}</td>
                                <td>
                                  <span className={`badge badge-xs font-bold ${actionStr === 'BUY' ? 'badge-success' : 'badge-error'}`}>
                                    {actionStr === 'BUY' ? '▲' : '▼'} {actionStr}
                                  </span>
                                </td>
                                <td>
                                  <span className={`badge badge-xs ${typeStr === 'Intraday' ? 'badge-info' : 'badge-warning'}`}>
                                    {typeStr}
                                  </span>
                                </td>
                                <td className="font-mono">₹{s.entryPrice.toFixed(2)}</td>
                                <td className="font-mono text-success">
                                  ₹{s.targetPrice.toFixed(2)}
                                  <span className="text-[10px] opacity-60 ml-1">(+{profitPct}%)</span>
                                </td>
                                <td className="font-mono text-error">₹{s.stopLoss.toFixed(2)}</td>
                                <td>
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-12 h-1.5 bg-base-300 rounded-full overflow-hidden">
                                      <div
                                        className="h-full rounded-full"
                                        style={{
                                          width: `${Math.round(s.signalStrength * 100)}%`,
                                          background: s.signalStrength > 0.7
                                            ? CHART_COLORS.success
                                            : s.signalStrength > 0.4
                                            ? CHART_COLORS.warning
                                            : CHART_COLORS.error,
                                        }}
                                      />
                                    </div>
                                    <span className="text-[10px] opacity-60">{Math.round(s.signalStrength * 100)}%</span>
                                  </div>
                                </td>
                                <td>
                                  <span className={`badge badge-xs font-semibold ${
                                    s.status === 'active' ? 'badge-success' :
                                    s.status === 'executed' ? 'badge-info' : 'badge-neutral'
                                  }`}>
                                    {s.status === 'active' ? '● Active' :
                                     s.status === 'executed' ? '✓ Executed' : '○ Expired'}
                                  </span>
                                </td>
                                <td className="opacity-50">
                                  {new Date(s.generatedAt).toLocaleDateString('en-IN', {
                                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                                  })}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 4 — STRATEGY & RISK CONFIG
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'config' && config && (
            <motion.div
              key="config"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <form onSubmit={handleSaveConfig} className="space-y-6">

                {/* Signal Generation Settings */}
                <div className="card bg-base-200 shadow border border-base-300 rounded-2xl">
                  <div className="card-body p-5">
                    <h3 className="card-title text-xl border-b border-base-300 pb-3 mb-4">
                      ⚡ Signal Generation Settings
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {[
                        { label: 'Technical Weight', key: 'technicalWeight', path: ['signalGeneration', 'technicalWeight'] },
                        { label: 'Sentiment Weight', key: 'sentimentWeight', path: ['signalGeneration', 'sentimentWeight'] },
                        { label: 'Min Signal Strength', key: 'minimumSignalStrength', path: ['signalGeneration', 'minimumSignalStrength'] },
                        { label: 'Max Parallel Stocks', key: 'maxParallelStocks', path: ['signalGeneration', 'maxParallelStocks'] },
                      ].map(field => (
                        <div key={field.key} className="form-control">
                          <label className="label py-1">
                            <span className="label-text text-xs font-semibold uppercase tracking-wide opacity-60">{field.label}</span>
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            className="input input-sm bg-base-300 border-base-300 rounded-xl w-full"
                            value={(config.signalGeneration as any)[field.key] ?? ''}
                            onChange={e => setConfig(c => c ? {
                              ...c,
                              signalGeneration: {
                                ...c.signalGeneration,
                                [field.key]: parseFloat(e.target.value),
                              }
                            } : c)}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Buy Conditions */}
                    <h4 className="font-semibold text-sm mt-5 mb-3 text-success border-b border-base-300 pb-2">
                      ▲ BUY Signal Conditions
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      {[
                        { label: 'Min Sentiment', key: 'minSentiment' },
                        { label: 'RSI Min', key: 'rsiMin' },
                        { label: 'RSI Max', key: 'rsiMax' },
                        { label: 'Min Volume Ratio', key: 'minVolumeRatio' },
                      ].map(f => (
                        <div key={f.key} className="form-control">
                          <label className="label py-1"><span className="label-text text-[10px] uppercase opacity-60">{f.label}</span></label>
                          <input
                            type="number" step="0.01"
                            className="input input-xs bg-base-300 border-base-300 rounded-xl"
                            value={(config.signalGeneration.buyConditions as any)[f.key] ?? ''}
                            onChange={e => setConfig(c => c ? {
                              ...c,
                              signalGeneration: {
                                ...c.signalGeneration,
                                buyConditions: {
                                  ...c.signalGeneration.buyConditions,
                                  [f.key]: parseFloat(e.target.value)
                                }
                              }
                            } : c)}
                          />
                        </div>
                      ))}
                      <div className="form-control">
                        <label className="label py-1"><span className="label-text text-[10px] uppercase opacity-60">Above EMA</span></label>
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm checkbox-success mt-2"
                          checked={config.signalGeneration.buyConditions.requirePriceAboveEma}
                          onChange={e => setConfig(c => c ? {
                            ...c,
                            signalGeneration: {
                              ...c.signalGeneration,
                              buyConditions: { ...c.signalGeneration.buyConditions, requirePriceAboveEma: e.target.checked }
                            }
                          } : c)}
                        />
                      </div>
                      <div className="form-control">
                        <label className="label py-1"><span className="label-text text-[10px] uppercase opacity-60">MACD Bullish</span></label>
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm checkbox-success mt-2"
                          checked={config.signalGeneration.buyConditions.requireMacdBullish}
                          onChange={e => setConfig(c => c ? {
                            ...c,
                            signalGeneration: {
                              ...c.signalGeneration,
                              buyConditions: { ...c.signalGeneration.buyConditions, requireMacdBullish: e.target.checked }
                            }
                          } : c)}
                        />
                      </div>
                    </div>

                    {/* Sell Conditions */}
                    <h4 className="font-semibold text-sm mt-5 mb-3 text-error border-b border-base-300 pb-2">
                      ▼ SELL Signal Conditions
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      {[
                        { label: 'Max Sentiment', key: 'maxSentiment' },
                        { label: 'RSI Overbought', key: 'rsiOverbought' },
                        { label: 'Min Volume Ratio', key: 'minVolumeRatio' },
                      ].map(f => (
                        <div key={f.key} className="form-control">
                          <label className="label py-1"><span className="label-text text-[10px] uppercase opacity-60">{f.label}</span></label>
                          <input
                            type="number" step="0.01"
                            className="input input-xs bg-base-300 border-base-300 rounded-xl"
                            value={(config.signalGeneration.sellConditions as any)[f.key] ?? ''}
                            onChange={e => setConfig(c => c ? {
                              ...c,
                              signalGeneration: {
                                ...c.signalGeneration,
                                sellConditions: {
                                  ...c.signalGeneration.sellConditions,
                                  [f.key]: parseFloat(e.target.value)
                                }
                              }
                            } : c)}
                          />
                        </div>
                      ))}
                      <div className="form-control">
                        <label className="label py-1"><span className="label-text text-[10px] uppercase opacity-60">MACD Bearish</span></label>
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm checkbox-error mt-2"
                          checked={config.signalGeneration.sellConditions.requireMacdBearish}
                          onChange={e => setConfig(c => c ? {
                            ...c,
                            signalGeneration: {
                              ...c.signalGeneration,
                              sellConditions: { ...c.signalGeneration.sellConditions, requireMacdBearish: e.target.checked }
                            }
                          } : c)}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Risk Management */}
                <div className="card bg-base-200 shadow border border-base-300 rounded-2xl">
                  <div className="card-body p-5">
                    <h3 className="card-title text-xl border-b border-base-300 pb-3 mb-4">
                      🛡️ Risk Management Parameters
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                      {[
                        ['Max Concurrent Signals', 'maxConcurrentSignals'],
                        ['Position Size %', 'positionSizePercent'],
                        ['Stop Loss Min %', 'stopLossMinPercent'],
                        ['Stop Loss Max %', 'stopLossMaxPercent'],
                        ['Target Min %', 'targetMinPercent'],
                        ['Target Max %', 'targetMaxPercent'],
                        ['Min Risk:Reward', 'minRiskRewardRatio'],
                        ['Preferred Risk:Reward', 'preferredRiskRewardRatio'],
                      ].map(([label, key]) => (
                        <div key={key} className="form-control">
                          <label className="label py-1">
                            <span className="label-text text-[10px] font-semibold uppercase tracking-wide opacity-60">{label}</span>
                          </label>
                          <input
                            type="number" step="0.01"
                            className="input input-sm bg-base-300 border-base-300 rounded-xl"
                            value={(config.riskManagement as any)[key] ?? ''}
                            onChange={e => setConfig(c => c ? {
                              ...c,
                              riskManagement: {
                                ...c.riskManagement,
                                [key]: parseFloat(e.target.value)
                              }
                            } : c)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Scheduling */}
                <div className="card bg-base-200 shadow border border-base-300 rounded-2xl">
                  <div className="card-body p-5">
                    <h3 className="card-title text-xl border-b border-base-300 pb-3 mb-4">
                      🕐 Scheduling Configuration
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {[
                        ['Overnight Analysis Time', 'overnightAnalysisTime', 'text'],
                        ['Intraday Interval (min)', 'intradayAnalysisIntervalMinutes', 'number'],
                        ['Market Data Refresh (min)', 'marketDataRefreshIntervalMinutes', 'number'],
                        ['Overnight Expiry Time', 'overnightSignalExpiryTime', 'text'],
                        ['Intraday Min Duration (h)', 'intradaySignalDurationHoursMin', 'number'],
                        ['Intraday Max Duration (h)', 'intradaySignalDurationHoursMax', 'number'],
                      ].map(([label, key, type]) => (
                        <div key={key} className="form-control">
                          <label className="label py-1">
                            <span className="label-text text-[10px] font-semibold uppercase tracking-wide opacity-60">{label}</span>
                          </label>
                          <input
                            type={type as string}
                            step={type === 'number' ? '1' : undefined}
                            className="input input-sm bg-base-300 border-base-300 rounded-xl"
                            value={(config.scheduling as any)[key] ?? ''}
                            onChange={e => setConfig(c => c ? {
                              ...c,
                              scheduling: {
                                ...c.scheduling,
                                [key]: type === 'number' ? parseInt(e.target.value) : e.target.value
                              }
                            } : c)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={saving}
                    className="btn btn-primary rounded-xl gap-2 px-8 shadow-lg"
                  >
                    {saving ? (
                      <><span className="loading loading-spinner loading-xs" /> Saving…</>
                    ) : (
                      <><Save size={16} /> Save Configuration</>
                    )}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
