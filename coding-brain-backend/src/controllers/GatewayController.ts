import { Context } from 'hono';
import { GatewayService } from '../services/GatewayService';
import { ModelService } from '../services/ModelService';

export class GatewayController {
    static async chat(c: Context) {
        const { model, messages } = await c.req.json();

        if (!model) return c.json({ error: 'Model ID required' }, 400);
        if (!messages || !Array.isArray(messages)) return c.json({ error: 'Messages array required' }, 400);

        const modelService = new ModelService(c.env.DB);
        const gatewayService = new GatewayService(modelService, c.env);

        try {
            const response = await gatewayService.routeRequest(model, messages);
            return c.json(response);
        } catch (e: any) {
            console.error('Gateway Error:', e);
            return c.json({ error: e.message }, 500);
        }
    }
}
