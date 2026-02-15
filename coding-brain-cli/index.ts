#!/usr/bin/env node
import { Command } from 'commander';
import inquirer from 'inquirer';
import axios from 'axios';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import os from 'os';

const program = new Command();
const CONFIG_DIR = path.join(os.homedir(), '.brain');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// Ensure config dir exists
if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

const getConfig = () => {
    if (fs.existsSync(CONFIG_FILE)) {
        return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
    return {};
};

const saveConfig = (config: any) => {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
};

const API_URL = 'https://coding-brain-backend.vikas4988.workers.dev'; // Hardcoded for now, or make configurable

program
    .name('brain')
    .description('Coding Brain CLI - Your AI Pair Programmer')
    .version('1.0.0');

program
    .command('auth')
    .description('Login to Coding Brain')
    .action(async () => {
        console.log(chalk.blue('Please generate a CLI API Key from your dashboard: https://coding-brain-frontend.pages.dev/keys'));

        const answers = await inquirer.prompt([
            {
                type: 'password',
                name: 'apiKey',
                message: 'Enter your API Key:',
                mask: '*'
            }
        ]);

        const config = getConfig();
        config.apiKey = answers.apiKey;
        saveConfig(config);
        console.log(chalk.green('✔ API Key saved successfully!'));
    });

program
    .command('config')
    .description('View or set configuration')
    .action(() => {
        const config = getConfig();
        console.log(chalk.cyan('Current Configuration:'));
        console.log(JSON.stringify(config, null, 2));
    });

program
    .command('run <prompt>')
    .description('Run a coding task on the current directory')
    .option('-m, --model <modelId>', 'Specify model ID', 'llama-3-8b-instruct') // Default to CF model
    .action(async (prompt, options) => {
        const config = getConfig();
        if (!config.apiKey) {
            console.error(chalk.red('Error: Not authenticated. Run "brain auth" first.'));
            process.exit(1);
        }

        console.log(chalk.yellow(`🧠 Thinking about: "${prompt}" using ${options.model}...`));

        try {
            // For now, we are sending just the prompt. 
            // Phase 2: Zip up context and send it.
            const response = await axios.post(`${API_URL}/gateway/chat`, {
                model: options.model,
                messages: [{ role: 'user', content: prompt }]
            }, {
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`, // This needs backend support to check API Key
                    // Note: Backend currently expects JWT in RBAC. 
                    // We need to update RBACMiddleware or Gateway route to accept API Keys.
                }
            });

            console.log(chalk.green('\nResponse:'));
            console.log(response.data); // Should be the model output

        } catch (error: any) {
            if (error.response) {
                console.error(chalk.red(`Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`));
            } else {
                console.error(chalk.red('Error connecting to backend:', error.message));
            }
        }
    });

program.parse(process.argv);
