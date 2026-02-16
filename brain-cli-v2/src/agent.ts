/**
 * Agent loop — CloudBrain CLI v2
 *
 * Architecture: JSON Tool Calling Loop
 *
 * The GLM model doesn't support OpenAI function-calling wire format natively,
 * but it CAN output structured JSON reliably when prompted correctly.
 *
 * Loop:
 *   1. Send messages to model with tool schema in system prompt
 *   2. Model responds with either:
 *      a. A tool call: { "tool": "name", "args": {...} }
 *      b. Final text answer (no tool call)
 *   3. If tool call: execute it, append result, go to step 1
 *   4. If text: display and exit
 *
 * This gives us the same agentic multi-step behavior as Vercel AI SDK's
 * generateText({ tools, maxSteps }) but works with any model that can
 * output JSON — which GLM can do reliably.
 */

import { generateText } from 'ai';
import chalk from 'chalk';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { getCloudbBrainModel } from './provider.js';
import { ALL_TOOLS } from './tools.js';

// ─── Mode System ──────────────────────────────────────────────────────────────

export const MODES = {
    default:   '🧠 Default (Coding agent)',
    review:    '🔍 Code Review',
    fix:       '🔧 Debug & Fix',
    plan:      '📋 Plan Only',
    security:  '🛡️  Security Audit (OWASP)',
    test:      '🧪 Test Writer',
    refactor:  '♻️  Refactorer',
    docs:      '📝 Documentation Writer',
    explain:   '💡 Explain (Junior-Friendly)',
    git:       '🌿 Git Expert',
    infra:     '🏗️  Infrastructure / DevOps',
    architect: '🏛️  System Architect',
    optimize:  '📈 Performance Optimizer',
    deploy:    '🚀 Deployer',
    migrate:   '🔄 Migration Planner',
} as const;

export type Mode = keyof typeof MODES;

const READ_ONLY_MODES = new Set<Mode>(['plan', 'review', 'security', 'architect', 'explain']);

// ─── Tool Schema for System Prompt ───────────────────────────────────────────

const TOOL_SCHEMA = `
You have access to these tools. To call a tool, respond with ONLY valid JSON on a single line:
{"tool":"<name>","args":{<arguments>}}

Available tools:
- list_dir: List files in a directory. Args: {"path":"<optional dir>","cwd":"<optional>"}
- read_file: Read a file's contents. Args: {"path":"<file path>","cwd":"<optional>"}
- create_file: Write content to a file (FILES ONLY, not directories). Args: {"path":"<file>","content":"<content>","cwd":"<optional>"}
- run_command: Run a shell command. Args: {"command":"<cmd>","cwd":"<optional absolute path>"}
- change_dir: Change working directory. Args: {"path":"<dir path>"}

Rules:
- To create DIRECTORIES, use run_command with: "New-Item -ItemType Directory -Path 'folder'" (Windows) or "mkdir -p folder" (Linux/Mac)
- To create FILES, use create_file tool. NEVER use create_file for directories - it will create an empty file instead.
- When asked to create "a project called X", first create a directory named X, then change into it, then create the project files.
- When creating files in subdirectories (e.g., "src/app.js"), create the parent directory first if it doesn't exist.
- Call ONE tool at a time. Wait for its result before calling the next.
- Always call list_dir or read_file first to understand context before modifying files.
- For multi-step tasks: plan your steps, then execute them one tool call at a time.
- When done with all tool calls, respond with plain text (no JSON) summarizing what you did.
- If a tool returns an error, reason about why and try a different approach.
- NEVER include markdown fences around tool calls. Just raw JSON on one line.
- For create_file, write the full file content in the "content" field directly.
- CRITICAL: Inside JSON strings, escape all special characters: " becomes \\" and \\ becomes \\\\
- Example: {"tool":"create_file","args":{"path":"file.txt","content":"He said \\"hello\\" to me."}}
`;

// ─── System Prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(mode: Mode, cwd: string): string {
    const platform = os.platform() === 'win32' ? 'Windows 11 (PowerShell)' : 'Linux/macOS (bash)';
    const snapshot = getProjectSnapshot(cwd);
    // Normalize Windows paths to forward slashes for JSON-safe output
    const normalizedCwd = cwd.replace(/\\/g, '/');

    const base =
        `You are an expert software engineer assistant (CloudBrain CLI v2).\n` +
        `Platform: ${platform}\n` +
        `Current working directory: ${normalizedCwd}\n` +
        `Project:\n${snapshot}\n\n`;

    if (READ_ONLY_MODES.has(mode)) {
        return base +
            `Mode: ${MODES[mode]}\n` +
            `You are in READ-ONLY analysis mode. Do NOT use any tools. ` +
            `Respond with clear, well-structured analysis text only.\n`;
    }

    return base + `Mode: ${MODES[mode]}\n` + TOOL_SCHEMA;
}

