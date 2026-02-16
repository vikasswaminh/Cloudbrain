import { Context } from 'hono';
import { nanoid } from 'nanoid';
import type { ScheduledExecution, CreateScheduleRequest } from '../types/phase1';

// Simple cron parser for next run calculation
function getNextRunTime(cronExpression: string, timezone: string = 'UTC'): Date {
  // This is a simplified version - in production, use a proper cron parser library
  // For now, we'll just add the interval
  const now = new Date();

  // Parse simple cron patterns like "*/5 * * * *" (every 5 minutes)
  const parts = cronExpression.split(' ');

  if (parts[0].startsWith('*/')) {
    const minutes = parseInt(parts[0].substring(2));
    now.setMinutes(now.getMinutes() + minutes);
  } else if (parts[0] === '0' && parts[1].startsWith('*/')) {
    // Hourly pattern
    const hours = parseInt(parts[1].substring(2));
    now.setHours(now.getHours() + hours);
  } else {
    // Default: add 1 hour
    now.setHours(now.getHours() + 1);
  }

  return now;
}

export class SchedulesController {
  /**
   * GET /schedules
   * List all scheduled executions for user
   */
  static async listSchedules(c: Context) {
    try {
      const user = c.get('user');
      const { is_active, limit = 50, offset = 0 } = c.req.query();
      const db = c.env.DB;

      let query = 'SELECT * FROM scheduled_executions WHERE user_id = ?';
      const params: any[] = [user.id];

      if (is_active !== undefined) {
        query += ' AND is_active = ?';
        params.push(is_active === 'true' ? 1 : 0);
      }

      query += ' ORDER BY next_run_at ASC LIMIT ? OFFSET ?';
      params.push(parseInt(limit as string), parseInt(offset as string));

      const result = await db.prepare(query).bind(...params).all();

      const schedules = result.results.map((row: any) => ({
        ...row,
        is_active: Boolean(row.is_active),
        config: JSON.parse(row.config)
      }));

      return c.json({ schedules });
    } catch (error: any) {
      console.error('List schedules error:', error);
      return c.json({ error: 'Failed to fetch schedules' }, 500);
    }
  }

  /**
   * GET /schedules/:id
   * Get schedule by ID
   */
  static async getSchedule(c: Context) {
    try {
      const user = c.get('user');
      const { id } = c.req.param();
      const db = c.env.DB;

      const result = await db
        .prepare('SELECT * FROM scheduled_executions WHERE id = ? AND user_id = ?')
        .bind(id, user.id)
        .first();

      if (!result) {
        return c.json({ error: 'Schedule not found' }, 404);
      }

      const schedule: ScheduledExecution = {
        ...result,
        is_active: Boolean(result.is_active),
        config: JSON.parse(result.config as string)
      } as any;

      return c.json({ schedule });
    } catch (error: any) {
      console.error('Get schedule error:', error);
      return c.json({ error: 'Failed to fetch schedule' }, 500);
    }
  }

