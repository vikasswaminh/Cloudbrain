export class EmbeddingService {
    private ai: any;

    constructor(ai: any) {
        this.ai = ai;
    }

    async generateEmbedding(text: string): Promise<number[]> {
        const response = await this.ai.run('@cf/baai/bge-base-en-v1.5', {
            text: [text],
        });
        return response.data[0];
    }
}
