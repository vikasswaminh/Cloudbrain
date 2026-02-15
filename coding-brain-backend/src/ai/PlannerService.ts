
export interface PlanStep {
    id: string;
    tool: string;
    depends_on: string[];
    input: Record<string, any>;
}

export interface PlanOutput {
    steps: PlanStep[];
    estimated_cost: number;
    estimated_latency_ms: number;
    confidence: number;
}

export class PlannerService {
    private ai: any;

    constructor(ai: any) {
        this.ai = ai;
    }

    async generatePlan(task: string): Promise<PlanOutput> {
        const systemPrompt = `Return valid JSON only. No explanations. Follow schema strictly.
    Output Schema:
    {
      "steps": [
        {
          "id": "string",
          "tool": "string",
          "depends_on": ["string"],
          "input": {}
        }
      ],
      "estimated_cost": "number",
      "estimated_latency_ms": "number",
      "confidence": "number"
    }
    `;

        const response = await this.ai.run('@cf/meta/llama-3-8b-instruct', {
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Create a plan for: ${task}` },
            ],
        });

        // Cloudflare AI response format might vary, but usually response.response is the string.
        // Need to parse JSON from Markdown code block if present.
        let content = response.response;
        // Strip markdown code blocks if present
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();

        try {
            return JSON.parse(content);
        } catch (e) {
            console.error('Failed to parse planner output', content);
            throw new Error('Planner failed to generate valid JSON');
        }
    }
}
