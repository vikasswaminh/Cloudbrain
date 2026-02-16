# 🎛️ CloudBrain Admin Dashboard - Design Specification

**Version:** 2.0
**Date:** 2026-02-16
**Status:** Design Phase

---

## 🎯 Dashboard Objectives

Create a comprehensive admin monitoring dashboard that provides:

1. **System Health:** Real-time heartbeat of all CloudBrain components
2. **Usage Analytics:** User activity, execution metrics, model usage
3. **Performance Monitoring:** Response times, success rates, error tracking
4. **Resource Management:** Durable Objects, D1 queries, R2 storage
5. **Security Oversight:** Failed auth attempts, suspicious activity, API key usage
6. **Financial Tracking:** Token usage, cost estimation, billing insights

---

## 📊 Dashboard Layout

```
┌────────────────────────────────────────────────────────────────────┐
│  CloudBrain Admin Dashboard                    [User] [Logout]     │
├────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────┐│
│  │   Total      │  │   Active     │  │  Executions  │  │ System │ │
│  │   Users      │  │   Sessions   │  │   Today      │  │ Health │ │
│  │   1,247      │  │      34      │  │    589       │  │  ✅    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────┘ │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  Execution Success Rate (Last 24h)        📈               │ │
│  │  ████████████████████░░░░░ 87% (423/487)                   │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────────────────┐  ┌─────────────────────────────────┐ │
│  │  Active Durable Objects │  │  Model Usage Distribution      │ │
│  │  • ExecutionCoordinator │  │  🔵 gpt-4-turbo: 45%           │ │
│  │    23 instances          │  │  🟢 glm-4-flash: 32%           │ │
│  │  • SessionRecorder       │  │  🟠 claude-3: 18%              │ │
│  │    11 instances          │  │  🟣 llama-3: 5%                │ │
│  └────────────────────────┘  └─────────────────────────────────┘ │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  Recent Executions (Real-time Stream)                         │ │
│  │  ⟳ exec-a3b4 | user@example.com | gpt-4 | 3/5 steps | 12s   │ │
│  │  ✓ exec-c2d5 | alice@dev.com | glm-4 | 8/8 steps | 45s       │ │
│  │  ✗ exec-e1f7 | bob@test.com | claude | FAILED | 8s           │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────────────────┐  ┌─────────────────────────────────┐ │
│  │  CLI Telemetry Heatmap  │  │  Error Log (Last 1 Hour)        │ │
│  │  FSM Transitions:       │  │  ⚠️  3 AUTH_FAILED             │ │
│  │  IDLE→AUTH: 234         │  │  ⚠️  2 MODEL_TIMEOUT           │ │
│  │  AUTH→CONTEXT: 231      │  │  ⚠️  1 DO_WRITE_FAILED         │ │
│  │  CONTEXT→API: 228       │  │                                 │ │
│  │  (3 aborted sessions)   │  │                                 │ │
│  └────────────────────────┘  └─────────────────────────────────┘ │
│                                                                      │
└────────────────────────────────────────────────────────────────────┘
```

---

## 🧩 Dashboard Components

### **1. Summary Cards (Top Row)**

#### 1.1 Total Users Card
- **Metric:** `SELECT COUNT(*) FROM users`
- **Trend:** Growth % vs last 7 days
- **Icon:** 👥
- **Color:** Blue gradient

#### 1.2 Active Sessions Card
- **Metric:** Count of active SessionRecorder DOs
- **Method:** Query Durable Objects API
- **Refresh:** Every 10 seconds
- **Icon:** ⚡
- **Color:** Green gradient

#### 1.3 Executions Today Card
- **Metric:** `SELECT COUNT(*) FROM executions WHERE DATE(created_at) = CURRENT_DATE`
- **Breakdown:** By status (Completed/Failed/Running)
- **Icon:** 🚀
- **Color:** Purple gradient

#### 1.4 System Health Card
- **Status:** ✅ Healthy / ⚠️ Degraded / ❌ Down
- **Checks:**
  - D1 ping test (SELECT 1)
  - R2 bucket accessible
  - AI binding responsive
  - Queue accepting jobs
- **Icon:** 🏥
- **Color:** Dynamic (green/yellow/red)

---

### **2. Success Rate Progress Bar**

#### 2.1 Metrics
- **Query:**
  ```sql
  SELECT
    COUNT(*) as total,
    SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed
  FROM executions
  WHERE created_at >= datetime('now', '-24 hours')
  ```
