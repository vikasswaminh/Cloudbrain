import { Context, Next } from 'hono';
import { JWTService } from '../auth/JWTService';
import { ApiKeyService } from '../services/ApiKeyService';

export const rbac = (requiredRole: string, jwtSecret: string) => {
    return async (c: Context, next: Next) => {
        const authHeader = c.req.header('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return c.json({ error: 'Unauthorized' }, 401);
        }

        const token = authHeader.split(' ')[1];

        // ─── Path 1: CLI API Key (sk_brain_...) ─────
        if (token.startsWith('sk_brain_')) {
            try {
                const apiKeyService = new ApiKeyService(c.env.DB);
                const result = await apiKeyService.verifyKey(token);
                if (!result) {
                    return c.json({ error: 'Invalid API key' }, 401);
                }
                // API key users get 'developer' role by default
                c.set('user', {
                    sub: result.userId,
                    email: 'cli-user',
                    role: 'developer',
                    iat: Math.floor(Date.now() / 1000),
                    exp: Math.floor(Date.now() / 1000) + 3600,
                });
                await next();
                return;
            } catch (e) {
                return c.json({ error: 'API key verification failed' }, 401);
            }
        }

        // ─── Path 2: JWT Token (Web Dashboard) ─────
        const jwtService = new JWTService(jwtSecret);

        try {
            const payload = jwtService.verify(token);
            if (payload.role !== requiredRole && payload.role !== 'admin') {
                const roles = ['viewer', 'developer', 'admin'];
                const userRoleIndex = roles.indexOf(payload.role);
                const requiredRoleIndex = roles.indexOf(requiredRole);

                if (userRoleIndex < requiredRoleIndex) {
                    return c.json({ error: 'Forbidden' }, 403);
                }
            }
            c.set('user', payload);
            await next();
        } catch (e) {
            return c.json({ error: 'Invalid token' }, 401);
        }
    };
};
