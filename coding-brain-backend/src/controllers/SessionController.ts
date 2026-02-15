import { Hono } from 'hono';

interface Env {
    DB: D1Database;
    SESSION_RECORDER: DurableObjectNamespace;
}

const sessionRoutes = new Hono<{ Bindings: Env }>();

// POST /sessions/report — CLI fire-and-forget telemetry
sessionRoutes.post('/report', async (c) => {
    try {
        const body = await c.req.json();
        const sessionId = body.sessionId;

        if (!sessionId) {
            return c.json({ error: 'sessionId required' }, 400);
        }

        // Route to Durable Object by session ID
        const doId = c.env.SESSION_RECORDER.idFromName(sessionId);
        const stub = c.env.SESSION_RECORDER.get(doId);

        const doResponse = await stub.fetch(new Request('https://do/report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }));

        const result = await doResponse.json();
        return c.json(result);
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

// GET /sessions — List recent sessions for a user
sessionRoutes.get('/', async (c) => {
    try {
        const limit = parseInt(c.req.query('limit') || '20');
        const result = await c.env.DB.prepare(
            'SELECT id, mode, os, prompt, final_state, commands_executed, commands_failed, started_at, ended_at FROM sessions ORDER BY started_at DESC LIMIT ?'
        ).bind(limit).all();

        return c.json({ sessions: result.results });
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

// GET /sessions/:id/replay — Full session history
sessionRoutes.get('/:id/replay', async (c) => {
    const sessionId = c.req.param('id');

    try {
        // Try DO first (for active sessions)
        const doId = c.env.SESSION_RECORDER.idFromName(sessionId);
        const stub = c.env.SESSION_RECORDER.get(doId);

        const doResponse = await stub.fetch(new Request('https://do/replay', {
            method: 'GET',
        }));

        const replay = await doResponse.json();
        return c.json(replay);
    } catch {
        // Fallback to D1
        const row = await c.env.DB.prepare(
            'SELECT * FROM sessions WHERE id = ?'
        ).bind(sessionId).first();

        if (!row) return c.json({ error: 'Session not found' }, 404);
        return c.json(row);
    }
});

export { sessionRoutes };
