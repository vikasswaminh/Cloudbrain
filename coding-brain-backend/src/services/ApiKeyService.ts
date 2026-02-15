import { D1Database } from '@cloudflare/workers-types';

export class ApiKeyService {
    private db: D1Database;

    constructor(db: D1Database) {
        this.db = db;
    }

    private async hashKey(key: string): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(key);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async createKey(userId: string, name: string): Promise<{ id: string, key: string }> {
        const keyPrefix = 'sk_brain_';
        const randomPart = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
        const key = `${keyPrefix}${randomPart}`;
        const keyHash = await this.hashKey(key);
        const id = crypto.randomUUID();

        await this.db.prepare(
            'INSERT INTO api_keys (id, user_id, key_hash, name, created_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(id, userId, keyHash, name, new Date().toISOString()).run();

        return { id, key };
    }

    async verifyKey(key: string): Promise<{ userId: string, keyId: string } | null> {
        const keyHash = await this.hashKey(key);
        const result = await this.db.prepare(
            'SELECT id, user_id FROM api_keys WHERE key_hash = ?'
        ).bind(keyHash).first<{ id: string, user_id: string }>();

        if (result) {
            // Async update last_used, don't await to not block response
            this.db.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?')
                .bind(new Date().toISOString(), result.id).run().catch(console.error);
            return { userId: result.user_id, keyId: result.id };
        }
        return null;
    }

    async listKeys(userId: string): Promise<any[]> {
        const { results } = await this.db.prepare('SELECT id, name, last_used_at, created_at FROM api_keys WHERE user_id = ?').bind(userId).all();
        return results || [];
    }

    async deleteKey(id: string, userId: string): Promise<void> {
        await this.db.prepare('DELETE FROM api_keys WHERE id = ? AND user_id = ?').bind(id, userId).run();
    }
}