  /**
   * POST /schedules
   * Create new scheduled execution
   */
  static async createSchedule(c: Context) {
    try {
      const user = c.get('user');
      const body: CreateScheduleRequest = await c.req.json();
      const db = c.env.DB;

      // Validate cron expression (basic validation)
      if (!body.cron_expression || body.cron_expression.split(' ').length !== 5) {
        return c.json({ error: 'Invalid cron expression' }, 400);
      }

      const nextRunAt = getNextRunTime(body.cron_expression, body.timezone || 'UTC');

      const schedule: ScheduledExecution = {
        id: nanoid(),
        name: body.name,
        description: body.description,
        user_id: user.id,
        template_id: body.template_id,
        cron_expression: body.cron_expression,
        timezone: body.timezone || 'UTC',
        is_active: true,
        next_run_at: nextRunAt.toISOString(),
        execution_count: 0,
        config: body.config,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await db
        .prepare(`
          INSERT INTO scheduled_executions
          (id, name, description, user_id, template_id, cron_expression, timezone, is_active, next_run_at, config, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          schedule.id,
          schedule.name,
          schedule.description,
          schedule.user_id,
          schedule.template_id,
          schedule.cron_expression,
          schedule.timezone,
          schedule.is_active ? 1 : 0,
          schedule.next_run_at,
          JSON.stringify(schedule.config),
          schedule.created_at,
          schedule.updated_at
        )
        .run();

      return c.json({ schedule }, 201);
    } catch (error: any) {
      console.error('Create schedule error:', error);
      return c.json({ error: 'Failed to create schedule' }, 500);
    }
  }

  /**
   * PUT /schedules/:id
   * Update scheduled execution
   */
  static async updateSchedule(c: Context) {
    try {
      const user = c.get('user');
      const { id } = c.req.param();
      const body: Partial<CreateScheduleRequest> & { is_active?: boolean } = await c.req.json();
      const db = c.env.DB;

      // Check ownership
      const existing = await db
        .prepare('SELECT user_id FROM scheduled_executions WHERE id = ?')
        .bind(id)
        .first();

      if (!existing) {
        return c.json({ error: 'Schedule not found' }, 404);
      }

      if (existing.user_id !== user.id) {
        return c.json({ error: 'Permission denied' }, 403);
      }

      const updates: string[] = [];
      const params: any[] = [];

      if (body.name) {
        updates.push('name = ?');
        params.push(body.name);
      }
      if (body.description !== undefined) {
        updates.push('description = ?');
        params.push(body.description);
      }
      if (body.cron_expression) {
        updates.push('cron_expression = ?');
        params.push(body.cron_expression);

        const nextRunAt = getNextRunTime(body.cron_expression, body.timezone || 'UTC');
        updates.push('next_run_at = ?');
        params.push(nextRunAt.toISOString());
      }
      if (body.timezone) {
        updates.push('timezone = ?');
        params.push(body.timezone);
      }
      if (body.is_active !== undefined) {
        updates.push('is_active = ?');
        params.push(body.is_active ? 1 : 0);
      }
      if (body.config) {
        updates.push('config = ?');
        params.push(JSON.stringify(body.config));
      }

      updates.push('updated_at = ?');
      params.push(new Date().toISOString());

      params.push(id);

      await db
        .prepare(`UPDATE scheduled_executions SET ${updates.join(', ')} WHERE id = ?`)
        .bind(...params)
        .run();

      return c.json({ message: 'Schedule updated successfully' });
    } catch (error: any) {
      console.error('Update schedule error:', error);
      return c.json({ error: 'Failed to update schedule' }, 500);
    }
  }

  /**
   * DELETE /schedules/:id
   * Delete scheduled execution
   */
  static async deleteSchedule(c: Context) {
    try {
      const user = c.get('user');
      const { id } = c.req.param();
      const db = c.env.DB;

      // Check ownership
      const existing = await db
        .prepare('SELECT user_id FROM scheduled_executions WHERE id = ?')
        .bind(id)
        .first();

      if (!existing) {
        return c.json({ error: 'Schedule not found' }, 404);
      }

      if (existing.user_id !== user.id) {
        return c.json({ error: 'Permission denied' }, 403);
      }

      await db.prepare('DELETE FROM scheduled_executions WHERE id = ?').bind(id).run();

      return c.json({ message: 'Schedule deleted successfully' });
    } catch (error: any) {
      console.error('Delete schedule error:', error);
      return c.json({ error: 'Failed to delete schedule' }, 500);
    }
  }

  /**
   * POST /schedules/:id/toggle
   * Toggle schedule active status
   */
  static async toggleSchedule(c: Context) {
    try {
      const user = c.get('user');
      const { id } = c.req.param();
      const db = c.env.DB;

      const existing = await db
        .prepare('SELECT user_id, is_active FROM scheduled_executions WHERE id = ?')
        .bind(id)
        .first();

      if (!existing) {
        return c.json({ error: 'Schedule not found' }, 404);
      }

      if (existing.user_id !== user.id) {
        return c.json({ error: 'Permission denied' }, 403);
      }

      const newStatus = existing.is_active ? 0 : 1;

      await db
        .prepare('UPDATE scheduled_executions SET is_active = ?, updated_at = ? WHERE id = ?')
        .bind(newStatus, new Date().toISOString(), id)
        .run();

      return c.json({ is_active: Boolean(newStatus) });
    } catch (error: any) {
      console.error('Toggle schedule error:', error);
      return c.json({ error: 'Failed to toggle schedule' }, 500);
    }
  }

  /**
   * POST /schedules/:id/run-now
   * Trigger scheduled execution immediately
   */
  static async runNow(c: Context) {
    try {
      const user = c.get('user');
      const { id } = c.req.param();
      const db = c.env.DB;

      const schedule = await db
        .prepare('SELECT * FROM scheduled_executions WHERE id = ? AND user_id = ?')
        .bind(id, user.id)
        .first();

      if (!schedule) {
        return c.json({ error: 'Schedule not found' }, 404);
      }

      // Create execution
      const executionId = nanoid();
      const planId = nanoid();

      const config = JSON.parse(schedule.config as string);

      await db
        .prepare(`
          INSERT INTO plans (id, user_id, task, plan, model, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        .bind(
          planId,
          user.id,
          `Scheduled execution: ${schedule.name}`,
          JSON.stringify({ from_schedule: id }),
          'claude-3-sonnet-20240229',
          new Date().toISOString()
        )
        .run();

      await db
        .prepare(`
          INSERT INTO executions (id, user_id, plan_id, status, created_at, updated_at)
          VALUES (?, ?, ?, 'PENDING', ?, ?)
        `)
        .bind(executionId, user.id, planId, new Date().toISOString(), new Date().toISOString())
        .run();

      return c.json({ executionId, message: 'Execution triggered successfully' });
    } catch (error: any) {
      console.error('Run now error:', error);
      return c.json({ error: 'Failed to trigger execution' }, 500);
    }
  }
}
