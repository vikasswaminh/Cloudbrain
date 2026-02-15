#!/usr/bin/env node
import { Command } from 'commander';
import inquirer from 'inquirer';
import axios from 'axios';
import chalk from 'chalk';
import { marked } from 'marked';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { markedTerminal } from 'marked-terminal';
import { execSync, spawnSync } from 'child_process';
import crypto from 'crypto';
import * as Sentry from '@sentry/node';
import ora from 'ora';

marked.use(markedTerminal() as any);

// Initialize Sentry (DSN should be injected via build time or env var)
Sentry.init({
    dsn: process.env.SENTRY_DSN || 'https://examplePublicKey@o0.ingest.sentry.io/0', // Placeholder
    tracesSampleRate: 1.0,
    environment: process.env.NODE_ENV || 'production',
    enabled: !!process.env.SENTRY_DSN, // Only enable if DSN is present
});

const program = new Command();
const CONFIG_DIR = path.join(os.homedir(), '.brain');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const SESSIONS_DIR = path.join(CONFIG_DIR, 'sessions');
const TODOS_DIR = path.join(CONFIG_DIR, 'todos');

// Ensure dirs exist
if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });
if (!fs.existsSync(TODOS_DIR)) fs.mkdirSync(TODOS_DIR, { recursive: true });

const getConfig = () => {
    if (fs.existsSync(CONFIG_FILE)) return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    return {};
};
const saveConfig = (config: any) => fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

const API_URL = 'https://api.coding.super25.ai';

// ─── FSM Contract (shared with cloud) ────────────────────────────────────────

const FSM_STATES = [
    'IDLE', 'AUTH_CHECK', 'CONTEXT_SCAN', 'API_CALL', 'DISPLAY',
    'PLAN_REVIEW', 'AWAITING_CONFIRM', 'EXECUTING', 'CMD_SUCCESS',
    'CMD_FAILED', 'ERROR_RECOVERY', 'DONE', 'ABORTED'
] as const;

type FSMState = typeof FSM_STATES[number];

// ABORTED is reachable from every non-terminal state — errors can happen anywhere.
const FSM_TRANSITIONS: Record<FSMState, FSMState[]> = {
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
    ERROR_RECOVERY: ['API_CALL', 'DISPLAY', 'ABORTED'],
    DONE: ['IDLE'],
    ABORTED: ['IDLE'],
};

const FSM_VERSION = '1.0.0';

interface FSMEvent {
    from: FSMState;
    to: FSMState;
    timestamp: string;
    metadata?: Record<string, any>;
}

interface LocalSession {
    sessionId: string;
    mode: string;
    os: string;
    prompt: string;
    currentState: FSMState;
    events: FSMEvent[];
    commandsExecuted: number;
    commandsFailed: number;
    startedAt: string;
    endedAt?: string;
    pendingCommands?: string[];
    executedCommands?: string[];
    messages: { role: string; content: string }[];
}

// ─── Session FSM ─────────────────────────────────────────────────────────────

class SessionFSM {
    session: LocalSession;
    get id() { return this.session.sessionId; }

    constructor(mode: string, prompt: string) {
        this.session = {
            sessionId: crypto.randomUUID(),
            mode,
            os: detectOS(),
            prompt,
            currentState: 'IDLE',
            events: [],
            commandsExecuted: 0,
            commandsFailed: 0,
            startedAt: new Date().toISOString(),
            messages: [],
        };
    }

    transition(to: FSMState, metadata?: Record<string, any>): boolean {
        const from = this.session.currentState;
        const allowed = FSM_TRANSITIONS[from];
        if (!allowed || !allowed.includes(to)) {
            console.error(chalk.red(`❌ Invalid FSM transition: ${from} → ${to}`));
            return false;
        }
        this.session.events.push({ from, to, timestamp: new Date().toISOString(), metadata });
        this.session.currentState = to;
        if (to === 'DONE' || to === 'ABORTED') {
            this.session.endedAt = new Date().toISOString();
        }
        this.save();
        return true;
    }

    save() {
        const fp = path.join(SESSIONS_DIR, `${this.session.sessionId}.json`);
        fs.writeFileSync(fp, JSON.stringify(this.session, null, 2));
    }

    static restore(sessionId: string): SessionFSM | null {
        const fp = path.join(SESSIONS_DIR, `${sessionId}.json`);
        if (!fs.existsSync(fp)) return null;
        const data = JSON.parse(fs.readFileSync(fp, 'utf-8')) as LocalSession;
        const fsm = new SessionFSM(data.mode, data.prompt);
        fsm.session = data;
        return fsm;
    }

