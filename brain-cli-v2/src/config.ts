import fs from 'fs';
import path from 'path';
import os from 'os';

export const CONFIG_DIR = path.join(os.homedir(), '.brain');
export const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
export const SESSIONS_DIR = path.join(CONFIG_DIR, 'sessions');

// Ensure dirs exist on first import
for (const dir of [CONFIG_DIR, SESSIONS_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export interface BrainConfig {
    apiKey?: string;
    defaultModel?: string;
}

export function getConfig(): BrainConfig {
    if (!fs.existsSync(CONFIG_FILE)) return {};
    // Strip UTF-8 BOM — PowerShell 5.x Set-Content adds it
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8').replace(/^\uFEFF/, '');
    try {
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

export function saveConfig(config: BrainConfig): void {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { encoding: 'utf8' });
}
