import { Context } from 'hono';
import { ModelService } from '../services/ModelService';
import { ApiKeyService } from '../services/ApiKeyService';

export class AdminController {
    static async listModels(c: Context) {
        const modelService = new ModelService(c.env.DB);
        // Admin sees all models, active or not
        const models = await modelService.getModels(false);
        return c.json(models);
    }

    static async createModel(c: Context) {
        const body = await c.req.json();
        const modelService = new ModelService(c.env.DB);
        const model = await modelService.createModel({
            ...body,
            id: body.id || crypto.randomUUID(), // Allow custom ID or generate one
        });
        return c.json(model);
    }

    static async updateModel(c: Context) {
        const id = c.req.param('id');
        const body = await c.req.json();
        const modelService = new ModelService(c.env.DB);
        await modelService.updateModel(id, body);
        return c.json({ success: true });
    }

    static async deleteModel(c: Context) {
        const id = c.req.param('id');
        const modelService = new ModelService(c.env.DB);
        await modelService.deleteModel(id);
        return c.json({ success: true });
    }
}

export class ApiKeyController {
    static async createKey(c: Context) {
        const user = c.get('user'); // From RBAC middleware
        const { name } = await c.req.json();
        const apiKeyService = new ApiKeyService(c.env.DB);
        const result = await apiKeyService.createKey(user.sub, name || 'CLI Key');
        return c.json(result);
    }

    static async listKeys(c: Context) {
        const user = c.get('user');
        const apiKeyService = new ApiKeyService(c.env.DB);
        const keys = await apiKeyService.listKeys(user.sub);
        return c.json(keys);
    }

    static async deleteKey(c: Context) {
        const user = c.get('user');
        const id = c.req.param('id');
        const apiKeyService = new ApiKeyService(c.env.DB);
        await apiKeyService.deleteKey(id, user.sub);
        return c.json({ success: true });
    }
}
