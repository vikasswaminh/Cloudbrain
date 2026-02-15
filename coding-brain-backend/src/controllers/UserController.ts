import { Context } from 'hono';
import { AuthService } from '../auth/AuthService';
import { JWTService } from '../auth/JWTService';

export class UserController {
    static async register(c: Context) {
        const { email, password, role } = await c.req.json();
        // Validate input with Zod (TODO)

        // Check for secret
        const jwtSecret = c.env.JWT_SECRET || 'dev-secret';

        const authService = new AuthService(c.env.DB);
        try {
            const user = await authService.register(email, password, role || 'viewer');
            const jwtService = new JWTService(jwtSecret);
            const token = jwtService.sign({ sub: user.id, role: user.role });

            return c.json({ user: { id: user.id, email: user.email, role: user.role }, token });
        } catch (e: any) {
            return c.json({ error: e.message }, 400);
        }
    }

    static async login(c: Context) {
        const { email, password } = await c.req.json();

        const jwtSecret = c.env.JWT_SECRET || 'dev-secret';
        const authService = new AuthService(c.env.DB);

        try {
            const user = await authService.login(email, password);
            const jwtService = new JWTService(jwtSecret);
            const token = jwtService.sign({ sub: user.id, role: user.role });

            return c.json({ user: { id: user.id, email: user.email, role: user.role }, token });
        } catch (e: any) {
            return c.json({ error: e.message }, 401);
        }
    }
}
