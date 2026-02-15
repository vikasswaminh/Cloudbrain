import { D1Database } from '@cloudflare/workers-types';
import { User } from '../types';

export class AuthService {
    private db: D1Database;

    constructor(db: D1Database) {
        this.db = db;
    }

    private async hashPassword(password: string, salt: Uint8Array): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const key = await crypto.subtle.importKey(
            'raw',
            data,
            { name: 'PBKDF2' },
            false,
            ['deriveBits']
        );

        const bits = await crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256',
            },
            key,
            256
        );

        return Array.from(new Uint8Array(bits))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
    }

    private generateSalt(): Uint8Array {
        return crypto.getRandomValues(new Uint8Array(16));
    }

    async register(email: string, password: string, role: User['role'] = 'viewer'): Promise<User> {
        const existingUser = await this.db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
        if (existingUser) {
            throw new Error('User already exists');
        }

        const salt = this.generateSalt();
        const hash = await this.hashPassword(password, salt);
        // Store salt + hash, e.g. "salt:hash" or just specific format.
        // For simplicity, let's store hex(salt):hex(hash)
        const storedPassword = `${Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('')}:${hash}`;

        const id = crypto.randomUUID();
        const createdAt = new Date().toISOString();

        await this.db.prepare(
            'INSERT INTO users (id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(id, email, storedPassword, role, createdAt).run();

        return { id, email, role, created_at: createdAt };
    }

    async login(email: string, password: string): Promise<User> {
        const user = await this.db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<User>();
        if (!user) {
            throw new Error('Invalid credentials');
        }

        if (!user.password_hash) {
            throw new Error('Invalid credentials');
        }
        const [saltHex, hashHex] = user.password_hash.split(':');
        const salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
        const hash = await this.hashPassword(password, salt);

        if (hash !== hashHex) {
            throw new Error('Invalid credentials');
        }

        return user;
    }
}
