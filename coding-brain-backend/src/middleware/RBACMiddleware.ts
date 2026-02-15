import { Context, Next } from 'hono';
import { JWTService } from '../auth/JWTService';

export const rbac = (requiredRole: string, jwtSecret: string) => {
    return async (c: Context, next: Next) => {
        const authHeader = c.req.header('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return c.json({ error: 'Unauthorized' }, 401);
        }

        const token = authHeader.split(' ')[1];
        const jwtService = new JWTService(jwtSecret);

        try {
            const payload = jwtService.verify(token);
            if (payload.role !== requiredRole && payload.role !== 'admin') { // Admin can access all
                // Simple check: if required is 'viewer', everyone can access. If 'developer', only dev and admin.
                // Let's implement a hierarchy or just strict check.
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