    /**
     * Fire-and-forget: report session to cloud. Non-blocking, never throws.
     */
    async reportToCloud(apiKey: string) {
        try {
            axios.post(`${API_URL}/sessions/report`, {
                sessionId: this.session.sessionId,
                mode: this.session.mode,
                os: this.session.os,
                prompt: this.session.prompt,
                events: this.session.events,
                finalState: this.session.currentState,
                commandsExecuted: this.session.commandsExecuted,
                commandsFailed: this.session.commandsFailed,
            }, {
                headers: { 'Authorization': `Bearer ${apiKey}` },
                timeout: 5000,
            }).catch(() => { }); // Fire and forget — never block CLI
        } catch { /* silent */ }
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function detectOS(): string {
    const platform = os.platform();
    if (platform === 'win32') return 'windows';
    if (platform === 'darwin') return 'macos';
    return 'linux';
}

function getProjectContext(): string {
    if (fs.existsSync('package.json')) return 'Node.js/TypeScript';
    if (fs.existsSync('requirements.txt') || fs.existsSync('pyproject.toml')) return 'Python';
    if (fs.existsSync('Cargo.toml')) return 'Rust';
    if (fs.existsSync('go.mod')) return 'Go';
    if (fs.existsSync('pom.xml') || fs.existsSync('build.gradle')) return 'Java';
    return 'General';
}

function needsProjectContext(prompt: string): boolean {
    const kw = ['this project', 'this repo', 'this folder', 'my code', 'my project',
        'current', 'here', 'review', 'scan', 'analyze', 'audit', 'refactor',
        'optimize', 'fix', 'debug', 'test', 'deploy', 'migrate'];
    const lower = prompt.toLowerCase();
    return kw.some(k => lower.includes(k));
}

function getProjectTree(): string {
    try {
        const cmd = detectOS() === 'windows'
            ? 'powershell -NoProfile -NonInteractive -Command "Get-ChildItem -Recurse -Depth 3 -Name -Exclude node_modules,.git | Select-Object -First 150"'
            : 'find . -maxdepth 3 -not -path "*/node_modules/*" -not -path "*/.git/*" | head -150';
        return execSync(cmd, { encoding: 'utf-8', timeout: 5000, cwd: process.cwd() }).trim();
    } catch { return '(unable to read)'; }
}

function getReviewContext(): string {
    const keyFiles = ['package.json', 'tsconfig.json', 'Dockerfile', 'docker-compose.yml',
        'wrangler.toml', '.github/workflows/ci.yml', 'Makefile', 'README.md',
        'pyproject.toml', 'go.mod', 'Cargo.toml'];
    let ctx = `Project: ${path.basename(process.cwd())}\n\n=== Tree ===\n${getProjectTree()}\n\n`;
    let size = ctx.length;
    for (const f of keyFiles) {
        const fp = path.join(process.cwd(), f);
        if (fs.existsSync(fp)) {
            try {
                const c = fs.readFileSync(fp, 'utf-8');
                const b = `=== ${f} ===\n${c}\n\n`;
                if (size + b.length > 40000) break;
                ctx += b;
                size += b.length;
            } catch { /* skip */ }
        }
    }
    return ctx;
}

// ─── Shell Block Extraction (Gold-Level Robustness) ─────────────────────────
// Primary: Markdown code fences. Fallback: Heuristic command detection.

const SHELL_FENCE_REGEX = /```(?:shell|powershell|bash|cmd|sh|ps1|bat|terminal)?\s*([\s\S]*?)```/g;
const NON_SHELL_FENCE_REGEX = /```(?:python|javascript|typescript|java|go|rust|ruby|html|css|json|yaml|sql|xml|c|cpp|csharp|dockerfile|toml|markdown|text|plaintext|diff)\s*[\s\S]*?```/g;

// Heuristic: lines that look like shell commands
const SHELL_LINE_PATTERNS = [
    /^\$\s+/,                           // $ command
    /^>\s+/,                             // > command (PS)
    /^(Set-Content|New-Item|Remove-Item|Get-|Write-Host|Invoke-)/i,
    /^(mkdir|cd|cp|mv|rm|ls|cat|echo|touch|chmod|chown|curl|wget|npm|npx|node|git|docker)/i,
    /^(pip|python|go|cargo|make|cmake)/i,
];

function extractShellBlocks(content: string): string[] {
    // Phase 1: Try standard markdown code fences (shell-only)
    const fenced = [...content.matchAll(SHELL_FENCE_REGEX)].map(m => m[1].trim()).filter(c => c.length > 0);
    if (fenced.length > 0) return fenced;

    // Phase 2: Try generic ``` blocks (no language tag), but exclude known non-shell
    const cleaned = content.replace(NON_SHELL_FENCE_REGEX, ''); // Remove python/js/etc blocks
    const genericFence = /```\s*([\s\S]*?)```/g;
    const generic = [...cleaned.matchAll(genericFence)].map(m => m[1].trim()).filter(c => c.length > 0);
    if (generic.length > 0) return generic;

    // Phase 3: Heuristic fallback — detect raw command lines
    const lines = content.split('\n');
    const commandLines: string[] = [];
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length === 0) continue;
        if (SHELL_LINE_PATTERNS.some(p => p.test(trimmed))) {
            // Strip leading $ or > prompt characters
            commandLines.push(trimmed.replace(/^[\$>]\s+/, ''));
        }
    }
    if (commandLines.length > 0) return [commandLines.join('\n')];

    return []; // Truly no commands found
}


// ─── YOLO Safety Guard ──────────────────────────────────────────────────────
// These patterns catch destructive commands that should NEVER auto-execute.

const DANGEROUS_PATTERNS = [
    // ─── Destructive File Operations ─────
    /rm\s+(-rf?|--recursive)/i,
    /Remove-Item.*(-Recurse|-Force)/i,
    /del\s+\/[sfq]/i,
    /rmdir\s+\/s/i,
    /format\s+[a-z]:/i,
    /mkfs/i,
    /dd\s+if=/i,
    />\s*\/dev\/sd[a-z]/i,
    /chmod\s+(-R\s+)?777/i,
    /:(){ :\|:& };:/,                        // fork bomb

    // ─── Database Destruction ─────
    /drop\s+database/i,
    /drop\s+table/i,
    /truncate\s+table/i,
    /delete\s+from\s+\w+\s*(;|$)/i,         // DELETE FROM without WHERE

    // ─── System Control ─────
    /shutdown/i,
    /reboot/i,
    /halt/i,
    /init\s+0/i,
    /taskkill\s+\/f\s+\/im/i,
    /Stop-Process.*-Force/i,
    /Clear-Content/i,
    /Set-Content.*\$null/i,

    // ─── Git & Package Safety ─────
    /git\s+push.*--force(?!\s+--with-lease)/i,
    /npm\s+publish/i,
    /curl.*\|\s*(bash|sh|powershell)/i,     // pipe to shell

    // ─── SSRF / Cloud Metadata (Gold Fix) ─────
    /169\.254\.169\.254/,                     // AWS metadata endpoint
    /metadata\.google\.internal/,             // GCP metadata
    /169\.254\.170\.2/,                       // ECS task metadata
    /100\.100\.100\.200/,                     // Alibaba Cloud metadata
    /Invoke-RestMethod.*169\.254/i,           // PowerShell SSRF
    /curl.*169\.254/i,                        // curl SSRF
    /wget.*169\.254/i,                        // wget SSRF

    // ─── Path Traversal (Gold Fix) ─────
    new RegExp('\\.\\.[\\\\/]\\.\\.[\\\\/]\\.\\.'),         // deep traversal (Unix or Windows)
    new RegExp('Set-Content.*\\.\\.\\\\', 'i'),       // PS path traversal (backslash)
    new RegExp('Set-Content.*\\.\\.\\/', 'i'),         // PS path traversal (forward slash)

    // ─── Egress / Exfiltration (Gold Fix) ─────
    /Invoke-WebRequest.*-OutFile/i,               // downloading to file
    /certutil.*-urlcache/i,                       // Windows LOL binary
    new RegExp('bitsadmin.*\\/transfer', 'i'),     // Windows LOL binary
];

function isDangerousCommand(cmd: string): boolean {
    return DANGEROUS_PATTERNS.some(p => p.test(cmd));
}

