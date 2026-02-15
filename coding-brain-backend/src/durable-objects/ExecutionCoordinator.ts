import { DurableObject } from 'cloudflare:workers';

interface StepResult {
    stepId: string;
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    output?: any;
    error?: string;
}

interface ExecutionState {
    planId: string;
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    results: Record<string, StepResult>;
    currentStepId?: string;
}

export class ExecutionCoordinator extends DurableObject {
    state: DurableObjectState;
    env: any;

    constructor(state: DurableObjectState, env: any) {
        super(state, env);
        this.state = state;
        this.env = env;
    }

    async fetch(request: Request) {
        const url = new URL(request.url);
        const method = request.method;

        if (method === 'POST' && url.pathname === '/start') {
            const { planId, plan } = await request.json() as any;

            const executionId = this.state.id.toString();

            // Initialize state
            const executionState: ExecutionState = {
                planId,
                status: 'RUNNING',
                results: {},
            };

            await this.state.storage.put('state', executionState);

            this.ctx.waitUntil(this.executePlan(plan, executionId));

            return new Response(JSON.stringify({ status: 'STARTED' }), { status: 202 });
        }

        if (method === 'GET' && url.pathname === '/status') {
            const state = await this.state.storage.get<ExecutionState>('state');
            if (!state) {
                return new Response(JSON.stringify({ status: 'NOT_FOUND' }), { status: 404 });
            }
            return new Response(JSON.stringify(state));
        }

        return new Response('Not Found', { status: 404 });
    }

    async logEvent(executionId: string, eventType: string, payload: any) {
        if (!this.env.DB) return;
        try {
            await this.env.DB.prepare(
                'INSERT INTO events (id, execution_id, event_type, payload, timestamp) VALUES (?, ?, ?, ?, ?)'
            ).bind(
                crypto.randomUUID(),
                executionId,
                eventType,
                JSON.stringify(payload),
                new Date().toISOString()
            ).run();
        } catch (e) {
            console.error('Failed to log event', e);
        }
    }

    async executePlan(plan: any, executionId: string) {
        let state = await this.state.storage.get<ExecutionState>('state');
        if (!state) return;

        await this.logEvent(executionId, 'EXECUTION_STARTED', { planId: state.planId });

        const steps = plan.steps || [];

        for (const step of steps) {
            state.currentStepId = step.id;
            state.results[step.id] = { stepId: step.id, status: 'RUNNING' };
            await this.state.storage.put('state', state);

            await this.logEvent(executionId, 'STEP_STARTED', { stepId: step.id, tool: step.tool });

            try {
                console.log(`Executing step ${step.id}: ${step.tool}`);
                await new Promise(resolve => setTimeout(resolve, 1000));

                const output = { result: `Output from ${step.tool}` };

                state.results[step.id] = { stepId: step.id, status: 'COMPLETED', output };
                await this.logEvent(executionId, 'STEP_COMPLETED', { stepId: step.id, output });
            } catch (e: any) {
                state.results[step.id] = { stepId: step.id, status: 'FAILED', error: e.message };
                state.status = 'FAILED';
                await this.state.storage.put('state', state);
                await this.logEvent(executionId, 'STEP_FAILED', { stepId: step.id, error: e.message });
                await this.logEvent(executionId, 'EXECUTION_FAILED', { error: e.message });

                // Update D1 execution status
                if (this.env.DB) {
                    await this.env.DB.prepare('UPDATE executions SET status = ? WHERE id = ?').bind('FAILED', executionId).run();
                }
                return;
            }

            await this.state.storage.put('state', state);
        }

        state.status = 'COMPLETED';
        state.currentStepId = undefined;
        await this.state.storage.put('state', state);

        // Update D1 execution status
        if (this.env.DB) {
            await this.env.DB.prepare('UPDATE executions SET status = ? WHERE id = ?').bind('COMPLETED', executionId).run();
        }
        await this.logEvent(executionId, 'EXECUTION_COMPLETED', { results: state.results });
    }
}
