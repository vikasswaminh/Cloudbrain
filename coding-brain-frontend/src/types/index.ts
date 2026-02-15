export interface User {
    id: string;
    email: string;
    role: 'admin' | 'developer' | 'viewer';
}

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

export interface Plan {
    id: string;
    task: string;
    plan: PlanOutput;
    created_at: string;
}

export interface Execution {
    id: string;
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    plan_id: string;
    created_at: string;
}

export interface ExecutionState {
    planId: string;
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    results: Record<string, any>;
    currentStepId?: string;
}