function execCommand(cmd: string): { code: number; stdout: string; stderr: string } {
    try {
        const isWin = detectOS() === 'windows';
        if (isWin) {
            // Use temp file for robust multi-line execution on Windows
            const tempFile = path.join(os.tmpdir(), `brain-cmd-${Date.now()}.ps1`);
            fs.writeFileSync(tempFile, cmd);

            try {
                const result = spawnSync('powershell.exe', [
                    '-NoProfile',
                    '-NonInteractive',
                    '-ExecutionPolicy', 'Bypass',
                    '-File', tempFile
                ], { encoding: 'utf-8' });

                return {
                    code: result.status ?? 0,
                    stdout: result.stdout || '',
                    stderr: result.stderr || ''
                };
            } finally {
                if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
            }
        }
        const stdout = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 60000, cwd: process.cwd() });
        return { code: 0, stdout, stderr: '' };
    } catch (err: any) {
        return { code: err.status || 1, stdout: err.stdout || '', stderr: err.stderr || err.message || '' };
    }
}

// ─── Mode Config ─────────────────────────────────────────────────────────────

const MODE_LABELS: Record<string, string> = {
    default: '🧠 Default (Coding agent)',
    yolo: '⚡ YOLO (Zero-Friction Execution)',
    review: '🔍 Code Review (Senior Audit)',
    infra: '🏗️  Infrastructure (DevOps Expert)',
    fix: '🔧 Debug & Fix',
    plan: '📋 Plan Only (No Execution)',
    architect: '🏛️  System Architect',
    docs: '📝 Documentation Writer',
    security: '🛡️  Security Auditor (OWASP)',
    test: '🧪 Test Writer',
    refactor: '♻️  Refactorer',
    migrate: '🔄 Migrator',
    optimize: '📈 Performance Optimizer',
    deploy: '🚀 Deployer',
    explain: '💡 Explain (Junior-Friendly)',
    git: '🌿 Git Expert',
    todo: '📝 Smart Todo (Task Planning)',
};

const NON_EXEC_MODES = new Set(['plan', 'review', 'security', 'architect', 'docs', 'explain', 'optimize', 'todo']);
const CONTEXT_MODES = new Set(['review', 'security', 'test', 'refactor', 'optimize', 'fix', 'docs', 'todo']);

// ─── Persona 7: Intent Detector ──────────────────────────────────────────────
// Catches user intent BEFORE hitting the API

const NO_CODE_PHRASES = [
    'don\'t code', 'do not code', 'no code', 'without coding',
    'don\'t execute', 'do not execute', 'no execution',
    'just plan', 'just show', 'just list', 'only plan',
    'show me a list', 'show me steps', 'show steps',
    'make a list', 'make a todo', 'give me a list',
    'task list', 'todo list', 'break this down', 'break it down',
    'what should i do', 'what do i need', 'prioritize',
    'what are the steps', 'walk me through',
];

function detectNonCodingIntent(prompt: string): boolean {
    const p = prompt.toLowerCase();
    return NO_CODE_PHRASES.some(phrase => p.includes(phrase));
}

// ─── Persona 1+2: Task Decomposer & Priority Ranker (System Prompt) ──────────

const TODO_SYSTEM_PROMPT =
    `[SYSTEM: You are a senior technical project manager. ` +
    `Decompose the user's request into an ordered task list. ` +
    `Return ONLY valid JSON — no markdown, no explanation, just the JSON object. ` +
    `Format: { "title": "short plan title", "tasks": [ ` +
    `{ "id": 1, "task": "description", "priority": "P0", "risk": "low", "effort": "1 min" }, ... ] } ` +
    `Priority rules: P0 = blocks everything else (init, install). ` +
    `P1 = core functionality (create main files). P2 = nice-to-have (docs, tests, polish). ` +
    `Risk: low = safe/reversible, medium = modifies state, high = destructive/irreversible. ` +
    `Include 3-8 tasks. Be specific and actionable.]\n\n`;

// ─── Persona 3: Todo Renderer ────────────────────────────────────────────────

interface TodoTask {
    id: number;
    task: string;
    priority: 'P0' | 'P1' | 'P2';
    risk: 'low' | 'medium' | 'high';
    effort: string;
    done?: boolean;
}

interface TodoPlan {
    title: string;
    tasks: TodoTask[];
    sessionId?: string;
    createdAt?: string;
}

function parseTodoPlan(content: string): TodoPlan | null {
    try {
        // Try to extract JSON from the response (may have markdown wrapping)
        let jsonStr = content.trim();
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) jsonStr = jsonMatch[0];
        const parsed = JSON.parse(jsonStr);
        if (parsed.title && Array.isArray(parsed.tasks)) return parsed as TodoPlan;
        return null;
    } catch {
        return null;
    }
}

function renderTodoList(plan: TodoPlan): void {
    const priorityColors: Record<string, (s: string) => string> = {
        P0: chalk.red,
        P1: chalk.yellow,
        P2: chalk.green,
    };
    const priorityIcons: Record<string, string> = {
        P0: '🔴', P1: '🟡', P2: '🟢',
    };
    const riskBadge = (r: string) => r === 'high' ? chalk.bgRed.white(' ⚠ HIGH RISK ') :
        r === 'medium' ? chalk.yellow('⚠️  medium risk') : '';

    console.log(chalk.bgCyan.black.bold(`\n 📋 Smart Task Plan: ${plan.title} `));
    console.log(chalk.gray('─'.repeat(55)));

    let totalP0 = 0;
    for (const t of plan.tasks) {
        if (t.priority === 'P0') totalP0++;
        const icon = priorityIcons[t.priority] || '⚪';
        const colorFn = priorityColors[t.priority] || chalk.white;
        const done = t.done ? chalk.green('✅ ') : '   ';
        const risk = riskBadge(t.risk);
        const effort = chalk.gray(`~${t.effort}`);
        console.log(`${done}${icon} ${colorFn(t.priority)}  ${chalk.white(`${t.id}. ${t.task}`)}  ${effort}  ${risk}`);
    }

    console.log(chalk.gray('─'.repeat(55)));
    console.log(chalk.gray(`  ${plan.tasks.length} tasks · ${totalP0} critical · Est. total: ${estimateTotal(plan.tasks)}`));
    console.log();
}

function estimateTotal(tasks: TodoTask[]): string {
    let totalMin = 0;
    for (const t of tasks) {
        const match = t.effort.match(/(\d+)/);
        if (match) totalMin += parseInt(match[1], 10);
    }
    if (totalMin >= 60) return `~${Math.round(totalMin / 60)}h`;
    return `~${totalMin} min`;
}

// ─── Persona 9: Enhanced Approval Gatekeeper ─────────────────────────────────

