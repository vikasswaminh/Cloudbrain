import { Context } from 'hono';

export class DashboardController {
    /**
     * GET /admin/dashboard/stats
     * Purpose: Get comprehensive dashboard statistics
     * Access: Admin only
     */
    static async getStats(c: Context) {
        const db = c.env.DB;

        try {
            // Execute all queries in parallel for performance
            const [
                userCount,
                executionStats,
                executionsToday,
                modelUsage,
                recentExecs,
                errorLogs,
                sessionStats
            ] = await Promise.all([
                // Total users
                db.prepare('SELECT COUNT(*) as count FROM users').first(),

                // Execution stats (last 24 hours)
                db.prepare(`
                    SELECT
                        COUNT(*) as total,
                        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
                        SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed,
                        SUM(CASE WHEN status = 'RUNNING' THEN 1 ELSE 0 END) as running
                    FROM executions
                    WHERE datetime(created_at) >= datetime('now', '-24 hours')
                `).first(),

                // Executions today (calendar day)
                db.prepare(`
                    SELECT COUNT(*) as count
                    FROM executions
                    WHERE date(created_at) = date('now')
                `).first(),

                // Model usage distribution (last 24 hours)
                db.prepare(`
                    SELECT
                        m.name,
                        m.id,
                        COUNT(ul.id) as count
                    FROM usage_logs ul
                    JOIN models m ON ul.model_id = m.id
                    WHERE datetime(ul.created_at) >= datetime('now', '-24 hours')
                    GROUP BY m.id
                    ORDER BY count DESC
                `).all(),

                // Recent executions (last 20)
                db.prepare(`
                    SELECT
                        e.id,
                        e.status,
                        e.created_at,
                        u.email,
                        p.task
                    FROM executions e
                    JOIN users u ON e.user_id = u.id
                    LEFT JOIN plans p ON e.plan_id = p.id
                    ORDER BY e.created_at DESC
                    LIMIT 20
                `).all(),

                // Error logs (last hour)
                db.prepare(`
                    SELECT
                        event_type,
                        payload,
                        timestamp
                    FROM events
                    WHERE event_type LIKE '%FAILED%'
                        AND datetime(timestamp) >= datetime('now', '-1 hour')
                    ORDER BY timestamp DESC
                    LIMIT 50
                `).all(),

                // Session statistics (last 24 hours)
                db.prepare(`
                    SELECT
                        COUNT(*) as total_sessions,
                        SUM(commands_executed) as total_commands,
                        SUM(commands_failed) as failed_commands
                    FROM sessions
                    WHERE datetime(started_at) >= datetime('now', '-24 hours')
                `).first()
            ]);

            // Calculate success rate
            const successRate = executionStats && executionStats.total > 0
                ? ((executionStats.completed / executionStats.total) * 100).toFixed(1)
                : '0';

            // Calculate command success rate
            const commandSuccessRate = sessionStats && sessionStats.total_commands > 0
                ? (((sessionStats.total_commands - sessionStats.failed_commands) / sessionStats.total_commands) * 100).toFixed(1)
                : '0';

            return c.json({
                users: {
                    total: userCount?.count || 0,
                },
                executions: {
                    total: executionStats?.total || 0,
                    completed: executionStats?.completed || 0,
                    failed: executionStats?.failed || 0,
                    running: executionStats?.running || 0,
                    today: executionsToday?.count || 0,
                    successRate: parseFloat(successRate),
                },
                models: modelUsage?.results || [],
                recentExecutions: recentExecs?.results || [],
                errors: errorLogs?.results || [],
                sessions: {
                    total: sessionStats?.total_sessions || 0,
                    totalCommands: sessionStats?.total_commands || 0,
                    failedCommands: sessionStats?.failed_commands || 0,
                    commandSuccessRate: parseFloat(commandSuccessRate),
                },
                timestamp: new Date().toISOString(),
            });
        } catch (e: any) {
            console.error('Dashboard stats error:', e);
            return c.json({ error: e.message }, 500);
        }
    }

