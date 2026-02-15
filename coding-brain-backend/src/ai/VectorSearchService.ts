import { D1Database } from '@cloudflare/workers-types';

interface PlanRecord {
    id: string;
    task: string;
    embedding_vector: string; // JSON string
}

export class VectorSearchService {
    private db: D1Database;

    constructor(db: D1Database) {
        this.db = db;
    }

    private cosineSimilarity(vecA: number[], vecB: number[]): number {
        const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
        const msgA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
        const msgB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
        return dotProduct / (msgA * msgB);
    }

    async findSimilarPlans(queryVector: number[], limit: number = 5): Promise<{ id: string; task: string; score: number }[]> {
        const { results } = await this.db.prepare('SELECT id, task, embedding_vector FROM plans').all<PlanRecord>();

        if (!results) return [];

        const scores = results.map((record) => {
            const vector = JSON.parse(record.embedding_vector) as number[];
            const score = this.cosineSimilarity(queryVector, vector);
            return { id: record.id, task: record.task, score };
        });

        return scores.sort((a, b) => b.score - a.score).slice(0, limit);
    }
}
