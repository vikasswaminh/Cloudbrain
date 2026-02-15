import { DurableObject } from 'cloudflare:workers';
import { FSM_TRANSITIONS, FSMState, FSMEvent, SessionRecord } from '../types';

interface Env {
    DB: D1Database;
}

export class SessionRecorder extends DurableObject {
    private events: FSMEvent[] = [];
    private currentState: FSMState = 'IDLE';
    private sessionMeta: Partial<SessionRecord> = {};

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);

        if (request.method === 'POST' && url.pathname === '/report') {
            return this.handleReport(request);
        }

        if (request.method === 'GET' && url.pathname === '/replay') {
            return this.handleReplay();
        }

        return new Response('Not Found', { status: 404 });
    }

    private async handleReport(request: Request): Promise<Response> {
        try {
            const body = await request.json() as any;

            // Validate events against FSM contract
            const incomingEvents: FSMEvent[] = body.events || [];
            const violations: string[] = [];

            for (const event of incomingEvents) {
                const allowed = FSM_TRANSITIONS[event.from];
                if (!allowed || !allowed.includes(event.to)) {
                    violations.push(`Invalid: ${event.from} → ${event.to}`);
                }
            }

            // Store all events (even with violations — we log everything)
            this.events = [...this.events, ...incomingEvents];
            if (incomingEvents.length > 0) {
                this.currentState = incomingEvents[incomingEvents.length - 1].to;
            }

            this.sessionMeta = {
                sessionId: body.sessionId,
                mode: body.mode,
                os: body.os,
                prompt: body.prompt,
                finalState: body.finalState || this.currentState,
                commandsExecuted: body.commandsExecuted || 0,
                commandsFailed: body.commandsFailed || 0,
            };

            // Persist to D1 (best-effort)
            try {
                const env = this.env as unknown as Env;
                await env.DB.prepare(`
                    INSERT OR REPLACE INTO sessions
                    (id, user_id, mode, os, prompt, final_state, fsm_version, events_json,
                     commands_executed, commands_failed, started_at, ended_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).bind(
                    body.sessionId,
                    body.userId || 'cli-user',
                    body.mode,
                    body.os,
                    body.prompt?.substring(0, 500),
                    body.finalState || this.currentState,
                    '1.0.0',
                    JSON.stringify(this.events),
                    body.commandsExecuted || 0,
                    body.commandsFailed || 0,
                    this.events[0]?.timestamp || new Date().toISOString(),
                    this.events[this.events.length - 1]?.timestamp || new Date().toISOString()
                ).run();
            } catch (dbErr) {
                // D1 write failure is non-fatal — DO has the data in memory
                console.error('D1 persist failed:', dbErr);
            }

            return new Response(JSON.stringify({
                accepted: true,
                eventsStored: this.events.length,
                violations,
                currentState: this.currentState,
            }), { headers: { 'Content-Type': 'application/json' } });

        } catch (err: any) {
            return new Response(JSON.stringify({ error: err.message }), { status: 400 });
        }
    }

    private async handleReplay(): Promise<Response> {
        return new Response(JSON.stringify({
            sessionId: this.sessionMeta.sessionId,
            mode: this.sessionMeta.mode,
            os: this.sessionMeta.os,
            prompt: this.sessionMeta.prompt,
            finalState: this.currentState,
            totalEvents: this.events.length,
            events: this.events,
            commandsExecuted: this.sessionMeta.commandsExecuted,
            commandsFailed: this.sessionMeta.commandsFailed,
        }), { headers: { 'Content-Type': 'application/json' } });
    }
}