async function todoApprovalWorkflow(plan: TodoPlan, fsm: SessionFSM, modelId: string, mode: string, isYolo: boolean, config: any): Promise<void> {
    // Save the plan
    saveTodo(plan, fsm.id);

    const { action } = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: chalk.cyan('What would you like to do?'),
        choices: [
            { name: '✅ Approve all — execute the full plan', value: 'approve' },
            { name: '✏️  Edit — select which tasks to run', value: 'edit' },
            { name: '💬 Suggest — refine tasks with feedback', value: 'suggest' },
            { name: '💾 Save — save this plan for later', value: 'save' },
            { name: '❌ Cancel — discard this plan', value: 'cancel' },
        ],
    }]);

    if (action === 'cancel') {
        console.log(chalk.gray('Plan discarded.'));
        fsm.transition('DONE', { reason: 'todo_cancelled' });
        fsm.reportToCloud(config.apiKey);
        return;
    }

    if (action === 'save') {
        console.log(chalk.green(`💾 Plan saved! Resume later with: ${chalk.white('brain todos')}\n`));
        fsm.transition('DONE', { reason: 'todo_saved' });
        fsm.reportToCloud(config.apiKey);
        return;
    }

    if (action === 'suggest') {
        const { feedback } = await inquirer.prompt([{
            type: 'input', name: 'feedback',
            message: chalk.cyan('Your suggestion:'),
        }]);
        console.log(chalk.cyan('Refining plan with your feedback...'));
        // Re-run with the suggestion appended
        const newPrompt = `Revise this plan based on feedback:\nOriginal: ${JSON.stringify(plan)}\nFeedback: ${feedback}`;
        await runChat(newPrompt, modelId, 'todo', false, fsm);
        return;
    }

    let selectedTasks = plan.tasks;

    if (action === 'edit') {
        const { selected } = await inquirer.prompt([{
            type: 'checkbox',
            name: 'selected',
            message: chalk.cyan('Select tasks to execute:'),
            choices: plan.tasks.map(t => ({
                name: `${t.priority} ${t.id}. ${t.task} (~${t.effort})`,
                value: t.id,
                checked: true,
            })),
        }]);
        selectedTasks = plan.tasks.filter(t => selected.includes(t.id));
        if (selectedTasks.length === 0) {
            console.log(chalk.gray('No tasks selected. Plan discarded.'));
            fsm.transition('DONE', { reason: 'todo_no_selection' });
            fsm.reportToCloud(config.apiKey);
            return;
        }
        console.log(chalk.green(`\n✅ ${selectedTasks.length} task(s) selected for execution\n`));
    }

    // Execute selected tasks one by one
    console.log(chalk.blue('🚀 Executing plan step by step...\n'));

    for (let i = 0; i < selectedTasks.length; i++) {
        const task = selectedTasks[i];
        const label = `[${i + 1}/${selectedTasks.length}]`;
        console.log(chalk.cyan(`${label} ${task.task}...`));

        // Each sub-task gets its own independent FSM to avoid
        // FSM conflicts with the parent todo session
        await runChat(
            `Execute this single task: ${task.task}. Generate ONLY the shell commands needed.`,
            modelId, 'default', isYolo
        );

        // Mark as done
        task.done = true;
        saveTodo(plan, fsm.id);
    }

    console.log(chalk.green(`\n✅ Plan complete! ${selectedTasks.length} tasks executed.\n`));
    fsm.transition('EXECUTING');
    fsm.transition('CMD_SUCCESS', { reason: 'todo_all_complete' });
    fsm.transition('DONE', { reason: 'todo_plan_complete' });
    fsm.reportToCloud(config.apiKey);
}

// ─── Todo Persistence ────────────────────────────────────────────────────────

