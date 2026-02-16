/**
 * Tool definitions for the CloudBrain agent.
 */

import { tool } from 'ai';
import { z } from 'zod';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';

// ─── Safety Guard ─────────────────────────────────────────────────────────────

const BLOCKED_PATTERNS = [
    // Recursive/force deletion of drives or root
    /rm\s+-[rf]+\s+\//i,
    /Remove-Item.*-Recurse.*-Force.*(c:[\\\/]|[\\\/]\s*$)/i,
    /Remove-Item.*-Recurse.*-Force\s+\.\s*$/im,   // Remove-Item -Recurse -Force .
    // CMD bulk delete
    /del\s+\/[sfq]/i,
    /del.*\/s.*\/[fq]/i,  // del with /s and /f or /q
    /rd\s+\/s/i,
    /rmdir\s+\/s/i,
    // Drive formats / disk wipes
    /format\s+[a-z]:/i,
    /mkfs/i,
    /dd\s+if=/i,
    />\s*\/dev\/sd[a-z]/i,
    // Cloud metadata exfil
    /169\.254\.169\.254/,
    /metadata\.google\.internal/,
    /100\.100\.100\.200/,
    // System control
    /shutdown|reboot|halt/i,
    /taskkill\s+\/f\s+\/im/i,
    /Stop-Process.*-Force/i,
    // System paths
    /[\\\/]windows[\\\/]system32/i,
    /[\\\/]etc[\\\/](passwd|shadow)/i,
    // Network lateral movement
    /^\s*ssh\s+\S+@/i,
    /^\s*ssh\s+-/i,
    /Enter-PSSession|New-PSSession/i,
    /Invoke-Command.*-ComputerName/i,
    /net\s+use\s+\\\\/i,
    // Script execution bypass
    /powershell.*-exec.*bypass/i,
    /powershell.*-encodedcommand/i,
    /powershell.*-enc\s/i,
    // Executing arbitrary .ps1/.bat/.cmd files (script bypass vector)
    /powershell(\.(exe))?\s+.*\.(ps1|psm1)/i,
    /cmd(\.(exe))?\s+\/[ck].*\.(bat|cmd)/i,
    /\.\s*\.(ps1|psm1|bat|cmd)\s*$/i,   // dot-sourcing: . ./script.ps1
    /&\s*["']?.*\.(ps1|psm1|bat|cmd)["']?\s*$/i,
    // Egress / download-execute
    /Invoke-WebRequest.*-OutFile/i,
    /certutil.*-urlcache/i,
    /bitsadmin.*\/transfer/i,
    /Start-Process.*-FilePath/i,
];

// Sensitive system paths that should not be read or written
const SYSTEM_PATH_PATTERNS = [
    /[\\\/]windows[\\\/]/i,
    /[\\\/]system32[\\\/]/i,
    /[\\\/]etc[\\\/](passwd|shadow|hosts|sudoers)/i,
    /[\\\/]proc[\\\/]/i,
];

function isSafe(cmd: string): { safe: boolean; reason?: string } {
    const normalized = cmd.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    // Test each line independently — chained commands must each be safe
    const lines = normalized.split('\n');
    for (const line of lines) {
        const t = line.trim();
        if (!t) continue;
        for (const pattern of BLOCKED_PATTERNS) {
            if (pattern.test(t)) {
                return { safe: false, reason: `Blocked: ${t.substring(0, 80)}` };
            }
        }
    }
    return { safe: true };
}

function isSystemPath(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/');
    return SYSTEM_PATH_PATTERNS.some(p => p.test(normalized));
}

// Scan file content for dangerous patterns before writing
function hasUnsafeContent(content: string): { safe: boolean; reason?: string } {
    const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    for (const line of lines) {
        const t = line.trim();
        if (!t) continue;
        for (const pattern of BLOCKED_PATTERNS) {
            if (pattern.test(t)) {
                return { safe: false, reason: `File content contains blocked pattern on line: ${t.substring(0, 80)}` };
            }
        }
    }
    return { safe: true };
}

function isWindows(): boolean {
    return os.platform() === 'win32';
}

// ─── run_command ──────────────────────────────────────────────────────────────

export const runCommandTool = tool({
    description:
        'Execute a shell command. On Windows uses PowerShell. ' +
        'Returns stdout, stderr, and exit code. ' +
        'Always specify the working directory explicitly. ' +
        'For multi-step tasks, call this tool multiple times rather than chaining.',
    parameters: z.object({
        command: z.string().describe('The shell command to execute'),
        cwd: z.string().optional().describe('Working directory (absolute path). Defaults to current directory.'),
    }),
    execute: async ({ command, cwd }) => {
        const workDir = cwd ? path.resolve(cwd) : process.cwd();

        const safety = isSafe(command);
        if (!safety.safe) {
            console.log(chalk.red(`  ⛔ Blocked: ${command.substring(0, 100)}`));
            return { success: false, error: `Safety guard: ${safety.reason}`, stdout: '', stderr: '', exitCode: -1 };
        }

        console.log(chalk.gray(`  $ ${command}`) + (cwd ? chalk.dim(` [in ${workDir}]`) : ''));

        if (!fs.existsSync(workDir)) {
            return { success: false, error: `Directory does not exist: ${workDir}`, stdout: '', stderr: '', exitCode: 1 };
        }

        try {
            if (isWindows()) {
                const tempFile = path.join(os.tmpdir(), `brain-${Date.now()}.ps1`);
                const script = `$ErrorActionPreference = "Stop"\nSet-Location -LiteralPath "${workDir}"\n${command}`;
                fs.writeFileSync(tempFile, script, 'utf8');

                const result = spawnSync('powershell.exe', [
                    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', tempFile
                ], { encoding: 'utf-8', cwd: workDir });

                fs.unlinkSync(tempFile);

                const success = (result.status ?? 1) === 0;
                if (!success) console.log(chalk.red(`  ✗ exit ${result.status}`));

                return {
                    success,
                    stdout: result.stdout?.trim() || '',
                    stderr: result.stderr?.trim() || '',
                    exitCode: result.status ?? 1,
                };
            } else {
                const result = spawnSync('bash', ['-c', command], { encoding: 'utf-8', cwd: workDir });
                const success = (result.status ?? 1) === 0;
                return {
                    success,
                    stdout: result.stdout?.trim() || '',
                    stderr: result.stderr?.trim() || '',
                    exitCode: result.status ?? 1,
                };
            }
        } catch (err: any) {
            return { success: false, error: err.message, stdout: '', stderr: '', exitCode: 1 };
        }
    },
});

// ─── create_file ──────────────────────────────────────────────────────────────

export const createFileTool = tool({
    description:
        'Create or overwrite a file with the given content. ' +
        'Prefer this over run_command for writing code — handles encoding correctly. ' +
        'Cannot write to system paths.',
    parameters: z.object({
        path: z.string().describe('File path (absolute, or relative to cwd)'),
        content: z.string().describe('Full file content'),
        cwd: z.string().optional().describe('Working directory for resolving relative paths'),
    }),
    execute: async ({ path: filePath, content, cwd }) => {
        const workDir = cwd ? path.resolve(cwd) : process.cwd();
        const resolved = path.isAbsolute(filePath) ? filePath : path.join(workDir, filePath);

        // Block writes to system paths
        if (isSystemPath(resolved)) {
            console.log(chalk.red(`  ⛔ Blocked write to system path: ${resolved}`));
            return { success: false, error: `Cannot write to system path: ${resolved}` };
        }

        // Scan content for dangerous patterns
        const contentSafety = hasUnsafeContent(content);
        if (!contentSafety.safe) {
            console.log(chalk.red(`  ⛔ Blocked: file content contains dangerous patterns`));
            return { success: false, error: `Safety guard: ${contentSafety.reason}` };
        }

        console.log(chalk.gray(`  📄 write ${resolved}`));

        try {
            fs.mkdirSync(path.dirname(resolved), { recursive: true });
            fs.writeFileSync(resolved, content, 'utf8');
            return { success: true, path: resolved, bytes: Buffer.byteLength(content, 'utf8') };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    },
});

// ─── read_file ────────────────────────────────────────────────────────────────

export const readFileTool = tool({
    description: 'Read a file\'s contents. Cannot read system/OS files.',
    parameters: z.object({
        path: z.string().describe('File path (absolute, or relative to cwd)'),
        cwd: z.string().optional().describe('Working directory for resolving relative paths'),
    }),
    execute: async ({ path: filePath, cwd }) => {
        const workDir = cwd ? path.resolve(cwd) : process.cwd();
        const resolved = path.isAbsolute(filePath) ? filePath : path.join(workDir, filePath);

        // Block reads of sensitive system paths
        if (isSystemPath(resolved)) {
            console.log(chalk.red(`  ⛔ Blocked read of system path: ${resolved}`));
            return { success: false, error: `Cannot read system path: ${resolved}` };
        }

        console.log(chalk.gray(`  📖 read ${resolved}`));

        if (!fs.existsSync(resolved)) {
            return { success: false, error: `File not found: ${resolved}` };
        }
        try {
            const content = fs.readFileSync(resolved, 'utf-8');
            return { success: true, path: resolved, content, lines: content.split('\n').length };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    },
});

// ─── list_dir ─────────────────────────────────────────────────────────────────

export const listDirTool = tool({
    description: 'List files and directories. Cannot list system paths.',
    parameters: z.object({
        path: z.string().optional().describe('Directory path. Defaults to current working directory.'),
        cwd: z.string().optional().describe('Working directory for resolving relative paths'),
    }),
    execute: async ({ path: dirPath, cwd }) => {
        const workDir = cwd ? path.resolve(cwd) : process.cwd();
        const resolved = dirPath
            ? (path.isAbsolute(dirPath) ? dirPath : path.join(workDir, dirPath))
            : workDir;

        if (isSystemPath(resolved)) {
            console.log(chalk.red(`  ⛔ Blocked list of system path: ${resolved}`));
            return { success: false, error: `Cannot list system path: ${resolved}` };
        }

        console.log(chalk.gray(`  📁 ls ${resolved}`));

        if (!fs.existsSync(resolved)) {
            return { success: false, error: `Directory not found: ${resolved}` };
        }
        try {
            const entries = fs.readdirSync(resolved, { withFileTypes: true });
            const items = entries.map(e => ({
                name: e.name,
                type: e.isDirectory() ? 'dir' : 'file',
            }));
            return { success: true, path: resolved, items, count: items.length };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    },
});

// ─── change_dir ───────────────────────────────────────────────────────────────

export const changeDirTool = tool({
    description:
        'Change the working directory. ' +
        'Subsequent tool calls with relative paths use this directory.',
    parameters: z.object({
        path: z.string().describe('Directory to change into (absolute or relative to current cwd)'),
    }),
    execute: async ({ path: dirPath }) => {
        const resolved = path.resolve(process.cwd(), dirPath);

        if (!fs.existsSync(resolved)) {
            return { success: false, error: `Directory does not exist: ${resolved}` };
        }
        if (!fs.statSync(resolved).isDirectory()) {
            return { success: false, error: `Not a directory: ${resolved}` };
        }

        process.chdir(resolved);
        console.log(chalk.gray(`  📂 cd → ${resolved}`));
        return { success: true, cwd: resolved };
    },
});

// ─── All tools export ─────────────────────────────────────────────────────────

export const ALL_TOOLS = {
    run_command: runCommandTool,
    create_file: createFileTool,
    read_file: readFileTool,
    list_dir: listDirTool,
    change_dir: changeDirTool,
};
