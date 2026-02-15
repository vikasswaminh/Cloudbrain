import { ModelService, ModelConfig } from './ModelService';

export class GatewayService {
    private modelService: ModelService;
    private env: any; // Bindings

    constructor(modelService: ModelService, env: any) {
        this.modelService = modelService;
        this.env = env;
    }

    async routeRequest(modelId: string, messages: any[]): Promise<any> {
        const model = await this.modelService.getModelById(modelId);
        if (!model) {
            throw new Error(`Model ${modelId} not found`);
        }
        if (!model.is_active) {
            throw new Error(`Model ${modelId} is inactive`);
        }

        // Provider Routing
        switch (model.provider) {
            case 'cloudflare':
                return this.callCloudflareAI(model, messages);
            case 'openai_compatible':
                return this.callOpenAICompatible(model, messages);
            default:
                throw new Error(`Provider ${model.provider} not supported yet`);
        }
    }

    private async callCloudflareAI(model: ModelConfig, messages: any[]) {
        // model.name should be the CF model ID, e.g., "@cf/meta/llama-3-8b-instruct"
        const response = await this.env.AI.run(model.name, { messages });
        return response; // Normalize this if needed
    }

    private async callOpenAICompatible(model: ModelConfig, messages: any[]) {
        if (!model.base_url) throw new Error('Base URL required for OpenAI Compatible provider');

        let apiKey = '';
        if (model.api_key_env_var) {
            // Retrieve key from KV or Secrets. Assuming Env for now, but safer in Secrets/KV
            // In Cloudflare Workers, secrets are exposed on `this.env`
            apiKey = this.env[model.api_key_env_var] || '';
        }

        const response = await fetch(`${model.base_url}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model.name, // or specific model name param if different
                messages
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Upstream API error: ${err}`);
        }

        return await response.json();
    }
}