function saveTodo(plan: TodoPlan, sessionId: string): void {
    plan.sessionId = sessionId;
    if (!plan.createdAt) plan.createdAt = new Date().toISOString();
    const filePath = path.join(TODOS_DIR, `${sessionId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(plan, null, 2));
}

function loadAllTodos(): TodoPlan[] {
    try {
        const files = fs.readdirSync(TODOS_DIR).filter(f => f.endsWith('.json'));
        return files.map(f => JSON.parse(fs.readFileSync(path.join(TODOS_DIR, f), 'utf-8')) as TodoPlan)
            .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    } catch { return []; }
}

function loadTodo(sessionId: string): TodoPlan | null {
    const filePath = path.join(TODOS_DIR, `${sessionId}.json`);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as TodoPlan;
}

function showBanner(mode: string, sessionId: string) {
    console.log(chalk.bgBlue.white.bold('\n ╔════════════════════════════════════════════╗ '));
    console.log(chalk.bgBlue.white.bold(' ║         Super25 — Expert CLI v3.0          ║ '));
    console.log(chalk.bgBlue.white.bold(' ║ NETWORKERSHOME • 16 Modes • by Vikas Swami ║ '));
    console.log(chalk.bgBlue.white.bold(' ╚════════════════════════════════════════════╝ '));
    console.log(chalk.gray(`  ${MODE_LABELS[mode] || MODE_LABELS.default}`));
    console.log(chalk.gray(`  Session: ${sessionId}\n`));
}

// ─── Smart Progress Messages ─────────────────────────────────────────────────
// Generate context-aware progress descriptions like professional coding tools

function describeIntent(prompt: string, mode: string): string {
    const p = prompt.toLowerCase();

    // Mode-specific intents
    if (mode === 'fix') return 'Diagnosing and preparing a fix';
    if (mode === 'review') return 'Reviewing code for quality issues';
    if (mode === 'security') return 'Running security audit';
    if (mode === 'test') return 'Generating test cases';
    if (mode === 'refactor') return 'Identifying refactoring opportunities';
    if (mode === 'docs') return 'Writing documentation';
    if (mode === 'plan') return 'Drafting an execution plan';
    if (mode === 'architect') return 'Designing system architecture';
    if (mode === 'optimize') return 'Analyzing performance bottlenecks';
    if (mode === 'deploy') return 'Preparing deployment configuration';
    if (mode === 'explain') return 'Preparing a clear explanation';
    if (mode === 'git') return 'Working on Git operations';
    if (mode === 'infra') return 'Setting up infrastructure';
    if (mode === 'todo') return 'Breaking down tasks and prioritizing';
    if (mode === 'migrate') return 'Planning migration steps';

    // Content-specific intents (default mode)
    if (p.includes('create') || p.includes('make') || p.includes('init') || p.includes('new')) {
        const fileMatch = p.match(/(?:create|make|generate)\s+(?:a\s+)?(?:file\s+(?:called\s+)?)?([\w.-]+)/i);
        if (fileMatch) return `Creating ${fileMatch[1]}`;
        return 'Creating files';
    }
    if (p.includes('fix') || p.includes('error') || p.includes('debug')) return 'Analyzing and fixing the issue';
    if (p.includes('install') || p.includes('setup') || p.includes('configure')) return 'Setting up dependencies';
    if (p.includes('delete') || p.includes('remove') || p.includes('clean')) return 'Preparing cleanup commands';
    if (p.includes('deploy') || p.includes('build')) return 'Preparing the build';
    if (p.includes('docker') || p.includes('container')) return 'Setting up containers';
    if (p.includes('test') || p.includes('spec')) return 'Generating tests';
    if (p.includes('update') || p.includes('modify') || p.includes('change')) return 'Preparing modifications';
    if (p.includes('list') || p.includes('show') || p.includes('get')) return 'Fetching information';
    if (p.includes('run') || p.includes('execute') || p.includes('start')) return 'Preparing to run';

    return 'Processing your request';
}

function describeCommand(cmd: string): string {
    const c = cmd.trim().toLowerCase();
    if (c.startsWith('set-content') || c.startsWith('cat <<') || c.includes('> ')) {
        const fileMatch = cmd.match(/["']([\w/\\.-]+)["']/i);
        return fileMatch ? `Writing ${fileMatch[1]}` : 'Writing file';
    }
    if (c.startsWith('mkdir') || c.startsWith('new-item')) return 'Creating directory';
    if (c.startsWith('npm install') || c.startsWith('pip install')) return 'Installing dependencies';
    if (c.startsWith('npm run') || c.startsWith('node ')) return 'Running application';
    if (c.startsWith('git ')) return 'Performing Git operation';
    if (c.startsWith('docker')) return 'Managing containers';
    if (c.startsWith('curl') || c.startsWith('invoke-restmethod')) return 'Making HTTP request';
    if (c.startsWith('test-path') || c.startsWith('get-childitem') || c.startsWith('ls') || c.startsWith('dir')) return 'Checking file system';
    if (c.startsWith('remove-item') || c.startsWith('rm ')) return 'Removing files';
    return 'Executing command';
}

// ─── Core Chat with FSM ─────────────────────────────────────────────────────

async function runChat(prompt: string, modelId: string, mode: string, isYolo: boolean, parentFsm?: SessionFSM) {
    const config = getConfig();

    // ─── Persona 7: Intent Detection ─────
    // Auto-switch to todo mode if user signals non-coding intent
    if (mode !== 'todo' && detectNonCodingIntent(prompt)) {
        console.log(chalk.cyan('💡 Detected non-coding intent — switching to Smart Todo mode\n'));
        mode = 'todo';
    }

    // ─── STATE: IDLE → AUTH_CHECK ─────
    // If coming from error recovery, reuse the parent session
    const fsm = parentFsm || new SessionFSM(mode, prompt);
    if (!parentFsm) fsm.transition('AUTH_CHECK');

    if (!config.apiKey) {
        console.error(chalk.red('Error: Not authenticated. Run "brain auth" first.'));
        fsm.transition('ABORTED', { reason: 'no_api_key' });
        fsm.reportToCloud('');
        process.exit(1);
    }

    showBanner(mode, fsm.id);

    // ─── STATE: AUTH_CHECK → CONTEXT_SCAN ─────
    // Ensure we're in CONTEXT_SCAN before calling API.
    // Handle ALL possible entry states:
    //   - New session: IDLE → AUTH_CHECK (done above) → CONTEXT_SCAN → API_CALL
    //   - Interactive reuse: parentFsm arrives at CONTEXT_SCAN from Gold fix → API_CALL
    //   - Error Recovery: parentFsm arrives at ERROR_RECOVERY → API_CALL (direct, allowed)
    const currentState = fsm.session.currentState;
    if (currentState === 'AUTH_CHECK') {
        fsm.transition('CONTEXT_SCAN');
    } else if (currentState === 'DONE' || currentState === 'ABORTED') {
        // Interactive or retry: reset the full chain
        fsm.transition('IDLE');
        fsm.transition('AUTH_CHECK');
        fsm.transition('CONTEXT_SCAN');
    } else if (currentState === 'IDLE') {
        // Shouldn't normally land here, but just in case
        fsm.transition('AUTH_CHECK');
        fsm.transition('CONTEXT_SCAN');
    }
    // If currentState is ERROR_RECOVERY or CONTEXT_SCAN, we proceed directly to API_CALL

    let context: string | undefined;
    if (CONTEXT_MODES.has(mode)) {
        console.log(chalk.cyan('📂 Scanning project structure...'));
        context = ['review', 'security', 'docs'].includes(mode)
            ? getReviewContext()
            : `Project: ${path.basename(process.cwd())}\n${getProjectTree()}`;
    } else if (needsProjectContext(prompt)) {
        context = getProjectTree();
    }

    // ─── STATE: → API_CALL ─────
    // CONTEXT_SCAN → API_CALL or ERROR_RECOVERY → API_CALL (both valid)
    fsm.transition('API_CALL', { model: modelId });

    // Fix: Inject OS-specific system instruction to force file persistence
    const osName = detectOS();
    const isWin = osName === 'windows';
    const projectType = getProjectContext();

    let shellName = 'Bash';
    if (osName === 'windows') shellName = 'PowerShell';
    else if (osName === 'macos') shellName = 'Zsh';

    const fileCmd = isWin ? 'Set-Content -Path "filename" -Value "content"' : 'cat <<EOF > filename';

    // In todo mode, use the task decomposition prompt instead of shell commands
    const systemInstruction = mode === 'todo' ? TODO_SYSTEM_PROMPT :
        `[SYSTEM: You are on ${osName === 'windows' ? 'Windows 11' : osName}. ` +
        `Output ONLY ${shellName} commands. ` +
        `Current Project Type: ${projectType}. ` +
        `NEVER use interactive text editors (nano, vim). ` +
        `ALWAYS save code to files using ${fileCmd}. ` +
        `DO NOT just print code. Wrapp all code in creating files patterns.]\n\n`;

    const spinner = ora(chalk.cyan(`⚡ ${describeIntent(prompt, mode)}...`)).start();

    try {
        // Stateful Memory Logic:
        // 1. Append User Prompt to History
        const userMsg = { role: 'user', content: prompt };
        fsm.session.messages.push(userMsg);

        // 2. Construct Payload (System Prompt + History)
        // Note: We inject the System Instruction into the *latest* message for strongest effect,
        // but we assume the backend handles the conversation history window.
        const payloadMessages = [...fsm.session.messages];
        // Mutate the last message in the PAYLOAD ONLY to include system instruction
        payloadMessages[payloadMessages.length - 1] = {
            role: 'user',
            content: systemInstruction + prompt
        };

        const response = await axios.post(`${API_URL}/gateway/chat`, {
            model: modelId,
            messages: payloadMessages,
            mode,
            os: detectOS(),
            context
        }, {
            headers: { 'Authorization': `Bearer ${config.apiKey}` },
            timeout: 120000
        });

        spinner.succeed(chalk.green(`${describeIntent(prompt, mode)} — done`));

        const data = response.data;
        let content = '';
        if (data.choices?.[0]?.message) content = data.choices[0].message.content;
        else if (data.response) content = data.response;
        else {
            console.log(JSON.stringify(data, null, 2));
            fsm.transition('DISPLAY', { reason: 'unexpected_response_format' });
            fsm.transition('DONE', { reason: 'unexpected_response_format' });
            fsm.reportToCloud(config.apiKey);
            return;
        }

        // 3. Append AI Response to History
        fsm.session.messages.push({ role: 'assistant', content });
        fsm.save();

        // ─── STATE: API_CALL → DISPLAY ─────
        fsm.transition('DISPLAY');

        // Guard: AI may return empty/null content for ambiguous prompts
        if (!content || content.trim().length === 0) {
            console.log(chalk.yellow('⚠️  AI returned an empty response. Try rephrasing your prompt.'));
            fsm.transition('DONE', { reason: 'empty_response' });
            fsm.reportToCloud(config.apiKey);
            return;
        }

        if (NON_EXEC_MODES.has(mode)) {
            // ─── Persona 1+2+3+9: Todo Mode with Smart Plan ─────
            if (mode === 'todo') {
                const plan = parseTodoPlan(content);
                if (plan) {
                    renderTodoList(plan);
                    fsm.transition('PLAN_REVIEW', { commandCount: plan.tasks.length });
                    fsm.transition('AWAITING_CONFIRM');
                    await todoApprovalWorkflow(plan, fsm, modelId, mode, isYolo, config);
                    return;
                } else {
                    // LLM didn't return valid JSON — show as markdown fallback
                    console.log(chalk.yellow('📋 Task Plan (text format):'));
                    console.log(marked(content));
                    fsm.transition('DONE', { reason: 'todo_text_fallback' });
                    fsm.reportToCloud(config.apiKey);
                    return;
                }
            }

            const emoji = mode === 'plan' ? '📋' : mode === 'review' ? '🔍' : mode === 'security' ? '🛡️' : '📝';
            console.log(chalk.green(`${emoji} ${MODE_LABELS[mode] || 'Response'}:`));
            console.log(marked(content));
            fsm.transition('DONE', { reason: 'non_exec_mode' });
            fsm.reportToCloud(config.apiKey);
            return;
        }

        console.log(chalk.green('📄 Generated plan:'));
        console.log(marked(content));

        let commands = extractShellBlocks(content);

        // ─── Gold Fix: Auto-Retry on Parse Failure ─────
        // If no commands extracted, re-prompt the model with formatting instructions
        if (commands.length === 0 && !parentFsm) {
            console.log(chalk.yellow('⚠️  Could not parse commands from response. Retrying with clearer instructions...'));
            try {
                const retryResponse = await axios.post(`${API_URL}/gateway/chat`, {
                    model: modelId,
                    messages: [{ role: 'user', content: `You must wrap ALL commands in markdown code blocks using \`\`\`powershell or \`\`\`bash fences. Rewrite your previous answer with proper formatting:\n\n${content}` }],
                    mode,
                    os: detectOS(),
                    context
                }, {
                    headers: { 'Authorization': `Bearer ${config.apiKey}` },
                    timeout: 120000
                });
                const retryData = retryResponse.data;
                let retryContent = '';
                if (retryData.choices?.[0]?.message) retryContent = retryData.choices[0].message.content;
                else if (retryData.response) retryContent = retryData.response;
                if (retryContent) {
                    commands = extractShellBlocks(retryContent);
                    if (commands.length > 0) {
                        console.log(chalk.green('✅ Got it — commands parsed successfully.'));
                        console.log(marked(retryContent));
                    }
                }
            } catch (retryErr) {
                // Retry failed silently, fall through to 0-commands path
            }
        }

        if (commands.length === 0) {
            fsm.transition('DONE', { reason: 'no_commands_detected' });
            fsm.reportToCloud(config.apiKey);
            return;
        }

        // ─── STATE: DISPLAY → PLAN_REVIEW ─────
        fsm.transition('PLAN_REVIEW', { commandCount: commands.length });

        // Save pending commands for resume
        const allLines = commands.flatMap(c => c.split('\n').filter(l => l.trim()));
        fsm.session.pendingCommands = [...allLines];
        fsm.session.executedCommands = [];
        fsm.save();

        console.log(chalk.bgYellow.black.bold('\n ┌─────────────────────────────────────┐ '));
        console.log(chalk.bgYellow.black.bold(' │       📋 EXECUTION PLAN              │ '));
        console.log(chalk.bgYellow.black.bold(' └─────────────────────────────────────┘ '));
        console.log(chalk.cyan('\nCommands to execute:'));
        commands.forEach((cmd, i) => {
            cmd.split('\n').forEach(line => {
                console.log(chalk.white(`  ${i + 1}. `) + chalk.gray(line));
            });
        });
        console.log(chalk.gray(`\n  Total: ${commands.length} block(s) | Session: ${fsm.id}\n`));

        // ─── YOLO SAFETY GUARD ─────
        // Check for dangerous commands BEFORE auto-executing
        const dangerousLines = allLines.filter(l => isDangerousCommand(l));
        if (dangerousLines.length > 0 && isYolo) {
            console.log(chalk.bgRed.white.bold('\n ⛔ YOLO SAFETY GUARD '));
            console.log(chalk.red('  Dangerous commands detected — YOLO auto-execute BLOCKED:\n'));
            dangerousLines.forEach(d => console.log(chalk.red(`    🚫 ${d}`)));
            console.log(chalk.yellow('\n  Switching to manual confirmation for your safety.\n'));
            isYolo = false; // Downgrade to manual confirmation
        }

        // ─── STATE: PLAN_REVIEW → AWAITING_CONFIRM ─────
        fsm.transition('AWAITING_CONFIRM');

        let shouldExecute = isYolo;
        if (!isYolo) {
            const { confirm } = await inquirer.prompt([{
                type: 'confirm', name: 'confirm',
                message: chalk.yellow('Execute this plan?'), default: false
            }]);
            shouldExecute = confirm;
        } else {
            console.log(chalk.magenta('⚡ Auto-executing plan...\n'));
        }

        if (!shouldExecute) {
            fsm.transition('ABORTED', { reason: 'user_rejected' });
            fsm.reportToCloud(config.apiKey);
            return;
        }

        // ─── STATE: AWAITING_CONFIRM → EXECUTING ─────
        fsm.transition('EXECUTING');
        console.log(chalk.blue('🚀 Executing...\n'));

        for (let bi = 0; bi < commands.length; bi++) {
            const cmdBlock = commands[bi];
            const stepLabel = commands.length > 1 ? `[${bi + 1}/${commands.length}] ` : '';
            console.log(chalk.gray(`${stepLabel}${describeCommand(cmdBlock)}...`));
            const result = execCommand(cmdBlock);

            if (result.stdout) console.log(result.stdout);

            if (result.code !== 0) {
                // ─── STATE: EXECUTING → CMD_FAILED ─────
                fsm.session.commandsFailed++;
                fsm.transition('CMD_FAILED', { command: cmdBlock.substring(0, 100), exitCode: result.code, error: result.stderr?.substring(0, 500) });

                console.error(chalk.red(`\n❌ Failed block (exit ${result.code})`));
                if (result.stderr) console.error(chalk.red(result.stderr));

                const { shouldFix } = await inquirer.prompt([{
                    type: 'confirm', name: 'shouldFix',
                    message: chalk.yellow('Analyze and fix this error?'), default: true
                }]);

                if (shouldFix) {
                    // ─── STATE: CMD_FAILED → ERROR_RECOVERY ─────
                    fsm.transition('ERROR_RECOVERY', { action: 'auto_fix' });
                    console.log(chalk.cyan(`\n🔧 Analyzing the error and preparing a fix...\n`));

                    // Recurse with SAME session (sovereign continuity)
                    await runChat(
                        `Fix this error in PowerShell block. Command:\n${cmdBlock}\nError:\n${result.stderr || result.stdout}`,
                        modelId, 'fix', false, fsm
                    );
                } else {
                    fsm.transition('ABORTED', { reason: 'user_skipped_fix' });
                    fsm.reportToCloud(config.apiKey);
                }
                return;
            }

            // ─── STATE: EXECUTING → CMD_SUCCESS ─────
            fsm.session.commandsExecuted++;
            if (!fsm.session.executedCommands) fsm.session.executedCommands = [];
            fsm.session.executedCommands.push(cmdBlock.substring(0, 100));
            fsm.transition('CMD_SUCCESS', { command: cmdBlock.substring(0, 100) });

            // If more commands, transition back to EXECUTING
            const executedCount = fsm.session.commandsExecuted || 0;
            if (executedCount < commands.length) {
                fsm.transition('EXECUTING');
            }
        }

        // ─── STATE: → DONE ─────
        fsm.transition('DONE', { reason: 'all_commands_succeeded' });
        console.log(chalk.green(`\n✅ Done! ${commands.length === 1 ? 'Command' : 'All ' + commands.length + ' commands'} executed successfully.`));
        console.log(chalk.gray(`   Session: ${fsm.id}`));
        fsm.reportToCloud(config.apiKey);

    } catch (error: any) {
        spinner.fail(chalk.red('Request failed — something went wrong.'));
        fsm.transition('ABORTED', { reason: 'error', message: error.message?.substring(0, 300) });
        fsm.reportToCloud(config.apiKey);

        if (error.response) {
            console.error(chalk.red(`Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`));
        } else if (error.code === 'ECONNABORTED') {
            console.error(chalk.red('Error: Request timed out.'));
        } else {
            console.error(chalk.red('Error:', error.message));
        }
    }
}

