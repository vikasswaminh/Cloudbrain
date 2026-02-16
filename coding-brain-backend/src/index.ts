import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { UserController } from './controllers/UserController';
import { PlanController } from './controllers/PlanController';
import { ExecutionController } from './controllers/ExecutionController';
import { AdminController, ApiKeyController } from './controllers/AdminController';
import { DashboardController } from './controllers/DashboardController';
import { GatewayController } from './controllers/GatewayController';
import { sessionRoutes } from './controllers/SessionController';
import { TemplatesController } from './controllers/TemplatesController';
import { SchedulesController } from './controllers/SchedulesController';
import { WorkspacesController } from './controllers/WorkspacesController';
import { rbac } from './middleware/RBACMiddleware';

type Bindings = {
    DB: D1Database;
    ASSETS_BUCKET: R2Bucket;
    EXECUTION_QUEUE: Queue;
    AI: any;
    JWT_SECRET: string;
    EXECUTION_COORDINATOR: DurableObjectNamespace;
    SESSION_RECORDER: DurableObjectNamespace;
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

// Admin: Model Management & Dashboard
app.use('/admin/*', async (c: any, next: any) => rbac('admin', jwtSecret(c))(c, next));
app.get('/admin/models', AdminController.listModels);
app.post('/admin/models', AdminController.createModel);
app.put('/admin/models/:id', AdminController.updateModel);
app.delete('/admin/models/:id', AdminController.deleteModel);

// Admin: Dashboard Analytics
app.get('/admin/dashboard/stats', DashboardController.getStats);
app.get('/admin/dashboard/health', DashboardController.getSystemHealth);
app.get('/admin/dashboard/telemetry', DashboardController.getTelemetry);
app.get('/admin/dashboard/usage', DashboardController.getUsage);

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

// Session Routes (FSM telemetry)
app.use('/sessions/*', async (c: any, next: any) => rbac('viewer', jwtSecret(c))(c, next));
app.route('/sessions', sessionRoutes);

// Phase 1 Features: Templates
app.use('/templates/*', async (c: any, next: any) => rbac('viewer', jwtSecret(c))(c, next));
app.get('/templates', TemplatesController.listTemplates);
app.get('/templates/categories', TemplatesController.getCategories);
app.get('/templates/:id', TemplatesController.getTemplate);
app.post('/templates', TemplatesController.createTemplate);
app.put('/templates/:id', TemplatesController.updateTemplate);
app.delete('/templates/:id', TemplatesController.deleteTemplate);
app.post('/templates/:id/rate', TemplatesController.rateTemplate);
app.post('/templates/:id/execute', TemplatesController.executeTemplate);

// Phase 1 Features: Scheduled Executions
app.use('/schedules/*', async (c: any, next: any) => rbac('viewer', jwtSecret(c))(c, next));
app.get('/schedules', SchedulesController.listSchedules);
app.get('/schedules/:id', SchedulesController.getSchedule);
app.post('/schedules', SchedulesController.createSchedule);
app.put('/schedules/:id', SchedulesController.updateSchedule);
app.delete('/schedules/:id', SchedulesController.deleteSchedule);
app.post('/schedules/:id/toggle', SchedulesController.toggleSchedule);
app.post('/schedules/:id/run-now', SchedulesController.runNow);

// Phase 1 Features: Workspaces
app.use('/workspaces/*', async (c: any, next: any) => rbac('viewer', jwtSecret(c))(c, next));
app.get('/workspaces', WorkspacesController.listWorkspaces);
app.get('/workspaces/:id', WorkspacesController.getWorkspace);
app.post('/workspaces', WorkspacesController.createWorkspace);
app.put('/workspaces/:id', WorkspacesController.updateWorkspace);
app.delete('/workspaces/:id', WorkspacesController.deleteWorkspace);
app.post('/workspaces/:id/invite', WorkspacesController.inviteMember);
app.delete('/workspaces/:id/members/:userId', WorkspacesController.removeMember);
app.put('/workspaces/:id/members/:userId/role', WorkspacesController.updateMemberRole);
app.post('/workspaces/:id/leave', WorkspacesController.leaveWorkspace);

export default app;

// Export Durable Object classes
export { ExecutionCoordinator } from './durable-objects/ExecutionCoordinator';
export { SessionRecorder } from './durable-objects/SessionRecorder';
