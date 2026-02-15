export interface User {
    id: string;
    email: string;
    password_hash?: string;
    role: 'admin' | 'developer' | 'viewer';
    created_at: string;
}

export interface JWTPayload {
    sub: string;
    role: string;
    exp: number;
}