// ─── Resume Logic ────────────────────────────────────────────────────────────

async function resumeSession(sessionId: string, modelId: string) {
    const fsm = SessionFSM.restore(sessionId);
    if (!fsm) {
        console.error(chalk.red(`Session ${sessionId} not found in ~/.brain/sessions/`));
        return;
    }

    const s = fsm.session;
    console.log(chalk.cyan(`\n🔄 Resuming session ${sessionId}`));
    console.log(chalk.gray(`   State: ${s.currentState} | Mode: ${s.mode}`));
    console.log(chalk.gray(`   Executed: ${s.commandsExecuted} | Failed: ${s.commandsFailed}`));
    console.log(chalk.gray(`   Pending: ${s.pendingCommands?.length || 0} commands\n`));

    if (!s.pendingCommands || s.pendingCommands.length === 0) {
        console.log(chalk.yellow('No pending commands to resume.'));
        return;
    }

    console.log(chalk.cyan('Pending commands:'));
    s.pendingCommands.forEach((cmd, i) => {
        console.log(chalk.white(`  ${i + 1}. `) + chalk.gray(cmd));
    });

    const { confirm } = await inquirer.prompt([{
        type: 'confirm', name: 'confirm',
        message: chalk.yellow('Resume execution?'), default: true
    }]);

    if (!confirm) return;

    const config = getConfig();
    for (const cmd of [...s.pendingCommands]) {
        console.log(chalk.gray(`> ${cmd}`));
        const result = execCommand(cmd);
        if (result.stdout) console.log(result.stdout);

        if (result.code !== 0) {
            s.commandsFailed++;
            console.error(chalk.red(`❌ Failed: "${cmd}"`));
            if (result.stderr) console.error(chalk.red(result.stderr));
            fsm.save();
            fsm.reportToCloud(config.apiKey || '');
            return;
        }

        s.commandsExecuted++;
        s.executedCommands?.push(cmd);
        const idx = s.pendingCommands!.indexOf(cmd);
        if (idx > -1) s.pendingCommands!.splice(idx, 1);
        fsm.save();
    }

    console.log(chalk.green('\n✅ All pending commands completed!'));
    s.currentState = 'DONE';
    s.endedAt = new Date().toISOString();
    fsm.save();
    fsm.reportToCloud(config.apiKey || '');
}