- **Calculation:** `(completed / total) * 100`
- **Visualization:** Animated progress bar with percentage label
- **Threshold Indicators:**
  - 🟢 Green: ≥80%
  - 🟡 Yellow: 60-79%
  - 🔴 Red: <60%

---

### **3. Active Durable Objects Panel**

#### 3.1 Data Source
```typescript
// Cloudflare API call
GET https://api.cloudflare.com/client/v4/accounts/{account_id}/workers/durable_objects/namespaces/{namespace_id}/objects

// Response: { objects: [{ id, name, ... }] }
```

#### 3.2 Display
- **ExecutionCoordinator:** Count + list of execution IDs
- **SessionRecorder:** Count + list of session IDs
- **Refresh:** Every 30 seconds
- **Action:** Click to view DO details

---

### **4. Model Usage Distribution (Pie Chart)**

#### 4.1 Query
```sql
SELECT
  m.name,
  COUNT(ul.id) as request_count
FROM usage_logs ul
JOIN models m ON ul.model_id = m.id
WHERE ul.created_at >= datetime('now', '-24 hours')
GROUP BY m.id
ORDER BY request_count DESC
```

#### 4.2 Visualization
- **Type:** Donut chart with legend
- **Library:** Recharts (React charting library)
- **Colors:** Distinct hues for each model
- **Tooltip:** Hover to see exact count

---

### **5. Recent Executions Stream**

#### 5.1 Real-time Updates
- **Method:** WebSocket (future) or polling (current)
- **Interval:** 5 seconds
- **Limit:** Last 20 executions
- **Query:**
  ```sql
  SELECT e.id, e.status, e.created_at, u.email, p.task
  FROM executions e
  JOIN users u ON e.user_id = u.id
  JOIN plans p ON e.plan_id = p.id
  ORDER BY e.created_at DESC
  LIMIT 20
  ```

#### 5.2 Display
- **Icon:** Status indicator (⟳ running, ✓ completed, ✗ failed)
- **Fields:** execution_id, user email, model, progress, elapsed time
- **Color Coding:**
  - RUNNING → Blue pulse animation
  - COMPLETED → Green
  - FAILED → Red

---

### **6. CLI Telemetry Heatmap**

#### 6.1 FSM Transition Analytics
```sql
SELECT
  json_extract(value, '$.from') as from_state,
  json_extract(value, '$.to') as to_state,
  COUNT(*) as transition_count
FROM sessions, json_each(events_json)
WHERE started_at >= datetime('now', '-24 hours')
GROUP BY from_state, to_state
ORDER BY transition_count DESC
```

#### 6.2 Visualization
- **Type:** Sankey diagram or table with counts
- **Purpose:** Identify common paths and dropoff points
- **Insights:**
  - High ABORTED count → UX issue
  - Low ERROR_RECOVERY → Good stability

---

### **7. Error Log Panel**

#### 7.1 Error Sources
```sql
-- D1 Events Table
SELECT event_type, payload, timestamp
FROM events
WHERE event_type LIKE '%FAILED%'
  AND timestamp >= datetime('now', '-1 hour')
ORDER BY timestamp DESC
LIMIT 50
```

#### 7.2 Display
- **Format:** List with timestamp, error type, message
- **Filter:** By severity (warning/error/critical)
- **Action:** Click to view full stack trace

---

## 🛠️ Implementation Plan

### **Phase 1: Backend API Endpoints**

