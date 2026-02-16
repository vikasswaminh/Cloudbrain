import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import {
  Users, Activity, TrendingUp, Heart, AlertTriangle, Zap, Box, Clock
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip
} from 'recharts';

interface DashboardStats {
  users: { total: number };
  executions: {
    total: number;
    completed: number;
    failed: number;
    running: number;
    today: number;
    successRate: number;
  };
  models: Array<{ name: string; count: number }>;
  recentExecutions: Array<any>;
  errors: Array<any>;
  sessions: {
    total: number;
    totalCommands: number;
    failedCommands: number;
    commandSuccessRate: number;
  };
}

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const res = await api.get('/admin/dashboard/stats');
      return res.data as DashboardStats;
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const { data: health } = useQuery({
    queryKey: ['system-health'],
    queryFn: async () => {
      const res = await api.get('/admin/dashboard/health');
      return res.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: telemetry } = useQuery({
    queryKey: ['telemetry'],
    queryFn: async () => {
      const res = await api.get('/admin/dashboard/telemetry');
      return res.data;
    },
    refetchInterval: 60000, // Refresh every minute
  });

  const { data: usage } = useQuery({
    queryKey: ['usage'],
    queryFn: async () => {
      const res = await api.get('/admin/dashboard/usage');
      return res.data;
    },
    refetchInterval: 60000,
  });

  if (isLoading) return <div className="p-8 text-white">Loading Dashboard...</div>;

  const successRate = stats?.executions.successRate || 0;

  return (
    <div className="p-8 space-y-8 bg-gray-900 min-h-screen">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
        <div className="text-sm text-gray-400">
          Auto-refresh: 10s • Last update: {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Users"
          value={stats?.users.total || 0}
          icon={<Users className="w-6 h-6" />}
          gradient="from-blue-500 to-blue-700"
        />

        <StatCard
          title="Executions Today"
          value={stats?.executions.today || 0}
          icon={<Activity className="w-6 h-6" />}
          gradient="from-purple-500 to-purple-700"
          subtitle={`${stats?.executions.running || 0} running now`}
        />

        <StatCard
          title="Success Rate (24h)"
          value={`${successRate.toFixed(1)}%`}
          icon={<TrendingUp className="w-6 h-6" />}
          gradient={successRate >= 80 ? "from-green-500 to-green-700" :
                    successRate >= 60 ? "from-yellow-500 to-yellow-700" :
                    "from-red-500 to-red-700"}
          subtitle={`${stats?.executions.completed}/${stats?.executions.total} completed`}
        />

        <StatCard
          title="System Health"
          value={health?.status === 'healthy' ? '✅ Healthy' :
                 health?.status === 'warning' ? '⚠️ Warning' : '❌ Degraded'}
          icon={<Heart className="w-6 h-6" />}
          gradient={health?.status === 'healthy' ? "from-green-500 to-green-700" :
                    health?.status === 'warning' ? "from-yellow-500 to-yellow-700" :
                    "from-red-500 to-red-700"}
        />
      </div>

      {/* Success Rate Bar */}
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Execution Success Rate (Last 24h)
        </h2>
        <div className="relative h-8 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              successRate >= 80 ? 'bg-green-500' :
              successRate >= 60 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${successRate}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-sm">
            {successRate.toFixed(1)}% ({stats?.executions.completed}/{stats?.executions.total})
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Model Usage Pie Chart */}
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Box className="w-5 h-5" />
            Model Usage Distribution (24h)
          </h2>
          {stats?.models && stats.models.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats.models}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(entry: any) => `${entry.name}: ${entry.count}`}
                >
                  {stats.models.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              No model usage data yet
            </div>
          )}
        </div>

        {/* CLI Sessions Stats */}
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5" />
            CLI Agent Statistics (24h)
          </h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-gray-700 rounded">
              <span className="text-gray-400">Total Sessions</span>
              <span className="text-2xl font-bold text-white">{stats?.sessions.total || 0}</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-gray-700 rounded">
              <span className="text-gray-400">Commands Executed</span>
              <span className="text-2xl font-bold text-white">{stats?.sessions.totalCommands || 0}</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-gray-700 rounded">
              <span className="text-gray-400">Command Success Rate</span>
              <span className={`text-2xl font-bold ${
                (stats?.sessions.commandSuccessRate || 0) >= 80 ? 'text-green-400' :
                (stats?.sessions.commandSuccessRate || 0) >= 60 ? 'text-yellow-400' :
                'text-red-400'
              }`}>
                {(stats?.sessions.commandSuccessRate || 0).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* FSM Telemetry & Token Usage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* FSM Telemetry */}
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h2 className="text-xl font-semibold text-white mb-4">
            CLI Telemetry Heatmap (Top Transitions)
          </h2>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {telemetry?.transitions && telemetry.transitions.length > 0 ? (
              telemetry.transitions.slice(0, 10).map((t: any, i: number) => (
                <div key={i} className="flex justify-between items-center text-sm p-2 bg-gray-700 rounded hover:bg-gray-600">
                  <span className="text-gray-300">{t.from_state} → {t.to_state}</span>
                  <span className="text-white font-mono font-bold">{t.count}</span>
                </div>
              ))
            ) : (
              <div className="text-gray-500 text-center py-8">No telemetry data yet</div>
            )}
          </div>
          {telemetry?.abortedSessions > 0 && (
            <div className="mt-4 p-3 bg-yellow-900/30 border border-yellow-500/50 rounded">
              <p className="text-yellow-400 text-sm">
                ⚠️ {telemetry.abortedSessions} aborted sessions (investigate dropoff)
              </p>
            </div>
          )}
        </div>

        {/* Token Usage */}
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Token Usage (24h)
          </h2>
          <div className="space-y-4">
            <div className="p-4 bg-gray-700 rounded">
              <div className="text-gray-400 text-sm mb-1">Total Tokens</div>
              <div className="text-3xl font-bold text-white">
                {(usage?.tokens.total || 0).toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Input: {(usage?.tokens.input || 0).toLocaleString()} •
                Output: {(usage?.tokens.output || 0).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-gray-400 text-sm mb-2">Top Users by Consumption</div>
              <div className="space-y-2">
                {usage?.topUsers && usage.topUsers.length > 0 ? (
                  usage.topUsers.slice(0, 5).map((user: any, i: number) => (
                    <div key={i} className="flex justify-between items-center text-sm p-2 bg-gray-700 rounded">
                      <span className="text-gray-300 truncate">{user.email}</span>
                      <span className="text-white font-mono">{user.total_tokens.toLocaleString()}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-gray-500 text-center py-4">No usage data yet</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Executions Stream */}
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Recent Executions (Real-time)
        </h2>
        <div className="space-y-3">
          {stats?.recentExecutions && stats.recentExecutions.length > 0 ? (
            stats.recentExecutions.map((exec: any) => (
              <div
                key={exec.id}
                className="flex items-center justify-between p-3 bg-gray-700 rounded hover:bg-gray-600 transition"
              >
                <div className="flex items-center space-x-4">
                  <div className={`w-3 h-3 rounded-full ${
                    exec.status === 'COMPLETED' ? 'bg-green-500' :
                    exec.status === 'FAILED' ? 'bg-red-500' :
                    'bg-blue-500 animate-pulse'
                  }`} />
                  <span className="text-white font-mono text-sm">
                    {exec.id.slice(0, 8)}...
                  </span>
                  <span className="text-gray-400 text-sm truncate max-w-[200px]">
                    {exec.email}
                  </span>
                  <span className="text-gray-500 text-xs">
                    {new Date(exec.created_at).toLocaleTimeString()}
                  </span>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-bold ${
                  exec.status === 'COMPLETED' ? 'bg-green-900 text-green-300' :
                  exec.status === 'FAILED' ? 'bg-red-900 text-red-300' :
                  'bg-blue-900 text-blue-300'
                }`}>
                  {exec.status}
                </span>
              </div>
            ))
          ) : (
            <div className="text-gray-500 text-center py-8">No recent executions</div>
          )}
        </div>
      </div>

      {/* System Health Details */}
      {health?.checks && health.checks.length > 0 && (
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Heart className="w-5 h-5" />
            System Health Checks
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {health.checks.map((check: any, i: number) => (
              <div key={i} className={`p-4 rounded border ${
                check.status === 'healthy' ? 'bg-green-900/20 border-green-500/50' :
                check.status === 'warning' ? 'bg-yellow-900/20 border-yellow-500/50' :
                'bg-red-900/20 border-red-500/50'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {check.status === 'healthy' ? '✅' :
                   check.status === 'warning' ? '⚠️' : '❌'}
                  <span className="text-white font-semibold">{check.component}</span>
                </div>
                <p className="text-sm text-gray-400">{check.message || check.error}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Log */}
      {stats?.errors && stats.errors.length > 0 && (
        <div className="bg-red-900/20 p-6 rounded-lg border border-red-500/50">
          <h2 className="text-xl font-semibold text-red-400 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Error Log (Last Hour)
          </h2>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {stats.errors.map((err: any, i: number) => (
              <div key={i} className="text-sm text-gray-300 p-2 bg-black/30 rounded font-mono">
                <span className="text-red-400">[{new Date(err.timestamp).toLocaleTimeString()}]</span>{' '}
                <span className="text-yellow-400">{err.event_type}</span>
                {err.payload && (
                  <div className="text-gray-500 text-xs mt-1 truncate">
                    {typeof err.payload === 'string' ? err.payload : JSON.stringify(err.payload)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper component for stat cards
function StatCard({ title, value, icon, gradient, subtitle }: any) {
  return (
    <div className={`bg-gradient-to-br ${gradient} p-6 rounded-lg shadow-lg`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-white/80 text-sm font-medium">{title}</h3>
        <div className="text-white/80">{icon}</div>
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
      {subtitle && <p className="text-white/60 text-xs mt-1">{subtitle}</p>}
    </div>
  );
}