// ─── CLI Commands ────────────────────────────────────────────────────────────

program.name('brain').description('Coding Brain CLI v3.0 — Sovereign FSM • 16 Modes').version('3.0.0');

program.command('auth').description('Authenticate with your API key').action(async () => {
    console.log(chalk.blue('Generate a CLI API Key from: https://coding.super25.ai/keys'));
    const answers = await inquirer.prompt([{ type: 'password', name: 'apiKey', message: 'Enter your API Key:', mask: '*' }]);
    const config = getConfig();
    config.apiKey = answers.apiKey.trim();
    saveConfig(config);
    console.log(chalk.green('✔ API Key saved!'));
});

program.command('config').description('View current configuration').action(() => {
    const config = getConfig();
    console.log(chalk.cyan('Config:'));
    console.log(JSON.stringify(config, null, 2));
});

program.command('modes').description('List all available modes').action(() => {
    console.log(chalk.cyan('\n📋 Available Modes:\n'));
    Object.entries(MODE_LABELS).forEach(([key, label]) => {
        const flag = key === 'default' ? '(default)' : `--${key}`;
        console.log(`  ${chalk.white(flag.padEnd(15))} ${label}`);
    });
    console.log(chalk.gray('\nExample: brain --security'));
    console.log(chalk.gray('Example: brain --deploy to kubernetes'));
    console.log(chalk.gray('Example: brain -y create a REST API'));
    console.log(chalk.gray('Example: brain --todo build a dashboard\n'));
});

