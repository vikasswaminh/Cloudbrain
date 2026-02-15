import jwt from 'jwt-simple';
import { JWTPayload } from '../types';

export class JWTService {
    private secret: string;

    constructor(secret: string) {
        this.secret = secret;
    }

    sign(payload: Omit<JWTPayload, 'exp'>): string {
        const now = Math.floor(Date.now() / 1000);
        // Token valid for 24 hours
        const exp = now + (24 * 60 * 60);
        return jwt.encode({ ...payload, exp }, this.secret);
    }

    verify(token: string): JWTPayload {
        const payload = jwt.decode(token, this.secret) as JWTPayload;
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) {
            throw new Error('Token expired');
        }
        return payload;
    }
}