function getProjectSnapshot(cwd: string): string {
    try {
        const entries = fs.readdirSync(cwd, { withFileTypes: true }).slice(0, 25);
        const lines = entries.map(e => `  ${e.isDirectory() ? '📁' : '📄'} ${e.name}`);
        const pkgPath = path.join(cwd, 'package.json');
        if (fs.existsSync(pkgPath)) {
            try {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
                lines.unshift(`  📦 ${pkg.name}@${pkg.version}`);
            } catch { /* ignore */ }
        }
        return lines.join('\n') || '  (empty directory)';
    } catch {
        return '  (unable to read directory)';
    }
}

// ─── Tool Executor ────────────────────────────────────────────────────────────

type ToolCall = { tool: string; args: Record<string, any> };

function parseToolCall(text: string): ToolCall | null {
    // Find the first JSON object that looks like a tool call
    const match = text.match(/\{[\s\S]*?"tool"\s*:\s*"[^"]+"/);
    if (!match) return null;

    // Try to extract a complete JSON object starting from the match
    const start = text.indexOf(match[0]);
    let depth = 0;
    let end = start;
    let inString = false;
    let escapeNext = false;

    for (let i = start; i < text.length; i++) {
        const char = text[i];

        if (escapeNext) {
            escapeNext = false;
            continue;
        }

        if (char === '\\') {
            escapeNext = true;
            continue;
        }

        if (char === '"' && !escapeNext) {
            inString = !inString;
            continue;
        }

        if (!inString) {
            if (char === '{') depth++;
            else if (char === '}') {
                depth--;
                if (depth === 0) { end = i + 1; break; }
            }
        }
    }

    try {
        const jsonStr = text.slice(start, end);
        const obj = JSON.parse(jsonStr);
        if (typeof obj.tool === 'string' && typeof obj.args === 'object') {
            return obj as ToolCall;
        }
        return null;
    } catch (err) {
        // Attempt to repair common JSON issues
        const jsonStr = text.slice(start, end);

        // Try fixing unescaped quotes in content field by using regex to find and escape them
        // This is a best-effort repair for LLM-generated JSON
        try {
            // Extract content field value and properly escape it
            const contentMatch = jsonStr.match(/"content"\s*:\s*"(.*?)(?:",|"\})/s);
            if (contentMatch) {
                const rawContent = contentMatch[1];
                // Escape unescaped quotes (not preceded by backslash)
                const fixedContent = rawContent.replace(/(?<!\\)"/g, '\\"');
                const fixedJson = jsonStr.replace(
                    /"content"\s*:\s*".*?(?:",|"\})/s,
                    `"content":"${fixedContent}"${contentMatch[0].endsWith('}') ? '}' : ','}`
                );
                const obj = JSON.parse(fixedJson);
                if (typeof obj.tool === 'string' && typeof obj.args === 'object') {
                    console.log(chalk.yellow('  ⚠️  Repaired malformed JSON in tool call'));
                    return obj as ToolCall;
                }
            }
        } catch (repairErr) {
            // Repair failed, continue to debug logging
        }

        // If JSON parse fails, log for debugging
        if (process.env.DEBUG) {
            console.error(chalk.dim(`  [DEBUG] Failed to parse tool call: ${jsonStr.substring(0, 200)}...`));
            console.error(chalk.dim(`  [DEBUG] Error: ${err}`));
        }
        return null;
    }
}

async function executeTool(toolCall: ToolCall, yolo: boolean): Promise<string> {
    const { tool, args } = toolCall;

    const toolDef = (ALL_TOOLS as any)[tool];
    if (!toolDef) {
        return JSON.stringify({ success: false, error: `Unknown tool: ${tool}` });
    }

    // Confirmation for write operations in non-yolo mode
    const isWriteOp = ['run_command', 'create_file', 'change_dir'].includes(tool);
    if (!yolo && isWriteOp) {
        const preview = tool === 'run_command'
            ? args.command
            : tool === 'create_file'
            ? `create ${args.path}`
            : `cd ${args.path}`;

        console.log(chalk.yellow(`\n  🔔 ${tool}: ${preview}`));
        const confirmed = await confirmAction('  Execute? [Y/n] ');
        if (!confirmed) {
            console.log(chalk.gray('  Skipped.'));
            return JSON.stringify({ success: false, skipped: true });
        }
    }

    try {
        const result = await toolDef.execute(args);
        return JSON.stringify(result);
    } catch (err: any) {
        return JSON.stringify({ success: false, error: err.message });
    }
}

function confirmAction(prompt: string): Promise<boolean> {
    return new Promise((resolve) => {
        process.stdout.write(prompt);
        process.stdin.setEncoding('utf8');
        process.stdin.resume();
        process.stdin.once('data', (data) => {
            process.stdin.pause();
            const answer = data.toString().trim().toLowerCase();
            resolve(answer === '' || answer === 'y' || answer === 'yes');
        });
    });
}

// ─── Agent Run ────────────────────────────────────────────────────────────────

export interface RunOptions {
    model?: string;
    mode?: Mode;
    yolo?: boolean;
    maxSteps?: number;
}

export async function runAgent(userPrompt: string, options: RunOptions = {}): Promise<void> {
    const {
        model: modelId = 'glm-4.7-flash',
        mode = 'default',
        yolo = false,
        maxSteps = 20,
    } = options;

    const cwd = process.cwd();
    const model = getCloudbBrainModel(modelId);
    const isReadOnly = READ_ONLY_MODES.has(mode);

    console.log(chalk.dim(`\n  Mode: ${MODES[mode]} | CWD: ${cwd}\n`));

    // Message history for the loop
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
        { role: 'user', content: userPrompt }
    ];

    let steps = 0;
    let toolCallCount = 0;

    try {
        while (steps < maxSteps) {
            steps++;

            // Call the model
            const { text } = await generateText({
                model,
                system: buildSystemPrompt(mode, process.cwd()), // use current cwd — may change via change_dir
                messages,
            });

            const responseText = text?.trim() || '';

            if (!responseText) {
                console.log(chalk.yellow('  (empty response)'));
                break;
            }

            // Check if this is a tool call
            if (!isReadOnly) {
                const toolCall = parseToolCall(responseText);

                if (toolCall) {
                    toolCallCount++;
                    console.log(chalk.cyan(`\n  → ${toolCall.tool}`) + chalk.dim(` ${JSON.stringify(toolCall.args).substring(0, 100)}`));

                    // Execute the tool
                    const toolResult = await executeTool(toolCall, yolo);
                    const parsed = JSON.parse(toolResult);

                    // Show result
                    if (parsed.success === false && parsed.error) {
                        console.log(chalk.red(`  ✗ ${parsed.error}`));
                    } else if (parsed.content) {
                        // read_file result — show truncated
                        console.log(chalk.dim(`  ✓ ${parsed.lines} lines read`));
                    } else if (parsed.items) {
                        // list_dir result — show summary
                        const dirs = parsed.items.filter((i: any) => i.type === 'dir').length;
                        const files = parsed.items.filter((i: any) => i.type === 'file').length;
                        console.log(chalk.dim(`  ✓ ${dirs} dirs, ${files} files`));
                        parsed.items.forEach((item: any) => {
                            console.log(chalk.dim(`    ${item.type === 'dir' ? '📁' : '📄'} ${item.name}`));
                        });
                    } else if (parsed.stdout) {
                        console.log(parsed.stdout);
                    }

                    // Append to conversation: model's tool call + result
                    messages.push({ role: 'assistant', content: responseText });
                    messages.push({ role: 'user', content: `Tool result for ${toolCall.tool}: ${toolResult}` });
                    continue; // next iteration
                }
            }

            // No tool call — this is the final response
            console.log(chalk.white('\n' + responseText));
            break;
        }

        if (steps >= maxSteps) {
            console.log(chalk.yellow(`\n  ⚠️  Reached max steps (${maxSteps}). Task may be incomplete.`));
        }

        console.log(chalk.green(`\n✅ Done`) + chalk.dim(` (${steps} step${steps !== 1 ? 's' : ''}, ${toolCallCount} tool call${toolCallCount !== 1 ? 's' : ''})`));

    } catch (err: any) {
        if (err.message?.includes('No API key')) {
            console.error(chalk.red('\n✗ No API key. Run: brain auth'));
        } else if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
            console.error(chalk.red('\n✗ Invalid API key. Run: brain auth'));
        } else {
            console.error(chalk.red(`\n✗ Error: ${err.message}`));
            if (process.env.DEBUG) console.error(err);
        }
        process.exit(1);
    }
}
