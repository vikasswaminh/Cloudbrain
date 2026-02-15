import { D1Database } from '@cloudflare/workers-types';

export interface ModelConfig {
    id: string;
    name: string;
    provider: 'openai_compatible' | 'cloudflare' | 'anthropic' | 'google';
    base_url?: string;
    api_key_env_var?: string;
    is_active: boolean;
    required_plan: 'free' | 'pro' | 'enterprise';
    created_at: string;
}

export class ModelService {
    private db: D1Database;

    constructor(db: D1Database) {
        this.db = db;
    }

    async getModels(activeOnly: boolean = true): Promise<ModelConfig[]> {
        let query = 'SELECT * FROM models';
        if (activeOnly) {
            query += ' WHERE is_active = TRUE';
        }
        const { results } = await this.db.prepare(query).all<ModelConfig>();
        return results || [];
    }

    async getModelById(id: string): Promise<ModelConfig | null> {
        return this.db.prepare('SELECT * FROM models WHERE id = ?').bind(id).first<ModelConfig>();
    }

    async createModel(model: Omit<ModelConfig, 'created_at'>): Promise<ModelConfig> {
        const createdAt = new Date().toISOString();
        await this.db.prepare(
            'INSERT INTO models (id, name, provider, base_url, api_key_env_var, is_active, required_plan, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(
            model.id, model.name, model.provider, model.base_url, model.api_key_env_var,
            model.is_active ? 1 : 0, model.required_plan, createdAt
        ).run();

        return { ...model, created_at: createdAt };
    }

    async updateModel(id: string, updates: Partial<ModelConfig>): Promise<void> {
        // Construct dynamic update query
        const keys = Object.keys(updates).filter(k => k !== 'id' && k !== 'created_at');
        if (keys.length === 0) return;

        const setClause = keys.map(k => `${k} = ?`).join(', ');
        const values = keys.map(k => {
            const val = (updates as any)[k];
            return typeof val === 'boolean' ? (val ? 1 : 0) : val;
        });
        values.push(id);

        await this.db.prepare(`UPDATE models SET ${setClause} WHERE id = ?`)
            .bind(...values)
            .run();
    }

    async deleteModel(id: string): Promise<void> {
        await this.db.prepare('DELETE FROM models WHERE id = ?').bind(id).run();
    }
}