program.command('sessions').description('List recent local sessions').action(() => {
    const files = fs.readdirSync(SESSIONS_DIR).filter((f: string) => f.endsWith('.json')).sort().reverse().slice(0, 20);
    if (files.length === 0) {
        console.log(chalk.gray('No sessions found.'));
        return;
    }
    console.log(chalk.cyan('\n📋 Recent Sessions:\n'));
    console.log(chalk.gray('  ID                                     State      Mode         Cmds   Prompt'));
    console.log(chalk.gray('  ' + '─'.repeat(90)));
    for (const f of files) {
        try {
            const s = JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, f), 'utf-8')) as LocalSession;
            const stateColor = s.currentState === 'DONE' ? chalk.green : s.currentState === 'ABORTED' ? chalk.red : chalk.yellow;
            console.log(
                `  ${chalk.white(s.sessionId.substring(0, 36))}  ` +
                `${stateColor(s.currentState.padEnd(10))} ` +
                `${chalk.cyan(s.mode.padEnd(12))} ` +
                `${chalk.white(String(s.commandsExecuted).padEnd(6))} ` +
                `${chalk.gray(s.prompt.substring(0, 40))}`
            );
        } catch { /* skip corrupted */ }
    }
    console.log('');
});

program.command('resume <sessionId>').description('Resume a crashed/interrupted session').action(async (sessionId) => {
    await resumeSession(sessionId, 'glm-4.7-flash');
});

program.command('todos').description('List saved task plans').action(() => {
    const todos = loadAllTodos();
    if (todos.length === 0) {
        console.log(chalk.gray('No saved task plans. Create one with: brain --todo "your task"'));
        return;
    }
    console.log(chalk.cyan('\n📋 Saved Task Plans:\n'));
    console.log(chalk.gray('  Session ID                               Title                          Tasks   Status'));
    console.log(chalk.gray('  ' + '─'.repeat(95)));
    for (const plan of todos.slice(0, 15)) {
        const done = plan.tasks.filter(t => t.done).length;
        const total = plan.tasks.length;
        const statusColor = done === total ? chalk.green : done > 0 ? chalk.yellow : chalk.gray;
        const status = done === total ? 'Complete' : done > 0 ? `${done}/${total} done` : 'Pending';
        console.log(
            `  ${chalk.white((plan.sessionId || '').substring(0, 36).padEnd(38))} ` +
            `${chalk.cyan(plan.title.substring(0, 30).padEnd(32))} ` +
            `${chalk.white(String(total).padEnd(7))} ` +
            `${statusColor(status)}`
        );
    }
    console.log();
});

// Default command
program
    .command('run', { isDefault: true })
    .description('Ask the Brain anything or give it a task')
    .argument('[prompt...]', 'Your question or task')
    .option('-m, --model <modelId>', 'Choose AI model', 'glm-4.7-flash')
    .option('-y, --yolo', 'Auto-execute', false)
    .option('-r, --review', 'Code review mode', false)
    .option('-i, --infra', 'Infrastructure/DevOps mode', false)
    .option('-f, --fix', 'Debug and fix mode', false)
    .option('-p, --plan', 'Plan-only mode', false)
    .option('--architect', 'System architecture mode', false)
    .option('--docs', 'Documentation writer mode', false)
    .option('--security', 'Security audit mode', false)
    .option('--test', 'Test writer mode', false)
    .option('--refactor', 'Refactoring mode', false)
    .option('--migrate', 'Migration planning mode', false)
    .option('--optimize', 'Performance optimization mode', false)
    .option('--deploy', 'Deployment config mode', false)
    .option('--explain', 'Junior-friendly explanation mode', false)
    .option('--git', 'Git expert mode', false)
    .option('--todo', 'Smart task planning mode', false)
    .action(async (promptParts, options) => {
        const modeFlags = ['review', 'infra', 'fix', 'plan', 'yolo', 'architect', 'docs',
            'security', 'test', 'refactor', 'migrate', 'optimize', 'deploy', 'explain', 'git', 'todo'];
        let mode = 'default';
        for (const f of modeFlags) { if (options[f]) { mode = f; break; } }

        let prompt = promptParts.join(' ');

        // Interactive Mode if no prompt
        if (!prompt) {
            console.log(chalk.cyan("🚀 Entering Interactive Mode (type 'exit' to quit)"));

            // Initialize persistent session for the loop
            const interactiveFsm = new SessionFSM(mode, 'interactive_session_start');
            interactiveFsm.transition('AUTH_CHECK'); // Do initial checks
            if (CONTEXT_MODES.has(mode) || needsProjectContext('')) interactiveFsm.transition('CONTEXT_SCAN');

            while (true) {
                const { input } = await inquirer.prompt([{
                    type: 'input',
                    name: 'input',
                    message: chalk.green('brain>')
                }]);

                if (!input || input.trim() === '') continue;
                if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') process.exit(0);

                // Gold Fix: Reset FSM state for next turn in interactive mode
                // After a completed turn (DONE), reset to CONTEXT_SCAN so the next
                // runChat call can properly transition to API_CALL.
                const currentState = interactiveFsm.session.currentState;
                if (currentState === 'DONE' || currentState === 'ABORTED') {
                    interactiveFsm.transition('IDLE');
                    interactiveFsm.transition('AUTH_CHECK');
                    interactiveFsm.transition('CONTEXT_SCAN');
                }

                // Inject Invisible Context for Interactive Mode too
                // Pass the SAME FSM instance to maintain history
                await runChat(input, options.model, mode, options.yolo, interactiveFsm);
            }
        } else {
            // Check for mode-specific auto-prompts
            const autoPrompts: Record<string, string> = {
                review: 'Perform a comprehensive code review of this project.',
                security: 'Perform an OWASP Top 10 security audit of this project.',
                fix: 'Scan this project for errors and suggest fixes.',
                test: 'Generate comprehensive tests for this project.',
                docs: 'Generate comprehensive documentation for this project.',
                optimize: 'Analyze this project for performance bottlenecks.',
                refactor: 'Identify refactoring opportunities. Apply DRY and SOLID.',
            };
            if (!prompt && autoPrompts[mode]) prompt = autoPrompts[mode];
            if (!prompt) { program.help(); return; }

            await runChat(prompt, options.model, mode, options.yolo);
        }
    });

program.parse(process.argv);
