export interface User {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'developer' | 'viewer';
    apiKey?: string;
    createdAt: string;
    lastLogin?: string;
    defaultModel?: string;
}

export interface JWTPayload {
    sub: string;
    email: string;
    role: string;
    iat: number;
    exp: number;
}

// ─── Shared FSM Contract ─────────────────────────────────────────────────────
// This is the single source of truth for states and transitions.
// Both CLI and cloud enforce this contract.

export const FSM_STATES = [
    'IDLE', 'AUTH_CHECK', 'CONTEXT_SCAN', 'API_CALL', 'DISPLAY',
    'PLAN_REVIEW', 'AWAITING_CONFIRM', 'EXECUTING', 'CMD_SUCCESS',
    'CMD_FAILED', 'ERROR_RECOVERY', 'DONE', 'ABORTED'
] as const;

export type FSMState = typeof FSM_STATES[number];

/**
 * FSM Transition Map — canonical allowed transitions.
 * ABORTED is reachable from every non-terminal state.
 * Both CLI and cloud enforce this contract.
 */
export const FSM_TRANSITIONS: Record<FSMState, FSMState[]> = {
    IDLE: ['AUTH_CHECK', 'ABORTED'],
    AUTH_CHECK: ['CONTEXT_SCAN', 'ABORTED'],
    CONTEXT_SCAN: ['API_CALL', 'ABORTED'],
    API_CALL: ['DISPLAY', 'ABORTED'],
    DISPLAY: ['PLAN_REVIEW', 'DONE', 'ABORTED'],
    PLAN_REVIEW: ['AWAITING_CONFIRM', 'DONE', 'ABORTED'],
    AWAITING_CONFIRM: ['EXECUTING', 'ABORTED'],
    EXECUTING: ['CMD_SUCCESS', 'CMD_FAILED', 'ABORTED'],
    CMD_SUCCESS: ['EXECUTING', 'DONE', 'ABORTED'],
    CMD_FAILED: ['ERROR_RECOVERY', 'ABORTED'],
    ERROR_RECOVERY: ['API_CALL', 'ABORTED'],
    DONE: ['IDLE'],
    ABORTED: ['IDLE'],
};

export const FSM_VERSION = '1.0.0';

export interface FSMEvent {
    from: FSMState;
    to: FSMState;
    timestamp: string;
    metadata?: Record<string, any>;
}

export interface SessionRecord {
    sessionId: string;
    userId: string;
    mode: string;
    os: string;
    prompt: string;
    finalState: FSMState;
    fsmVersion: string;
    events: FSMEvent[];
    commandsExecuted: number;
    commandsFailed: number;
    startedAt: string;
    endedAt: string;
}