    /**
     * GET /admin/dashboard/health
     * Purpose: System health checks for all CloudBrain components
     * Access: Admin only
     */
    static async getSystemHealth(c: Context) {
        const checks = [];
        let overallStatus = 'healthy';

        // Check 1: D1 Database
        try {
            await c.env.DB.prepare('SELECT 1').first();
            checks.push({
                component: 'D1 Database',
                status: 'healthy',
                message: 'Database responding'
            });
        } catch (e: any) {
            checks.push({
                component: 'D1 Database',
                status: 'down',
                error: e.message
            });
            overallStatus = 'degraded';
        }

        // Check 2: R2 Bucket
        try {
            await c.env.ASSETS_BUCKET.list({ limit: 1 });
            checks.push({
                component: 'R2 Bucket',
                status: 'healthy',
                message: 'Storage accessible'
            });
        } catch (e: any) {
            checks.push({
                component: 'R2 Bucket',
                status: 'down',
                error: e.message
            });
            overallStatus = 'degraded';
        }

        // Check 3: AI Binding (lightweight check)
        try {
            // Just check if binding exists
            if (c.env.AI) {
                checks.push({
                    component: 'AI Binding',
                    status: 'healthy',
                    message: 'Cloudflare AI binding available'
                });
            } else {
                throw new Error('AI binding not found');
            }
        } catch (e: any) {
            checks.push({
                component: 'AI Binding',
                status: 'down',
                error: e.message
            });
            overallStatus = 'degraded';
        }

        // Check 4: Durable Objects (check namespace availability)
        try {
            if (c.env.EXECUTION_COORDINATOR && c.env.SESSION_RECORDER) {
                checks.push({
                    component: 'Durable Objects',
                    status: 'healthy',
                    message: 'DO namespaces accessible'
                });
            } else {
                throw new Error('DO namespaces not found');
            }
        } catch (e: any) {
            checks.push({
                component: 'Durable Objects',
                status: 'down',
                error: e.message
            });
            overallStatus = 'degraded';
        }

        // Check 5: Queue
        try {
            if (c.env.EXECUTION_QUEUE) {
                checks.push({
                    component: 'Execution Queue',
                    status: 'healthy',
                    message: 'Queue binding available'
                });
            } else {
                throw new Error('Queue binding not found');
            }
        } catch (e: any) {
            checks.push({
                component: 'Execution Queue',
                status: 'down',
                error: e.message
            });
            overallStatus = 'degraded';
        }

        // Get recent error count for additional health indicator
        try {
            const recentErrors = await c.env.DB.prepare(`
                SELECT COUNT(*) as count
                FROM events
                WHERE event_type LIKE '%FAILED%'
                    AND datetime(timestamp) >= datetime('now', '-1 hour')
            `).first();

            checks.push({
                component: 'Error Rate',
                status: recentErrors.count > 10 ? 'warning' : 'healthy',
                message: `${recentErrors.count} errors in last hour`,
                count: recentErrors.count
            });

            if (recentErrors.count > 10 && overallStatus === 'healthy') {
                overallStatus = 'warning';
            }
        } catch (e: any) {
            // Non-fatal, skip
        }

        return c.json({
            status: overallStatus,
            checks,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * GET /admin/dashboard/telemetry
     * Purpose: CLI FSM telemetry analytics
     * Access: Admin only
     */
    static async getTelemetry(c: Context) {
        const db = c.env.DB;

        try {
            // FSM transition analytics (last 24 hours)
            const transitions = await db.prepare(`
                SELECT
                    json_extract(value, '$.from') as from_state,
                    json_extract(value, '$.to') as to_state,
                    COUNT(*) as count
                FROM sessions, json_each(events_json)
                WHERE datetime(started_at) >= datetime('now', '-24 hours')
                GROUP BY from_state, to_state
                ORDER BY count DESC
                LIMIT 50
            `).all();

            // Count aborted sessions
            const abortedSessions = await db.prepare(`
                SELECT COUNT(*) as count
                FROM sessions
                WHERE final_state = 'ABORTED'
                    AND datetime(started_at) >= datetime('now', '-24 hours')
            `).first();

            // Session completion stats
            const completionStats = await db.prepare(`
                SELECT
                    final_state,
                    COUNT(*) as count
                FROM sessions
                WHERE datetime(started_at) >= datetime('now', '-24 hours')
                GROUP BY final_state
                ORDER BY count DESC
            `).all();

            // OS distribution
            const osDistribution = await db.prepare(`
                SELECT
                    os,
                    COUNT(*) as count
                FROM sessions
                WHERE datetime(started_at) >= datetime('now', '-24 hours')
                    AND os IS NOT NULL
                GROUP BY os
                ORDER BY count DESC
            `).all();

            // Mode distribution
            const modeDistribution = await db.prepare(`
                SELECT
                    mode,
                    COUNT(*) as count
                FROM sessions
                WHERE datetime(started_at) >= datetime('now', '-24 hours')
                    AND mode IS NOT NULL
                GROUP BY mode
                ORDER BY count DESC
            `).all();

            return c.json({
                transitions: transitions?.results || [],
                abortedSessions: abortedSessions?.count || 0,
                completionStats: completionStats?.results || [],
                osDistribution: osDistribution?.results || [],
                modeDistribution: modeDistribution?.results || [],
                timestamp: new Date().toISOString(),
            });
        } catch (e: any) {
            console.error('Telemetry error:', e);
            return c.json({ error: e.message }, 500);
        }
    }

    /**
     * GET /admin/dashboard/usage
     * Purpose: Detailed usage analytics (tokens, costs, rate limiting data)
     * Access: Admin only
     */
    static async getUsage(c: Context) {
        const db = c.env.DB;

        try {
            // Total tokens consumed (last 24 hours)
            const tokenStats = await db.prepare(`
                SELECT
                    SUM(tokens_input) as total_input,
                    SUM(tokens_output) as total_output
                FROM usage_logs
                WHERE datetime(created_at) >= datetime('now', '-24 hours')
            `).first();

            // Top users by token consumption
            const topUsers = await db.prepare(`
                SELECT
                    u.email,
                    SUM(ul.tokens_input + ul.tokens_output) as total_tokens,
                    COUNT(ul.id) as request_count
                FROM usage_logs ul
                JOIN users u ON ul.user_id = u.id
                WHERE datetime(ul.created_at) >= datetime('now', '-24 hours')
                GROUP BY u.id
                ORDER BY total_tokens DESC
                LIMIT 10
            `).all();

            // Hourly usage breakdown (last 24 hours)
            const hourlyUsage = await db.prepare(`
                SELECT
                    strftime('%Y-%m-%d %H:00', created_at) as hour,
                    COUNT(*) as requests,
                    SUM(tokens_input + tokens_output) as tokens
                FROM usage_logs
                WHERE datetime(created_at) >= datetime('now', '-24 hours')
                GROUP BY hour
                ORDER BY hour ASC
            `).all();

            return c.json({
                tokens: {
                    input: tokenStats?.total_input || 0,
                    output: tokenStats?.total_output || 0,
                    total: (tokenStats?.total_input || 0) + (tokenStats?.total_output || 0),
                },
                topUsers: topUsers?.results || [],
                hourlyUsage: hourlyUsage?.results || [],
                timestamp: new Date().toISOString(),
            });
        } catch (e: any) {
            console.error('Usage stats error:', e);
            return c.json({ error: e.message }, 500);
        }
    }
}
