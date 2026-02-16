/**
 * Custom Vercel AI SDK provider for coding.super25.ai
 *
 * Uses @ai-sdk/openai with a custom baseURL to route all calls through
 * the CloudBrain gateway. The gateway already speaks OpenAI-compatible format.
 *
 * The SDK posts to {baseURL}/chat/completions.
 * We intercept the fetch to rewrite the path to /gateway/chat (existing route).
 */

import { createOpenAI } from '@ai-sdk/openai';
import { getConfig } from './config.js';

const API_BASE = 'https://api.coding.super25.ai';

export function getCloudbBrainModel(modelId: string = 'glm-4.7-flash') {
    const config = getConfig();

    if (!config.apiKey) {
        throw new Error('No API key configured. Run: brain auth');
    }

    const apiKey = config.apiKey;

    const provider = createOpenAI({
        baseURL: `${API_BASE}/gateway`,
        apiKey,
        // Override fetch to rewrite /chat/completions → /chat (your existing route)
        fetch: async (url: RequestInfo, init?: RequestInit) => {
            const rewritten = String(url).replace('/chat/completions', '/chat');
            const originalBody = init?.body ? JSON.parse(init.body as string) : {};

            const response = await fetch(rewritten, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify(originalBody),
            });

            return response;
        },
    });

    return provider(modelId);
}
