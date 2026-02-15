import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { UserController } from './controllers/UserController';
import { PlanController } from './controllers/PlanController';
import { ExecutionController } from './controllers/ExecutionController';
import { AdminController, ApiKeyController } from './controllers/AdminController';
import { GatewayController } from './controllers/GatewayController';
import { rbac } from './middleware/RBACMiddleware';

type Bindings = {
    DB: D1Database;
    ASSETS_BUCKET: R2Bucket;
    EXECUTION_QUEUE: Queue;
    AI: any;
    JWT_SECRET: string;
    EXECUTION_COORDINATOR: DurableObjectNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', logger());
app.use('*', cors());

app.onError((err, c) => {
    console.error(`[Global Error]: ${err.message}`);
    return c.json({ error: err.message || 'Internal Server Error' }, 500);
});

app.get('/', (c) => c.text('Cloudflare Brain Platform is running!'));

// Auth Routes
app.post('/auth/register', UserController.register);
app.post('/auth/login', UserController.login);

// Protected Routes
const jwtSecret = (c: any) => c.env.JWT_SECRET || 'dev-secret';

app.use('/plan/*', async (c: any, next: any) => rbac('viewer', jwtSecret(c))(c, next));
app.post('/plan', PlanController.generate);

app.use('/execute/*', async (c: any, next: any) => rbac('viewer', jwtSecret(c))(c, next));
app.post('/execute', ExecutionController.execute);

app.use('/executions/*', async (c: any, next: any) => rbac('viewer', jwtSecret(c))(c, next));
app.get('/executions', ExecutionController.getList);
app.get('/executions/:id', ExecutionController.getStatus);

// Replay Routes
app.use('/replay/*', async (c: any, next: any) => rbac('viewer', jwtSecret(c))(c, next));
app.post('/replay/:id', ExecutionController.replay);

// --- AI Gateway Routes ---

// Admin: Model Management
app.use('/admin/*', async (c: any, next: any) => rbac('admin', jwtSecret(c))(c, next));
app.get('/admin/models', AdminController.listModels);
app.post('/admin/models', AdminController.createModel);
app.put('/admin/models/:id', AdminController.updateModel);
app.delete('/admin/models/:id', AdminController.deleteModel);

// User: API Keys for CLI
app.use('/keys/*', async (c: any, next: any) => rbac('viewer', jwtSecret(c))(c, next));
app.post('/keys', ApiKeyController.createKey);
app.get('/keys', ApiKeyController.listKeys);
app.delete('/keys/:id', ApiKeyController.deleteKey);

// Gateway: AI Chat
// This route needs to be accessible by either JWT (Web) OR API Key (CLI).
// For now, let's allow JWT. CLI logic needs a middleware that checks ApiKeyService.
app.use('/gateway/*', async (c: any, next: any) => rbac('viewer', jwtSecret(c))(c, next));
app.post('/gateway/chat', GatewayController.chat);

export default app;

// Export Durable Object class
export { ExecutionCoordinator } from './durable-objects/ExecutionCoordinator';
