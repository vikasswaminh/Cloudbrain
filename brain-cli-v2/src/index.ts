#!/usr/bin/env node
import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { getConfig, saveConfig } from './config.js';
import { runAgent, MODES, type Mode } from './agent.js';

const program = new Command();

const VERSION = '2.0.0';

// ─── Header ───────────────────────────────────────────────────────────────────

function printHeader(mode: Mode) {
    console.log(chalk.magenta('\n  ╔════════════════════════════════════════════╗'));
    console.log(chalk.magenta('  ║      CloudBrain CLI v2 — Vercel AI SDK     ║'));
    console.log(chalk.magenta('  ╚════════════════════════════════════════════╝'));
    console.log(chalk.cyan(`  ${MODES[mode]}\n`));
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

program
    .command('auth')
    .description('Set your CloudBrain API key')
    .action(async () => {
        if (!process.stdin.isTTY) {
            console.error(chalk.red('Error: brain auth requires an interactive terminal.'));
            process.exit(1);
        }
        console.log(chalk.blue('\n  Get your API key at: https://coding.super25.ai/keys\n'));
        const { apiKey } = await inquirer.prompt([{
            type: 'password', name: 'apiKey',
            message: 'Enter your API key:', mask: '*',
        }]);
        if (!apiKey?.trim()) {
            console.error(chalk.red('No key entered.'));
            process.exit(1);
        }
        const config = getConfig();
        config.apiKey = apiKey.trim();
        saveConfig(config);
        console.log(chalk.green('\n  ✔ API key saved!\n'));
    });

// ─── Config ───────────────────────────────────────────────────────────────────

program
    .command('config')
    .description('Show current configuration')
    .action(() => {
        const config = getConfig();
        const display = { ...config, apiKey: config.apiKey ? config.apiKey.substring(0, 8) + '...' : '(not set)' };
        console.log(chalk.cyan('\n  Config:'));
        console.log(JSON.stringify(display, null, 2));
    });

// ─── Modes ────────────────────────────────────────────────────────────────────

program
    .command('modes')
    .description('List all available modes')
    .action(() => {
        console.log(chalk.cyan('\n  Available Modes:\n'));
        for (const [key, label] of Object.entries(MODES)) {
            const flag = `--${key}`.padEnd(14);
            console.log(`  ${chalk.white(flag)} ${label}`);
        }
        console.log(chalk.dim('\n  Examples:'));
        console.log(chalk.dim('    brain -y "create a REST API"'));
        console.log(chalk.dim('    brain --fix "the server crashes on startup"'));
        console.log(chalk.dim('    brain --review'));
        console.log(chalk.dim('    brain --plan "build a dashboard"\n'));
    });

// ─── Run (default command) ────────────────────────────────────────────────────

program
    .command('run', { isDefault: true })
    .description('Run the agent on a task or question')
    .argument('[prompt...]', 'Task or question')
    .option('-m, --model <id>', 'Model ID', 'glm-4.7-flash')
    .option('-y, --yolo', 'Auto-execute all tool calls without confirmation', false)
    .option('--review',    'Code review mode', false)
    .option('--fix',       'Debug & fix mode', false)
    .option('--plan',      'Plan only (no execution)', false)
    .option('--security',  'Security audit mode', false)
    .option('--test',      'Test writer mode', false)
    .option('--refactor',  'Refactoring mode', false)
    .option('--docs',      'Documentation mode', false)
    .option('--explain',   'Explain mode', false)
    .option('--git',       'Git expert mode', false)
    .option('--infra',     'Infrastructure/DevOps mode', false)
    .option('--architect', 'System architect mode', false)
    .option('--optimize',  'Performance optimizer mode', false)
    .option('--deploy',    'Deployment config mode', false)
    .option('--migrate',   'Migration planner mode', false)
    .action(async (promptParts: string[], options) => {
        // Resolve mode from flags
        const modeKeys = Object.keys(MODES).filter(k => k !== 'default') as Mode[];
        let mode: Mode = 'default';
        for (const key of modeKeys) {
            if (options[key]) { mode = key; break; }
        }

        // Smart mode detection from first word
        if (mode === 'default' && promptParts.length > 0) {
            const first = promptParts[0].toLowerCase();
            if (modeKeys.includes(first as Mode)) {
                mode = first as Mode;
                promptParts = promptParts.slice(1);
            }
        }

        const prompt = promptParts.join(' ').trim();

        // Check API key first
        const config = getConfig();
        if (!config.apiKey) {
            console.error(chalk.red('\n  ✗ No API key. Run: brain auth\n'));
            process.exit(1);
        }

        // Interactive mode if no prompt given
        if (!prompt) {
            if (!process.stdin.isTTY) {
                console.error(chalk.red('\n  ✗ Provide a prompt or run in an interactive terminal.\n'));
                process.exit(1);
            }

            printHeader(mode);
            console.log(chalk.cyan("  Interactive mode — type 'exit' to quit\n"));

            while (true) {
                const { input } = await inquirer.prompt([{
                    type: 'input', name: 'input',
                    message: chalk.green('brain>'),
                }]);

                const text = input?.trim();
                if (!text) continue;
                if (text === 'exit' || text === 'quit') process.exit(0);

                await runAgent(text, { model: options.model, mode, yolo: options.yolo });
            }
        }

        printHeader(mode);
        await runAgent(prompt, { model: options.model, mode, yolo: options.yolo });
    });

program
    .name('brain')
    .description(`CloudBrain CLI v${VERSION} — Vercel AI SDK`)
    .version(VERSION);

program.parse(process.argv);