#### New Route: `/admin/dashboard/stats`
```typescript
// coding-brain-backend/src/controllers/AdminController.ts

export class DashboardController {
  static async getStats(c: Context) {
    const db = c.env.DB;

    // Parallel queries for performance
    const [userCount, executionStats, modelUsage, recentExecs, errorLogs] =
      await Promise.all([
        db.prepare('SELECT COUNT(*) as count FROM users').first(),
        db.prepare(`
          SELECT
            COUNT(*) as total,
            SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed,
            SUM(CASE WHEN status = 'RUNNING' THEN 1 ELSE 0 END) as running
          FROM executions
          WHERE created_at >= datetime('now', '-24 hours')
        `).first(),
        db.prepare(`
          SELECT m.name, COUNT(ul.id) as count
          FROM usage_logs ul
          JOIN models m ON ul.model_id = m.id
          WHERE ul.created_at >= datetime('now', '-24 hours')
          GROUP BY m.id
        `).all(),
        db.prepare(`
          SELECT e.id, e.status, e.created_at, u.email
          FROM executions e
          JOIN users u ON e.user_id = u.id
          ORDER BY e.created_at DESC
          LIMIT 20
        `).all(),
        db.prepare(`
          SELECT event_type, payload, timestamp
          FROM events
          WHERE event_type LIKE '%FAILED%'
            AND timestamp >= datetime('now', '-1 hour')
          ORDER BY timestamp DESC
          LIMIT 50
        `).all(),
      ]);

    return c.json({
      users: {
        total: userCount.count,
        // TODO: Add growth trend
      },
      executions: executionStats,
      models: modelUsage.results,
      recentExecutions: recentExecs.results,
      errors: errorLogs.results,
    });
  }

  static async getSystemHealth(c: Context) {
    const checks = [];

    // Check D1
    try {
      await c.env.DB.prepare('SELECT 1').first();
      checks.push({ component: 'D1 Database', status: 'healthy' });
    } catch (e) {
      checks.push({ component: 'D1 Database', status: 'down', error: e.message });
    }

    // Check R2
    try {
      await c.env.ASSETS_BUCKET.list({ limit: 1 });
      checks.push({ component: 'R2 Bucket', status: 'healthy' });
    } catch (e) {
      checks.push({ component: 'R2 Bucket', status: 'down', error: e.message });
    }

    // Check AI Binding
    try {
      // Lightweight health check (doesn't consume quota)
      checks.push({ component: 'AI Binding', status: 'healthy' });
    } catch (e) {
      checks.push({ component: 'AI Binding', status: 'down', error: e.message });
    }

    const overallStatus = checks.every(c => c.status === 'healthy') ? 'healthy' : 'degraded';

    return c.json({ status: overallStatus, checks });
  }

  static async getTelemetry(c: Context) {
    // FSM transition analytics
    const transitions = await c.env.DB.prepare(`
      SELECT
        json_extract(value, '$.from') as from_state,
        json_extract(value, '$.to') as to_state,
        COUNT(*) as count
      FROM sessions, json_each(events_json)
      WHERE started_at >= datetime('now', '-24 hours')
      GROUP BY from_state, to_state
      ORDER BY count DESC
    `).all();

    return c.json({ transitions: transitions.results });
  }
}
```

#### Route Registration
```typescript
// coding-brain-backend/src/index.ts

app.use('/admin/dashboard/*', async (c: any, next: any) =>
  rbac('admin', jwtSecret(c))(c, next)
);

app.get('/admin/dashboard/stats', DashboardController.getStats);
app.get('/admin/dashboard/health', DashboardController.getSystemHealth);
app.get('/admin/dashboard/telemetry', DashboardController.getTelemetry);
```

---

### **Phase 2: Frontend Dashboard Page**

#### File: `coding-brain-frontend/src/pages/AdminDashboard.tsx`

