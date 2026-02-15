import { Context } from 'hono';

export class ExecutionController {
    static async execute(c: Context) {
        const { planId } = await c.req.json();
        const plan = await c.env.DB.prepare('SELECT * FROM plans WHERE id = ?').bind(planId).first();

        if (!plan) return c.json({ error: 'Plan not found' }, 404);

        const executionId = crypto.randomUUID();
        const userId = c.get('user').sub;

        await c.env.DB.prepare(
            'INSERT INTO executions (id, user_id, status, plan_id, created_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(executionId, userId, 'PENDING', planId, new Date().toISOString()).run();

        // Get Durable Object stub
        const doId = c.env.EXECUTION_COORDINATOR.idFromName(executionId);
        const stub = c.env.EXECUTION_COORDINATOR.get(doId);

        // Parse plan JSON from D1
        const planJson = JSON.parse(plan.plan_json as string);

        // Start execution
        await stub.fetch('http://do/start', {
            method: 'POST',
            body: JSON.stringify({ planId, plan: planJson }),
        });

        return c.json({ executionId, status: 'PENDING' });
    }

    static async getStatus(c: Context) {
        const { id } = c.req.param();

        // Check D1 first for terminal state
        const execution = await c.env.DB.prepare('SELECT status FROM executions WHERE id = ?').bind(id).first();

        if (!execution) return c.json({ error: 'Execution not found' }, 404);

        // If completed or failed, return D1 status (assuming DO updates D1 on completion, but for now we poll DO)
        // Actually, DO state is the source of truth for progress.
        const doId = c.env.EXECUTION_COORDINATOR.idFromName(id);
        const stub = c.env.EXECUTION_COORDINATOR.get(doId);

        const response = await stub.fetch('http://do/status');
        if (response.status === 404) {
            // Maybe DO is gone or not started?
            return c.json({ status: execution.status });
        }
        const state = await response.json();
        return c.json(state);
    }

    static async replay(c: Context) {
        const { id } = c.req.param();
        // Get old execution
        const oldExecution = await c.env.DB.prepare('SELECT plan_id FROM executions WHERE id = ?').bind(id).first();
        if (!oldExecution) return c.json({ error: 'Execution not found' }, 404);

        // Create new execution with same plan
        const planId = oldExecution.plan_id;
        // Reuse execute logic
        // ... duplicate logic or call internal method.
        // Let's just do it inline for simplicity
        const plan = await c.env.DB.prepare('SELECT * FROM plans WHERE id = ?').bind(planId).first();

        const executionId = crypto.randomUUID();
        const userId = c.get('user').sub;

        await c.env.DB.prepare(
            'INSERT INTO executions (id, user_id, status, plan_id, created_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(executionId, userId, 'PENDING', planId, new Date().toISOString()).run();

        const doId = c.env.EXECUTION_COORDINATOR.idFromName(executionId);
        const stub = c.env.EXECUTION_COORDINATOR.get(doId);
        const planJson = JSON.parse(plan.plan_json as string);

        await stub.fetch('http://do/start', {
            method: 'POST',
            body: JSON.stringify({ planId, plan: planJson }),
        });

        return c.json({ executionId, status: 'PENDING', originalExecutionId: id });
    }

    static async getList(c: Context) {
        const { results } = await c.env.DB.prepare('SELECT * FROM executions ORDER BY created_at DESC LIMIT 50').all();
        return c.json(results || []);
    }
}
