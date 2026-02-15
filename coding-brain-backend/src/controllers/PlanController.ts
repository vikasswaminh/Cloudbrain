import { Context } from 'hono';
import { PlannerService } from '../ai/PlannerService';
import { EmbeddingService } from '../ai/EmbeddingService';

export class PlanController {
    static async generate(c: Context) {
        const { task } = await c.req.json();
        if (!task) return c.json({ error: 'Task is required' }, 400);

        const planner = new PlannerService(c.env.AI);
        const embedder = new EmbeddingService(c.env.AI);

        try {
            // 1. Generate Plan
            const planOutput = await planner.generatePlan(task);

            // 2. Generate Embedding
            // Use the task description + plan summary for embedding
            const embeddingText = `${task} ${JSON.stringify(planOutput.steps.map(s => s.tool))}`;
            const vector = await embedder.generateEmbedding(embeddingText);

            // 3. Store in D1
            const planId = crypto.randomUUID();
            const userId = c.get('user').sub; // From RBAC

            await c.env.DB.prepare(
                'INSERT INTO plans (id, user_id, task, plan_json, embedding_vector, created_at) VALUES (?, ?, ?, ?, ?, ?)'
            ).bind(
                planId,
                userId,
                task,
                JSON.stringify(planOutput),
                JSON.stringify(vector),
                new Date().toISOString()
            ).run();

            return c.json({ id: planId, task, plan: planOutput });
        } catch (e: any) {
            return c.json({ error: e.message }, 500);
        }
    }
}