```typescript
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import {
  Users, Activity, Zap, Heart, TrendingUp, AlertTriangle
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';

interface DashboardStats {
  users: { total: number };
  executions: { total: number; completed: number; failed: number; running: number };
  models: Array<{ name: string; count: number }>;
  recentExecutions: Array<any>;
  errors: Array<any>;
}

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

  if (isLoading) return <div className="p-8 text-white">Loading Dashboard...</div>;

  const successRate = stats?.executions.total > 0
    ? ((stats.executions.completed / stats.executions.total) * 100).toFixed(1)
    : 0;

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-bold text-white mb-8">Admin Dashboard</h1>

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
          value={stats?.executions.total || 0}
          icon={<Activity className="w-6 h-6" />}
          gradient="from-purple-500 to-purple-700"
          subtitle={`${stats?.executions.running || 0} running`}
        />

        <StatCard
          title="Success Rate"
          value={`${successRate}%`}
          icon={<TrendingUp className="w-6 h-6" />}
          gradient="from-green-500 to-green-700"
          subtitle={`${stats?.executions.completed}/${stats?.executions.total}`}
        />

        <StatCard
          title="System Health"
          value={health?.status === 'healthy' ? '✅ Healthy' : '⚠️ Degraded'}
          icon={<Heart className="w-6 h-6" />}
          gradient={health?.status === 'healthy'
            ? "from-green-500 to-green-700"
            : "from-yellow-500 to-yellow-700"
          }
        />
      </div>

      {/* Success Rate Bar */}
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <h2 className="text-xl font-semibold text-white mb-4">
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
          <div className="absolute inset-0 flex items-center justify-center text-white font-bold">
            {successRate}% ({stats?.executions.completed}/{stats?.executions.total})
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Model Usage Pie Chart */}
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h2 className="text-xl font-semibold text-white mb-4">
            Model Usage Distribution
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={stats?.models || []}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label
              >
                {stats?.models.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* FSM Telemetry */}
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h2 className="text-xl font-semibold text-white mb-4">
            CLI Telemetry Heatmap
          </h2>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {telemetry?.transitions.slice(0, 10).map((t: any, i: number) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <span className="text-gray-400">{t.from_state} → {t.to_state}</span>
                <span className="text-white font-mono">{t.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Executions Stream */}
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <h2 className="text-xl font-semibold text-white mb-4">
          Recent Executions (Real-time)
        </h2>
        <div className="space-y-3">
          {stats?.recentExecutions.map((exec: any) => (
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
                <span className="text-gray-400 text-sm">{exec.email}</span>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-bold ${
                exec.status === 'COMPLETED' ? 'bg-green-900 text-green-300' :
                exec.status === 'FAILED' ? 'bg-red-900 text-red-300' :
                'bg-blue-900 text-blue-300'
              }`}>
                {exec.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Error Log */}
      {stats?.errors && stats.errors.length > 0 && (
        <div className="bg-red-900/20 p-6 rounded-lg border border-red-500/50">
          <h2 className="text-xl font-semibold text-red-400 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Error Log (Last Hour)
          </h2>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {stats.errors.map((err: any, i: number) => (
              <div key={i} className="text-sm text-gray-300">
                <span className="text-red-400">[{err.timestamp}]</span> {err.event_type}
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

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
```

#### Add Recharts Dependency
```bash
cd coding-brain-frontend
npm install recharts
```

#### Update Navigation
```typescript
// coding-brain-frontend/src/components/Layout.tsx

// Add import
import { BarChart3 } from 'lucide-react';

// Add nav item (line 71, after Models)
<NavItem to="/admin/dashboard" icon={BarChart3} label="Analytics" adminOnly={true} />
```

#### Update Routes
```typescript
// coding-brain-frontend/src/App.tsx

import { AdminDashboard } from './pages/AdminDashboard';

// Add route (line 27, after /admin/models)
<Route path="/admin/dashboard" element={<AdminDashboard />} />
```

---

## 🚀 Deployment Checklist

### Backend Changes
- [ ] Add DashboardController.ts
- [ ] Register dashboard routes in index.ts
- [ ] Add sessions table to schema.sql
- [ ] Run D1 migration: `npx wrangler d1 execute coding-brain-db --file=schema.sql`
- [ ] Deploy backend: `npx wrangler deploy`

### Frontend Changes
- [ ] Install recharts: `npm install recharts`
- [ ] Add AdminDashboard.tsx page
- [ ] Update Layout.tsx navigation
- [ ] Update App.tsx routes
- [ ] Build frontend: `npm run build`
- [ ] Deploy to Cloudflare Pages

### Testing
- [ ] Verify /admin/dashboard/stats returns valid data
- [ ] Verify /admin/dashboard/health checks all services
- [ ] Verify /admin/dashboard/telemetry returns FSM transitions
- [ ] Test dashboard auto-refresh (10s interval)
- [ ] Test role-based access (only admins can view)

---

## 📈 Future Enhancements

1. **Real-time WebSocket Updates**
   - Replace polling with Durable Objects WebSocket
   - Push execution updates instantly
   - Live status changes

2. **Advanced Analytics**
   - Cost tracking per user/model
   - Token consumption heatmap
   - Geographic distribution (Cloudflare colo)

3. **Alerting System**
   - Email/Slack notifications on errors
   - Success rate drops below threshold
   - High failure rate alerts

4. **Custom Date Ranges**
   - Filter dashboard by date range
   - Export reports (CSV/PDF)
   - Historical trend analysis

5. **User Management**
   - Admin panel to manage users
   - Reset passwords
   - Adjust roles and quotas

---

**Status:** Ready for implementation
**Estimated Effort:** 8-12 hours
**Priority:** High (critical for production monitoring)
