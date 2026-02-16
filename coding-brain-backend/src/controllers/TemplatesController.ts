import { Context } from 'hono';
import { nanoid } from 'nanoid';
import type {
  ExecutionTemplate,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  TemplateRating,
  ExecuteTemplateRequest
} from '../types/phase1';

export class TemplatesController {
  /**
   * GET /templates
   * List all templates (public + user's private)
   */
  static async listTemplates(c: Context) {
    try {
      const user = c.get('user');
      const { category, tags, is_public, limit = 50, offset = 0 } = c.req.query();

      const db = c.env.DB;
      let query = `
        SELECT * FROM execution_templates
        WHERE (is_public = 1 OR created_by = ?)
      `;
      const params: any[] = [user.id];

      if (category) {
        query += ` AND category = ?`;
        params.push(category);
      }

      if (is_public !== undefined) {
        query += ` AND is_public = ?`;
        params.push(is_public === 'true' ? 1 : 0);
      }

      query += ` ORDER BY usage_count DESC, rating_avg DESC LIMIT ? OFFSET ?`;
      params.push(parseInt(limit as string), parseInt(offset as string));

      const result = await db.prepare(query).bind(...params).all();

      // Parse JSON fields
      const templates = result.results.map((row: any) => ({
        ...row,
        is_public: Boolean(row.is_public),
        tags: row.tags ? JSON.parse(row.tags) : [],
        template_config: JSON.parse(row.template_config)
      }));

      return c.json({ templates, total: templates.length });
    } catch (error: any) {
      console.error('List templates error:', error);
      return c.json({ error: 'Failed to fetch templates' }, 500);
    }
  }

  /**
   * GET /templates/:id
   * Get template by ID
   */
  static async getTemplate(c: Context) {
    try {
      const user = c.get('user');
      const { id } = c.req.param();
      const db = c.env.DB;

      const result = await db
        .prepare('SELECT * FROM execution_templates WHERE id = ? AND (is_public = 1 OR created_by = ?)')
        .bind(id, user.id)
        .first();

      if (!result) {
        return c.json({ error: 'Template not found' }, 404);
      }

      const template: ExecutionTemplate = {
        ...result,
        is_public: Boolean(result.is_public),
        tags: result.tags ? JSON.parse(result.tags as string) : [],
        template_config: JSON.parse(result.template_config as string)
      } as any;

      return c.json({ template });
    } catch (error: any) {
      console.error('Get template error:', error);
      return c.json({ error: 'Failed to fetch template' }, 500);
    }
  }

  /**
   * POST /templates
   * Create new template
   */
  static async createTemplate(c: Context) {
    try {
      const user = c.get('user');
      const body: CreateTemplateRequest = await c.req.json();
      const db = c.env.DB;

      const template: ExecutionTemplate = {
        id: nanoid(),
        name: body.name,
        description: body.description,
        category: body.category as any,
        icon: body.icon,
        is_public: body.is_public,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        usage_count: 0,
        rating_avg: 0,
        rating_count: 0,
        tags: body.tags,
        template_config: body.template_config
      };

      await db
        .prepare(`
          INSERT INTO execution_templates
          (id, name, description, category, icon, is_public, created_by, created_at, updated_at, tags, template_config)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          template.id,
          template.name,
          template.description,
          template.category,
          template.icon,
          template.is_public ? 1 : 0,
          template.created_by,
          template.created_at,
          template.updated_at,
          JSON.stringify(template.tags),
          JSON.stringify(template.template_config)
        )
        .run();

      return c.json({ template }, 201);
    } catch (error: any) {
      console.error('Create template error:', error);
      return c.json({ error: 'Failed to create template' }, 500);
    }
  }

  /**
   * PUT /templates/:id
   * Update template
   */
  static async updateTemplate(c: Context) {
    try {
      const user = c.get('user');
      const { id } = c.req.param();
      const body: UpdateTemplateRequest = await c.req.json();
      const db = c.env.DB;

      // Check ownership
      const existing = await db
        .prepare('SELECT created_by FROM execution_templates WHERE id = ?')
        .bind(id)
        .first();

      if (!existing) {
        return c.json({ error: 'Template not found' }, 404);
      }

      if (existing.created_by !== user.id && user.role !== 'admin') {
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
      if (body.category) {
        updates.push('category = ?');
        params.push(body.category);
      }
      if (body.icon !== undefined) {
        updates.push('icon = ?');
        params.push(body.icon);
      }
      if (body.is_public !== undefined) {
        updates.push('is_public = ?');
        params.push(body.is_public ? 1 : 0);
      }
      if (body.tags) {
        updates.push('tags = ?');
        params.push(JSON.stringify(body.tags));
      }
      if (body.template_config) {
        updates.push('template_config = ?');
        params.push(JSON.stringify(body.template_config));
      }

      updates.push('updated_at = ?');
      params.push(new Date().toISOString());

      params.push(id);

      await db
        .prepare(`UPDATE execution_templates SET ${updates.join(', ')} WHERE id = ?`)
        .bind(...params)
        .run();

      return c.json({ message: 'Template updated successfully' });
    } catch (error: any) {
      console.error('Update template error:', error);
      return c.json({ error: 'Failed to update template' }, 500);
    }
  }

  /**
   * DELETE /templates/:id
   * Delete template
   */
  static async deleteTemplate(c: Context) {
    try {
      const user = c.get('user');
      const { id } = c.req.param();
      const db = c.env.DB;

      // Check ownership
      const existing = await db
        .prepare('SELECT created_by FROM execution_templates WHERE id = ?')
        .bind(id)
        .first();

      if (!existing) {
        return c.json({ error: 'Template not found' }, 404);
      }

      if (existing.created_by !== user.id && user.role !== 'admin') {
        return c.json({ error: 'Permission denied' }, 403);
      }

      await db.prepare('DELETE FROM execution_templates WHERE id = ?').bind(id).run();

      return c.json({ message: 'Template deleted successfully' });
    } catch (error: any) {
      console.error('Delete template error:', error);
      return c.json({ error: 'Failed to delete template' }, 500);
    }
  }

  /**
   * POST /templates/:id/rate
   * Rate a template
   */
  static async rateTemplate(c: Context) {
    try {
      const user = c.get('user');
      const { id } = c.req.param();
      const { rating, review } = await c.req.json();
      const db = c.env.DB;

      if (!rating || rating < 1 || rating > 5) {
        return c.json({ error: 'Rating must be between 1 and 5' }, 400);
      }

      const ratingId = nanoid();

      // Upsert rating
      await db
        .prepare(`
          INSERT INTO template_ratings (id, template_id, user_id, rating, review, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(template_id, user_id)
          DO UPDATE SET rating = ?, review = ?, created_at = ?
        `)
        .bind(
          ratingId,
          id,
          user.id,
          rating,
          review,
          new Date().toISOString(),
          rating,
          review,
          new Date().toISOString()
        )
        .run();

      // Update template average rating
      const avgResult = await db
        .prepare(`
          SELECT AVG(rating) as avg, COUNT(*) as count
          FROM template_ratings
          WHERE template_id = ?
        `)
        .bind(id)
        .first();

      await db
        .prepare('UPDATE execution_templates SET rating_avg = ?, rating_count = ? WHERE id = ?')
        .bind(avgResult.avg, avgResult.count, id)
        .run();

      return c.json({ message: 'Rating submitted successfully' });
    } catch (error: any) {
      console.error('Rate template error:', error);
      return c.json({ error: 'Failed to rate template' }, 500);
    }
  }

  /**
   * POST /templates/:id/execute
   * Execute a template
   */
  static async executeTemplate(c: Context) {
    try {
      const user = c.get('user');
      const { id } = c.req.param();
      const body: ExecuteTemplateRequest = await c.req.json();
      const db = c.env.DB;

      // Get template
      const template = await db
        .prepare('SELECT * FROM execution_templates WHERE id = ? AND (is_public = 1 OR created_by = ?)')
        .bind(id, user.id)
        .first();

      if (!template) {
        return c.json({ error: 'Template not found' }, 404);
      }

      const templateConfig = JSON.parse(template.template_config as string);

      // Validate required variables
      for (const variable of templateConfig.variables || []) {
        if (variable.required && !body.variables[variable.name]) {
          return c.json({ error: `Missing required variable: ${variable.name}` }, 400);
        }
      }

      // Create execution from template
      const executionId = nanoid();
      const planId = nanoid();

      // Build task description with variables
      let taskDescription = templateConfig.task_description;
      for (const [key, value] of Object.entries(body.variables)) {
        taskDescription = taskDescription.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
      }

      // Create plan
      await db
        .prepare(`
          INSERT INTO plans (id, user_id, task, plan, model, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        .bind(
          planId,
          user.id,
          taskDescription,
          JSON.stringify({ from_template: id, variables: body.variables }),
          templateConfig.default_model || 'claude-3-sonnet-20240229',
          new Date().toISOString()
        )
        .run();

      // Create execution
      await db
        .prepare(`
          INSERT INTO executions (id, user_id, plan_id, status, created_at, updated_at)
          VALUES (?, ?, ?, 'PENDING', ?, ?)
        `)
        .bind(executionId, user.id, planId, new Date().toISOString(), new Date().toISOString())
        .run();

      // Increment usage count
      await db
        .prepare('UPDATE execution_templates SET usage_count = usage_count + 1 WHERE id = ?')
        .bind(id)
        .run();

      return c.json({ executionId, planId }, 201);
    } catch (error: any) {
      console.error('Execute template error:', error);
      return c.json({ error: 'Failed to execute template' }, 500);
    }
  }

  /**
   * GET /templates/categories
   * Get template categories with counts
   */
  static async getCategories(c: Context) {
    try {
      const db = c.env.DB;
      const result = await db
        .prepare(`
          SELECT category, COUNT(*) as count
          FROM execution_templates
          WHERE is_public = 1
          GROUP BY category
        `)
        .all();

      return c.json({ categories: result.results });
    } catch (error: any) {
      console.error('Get categories error:', error);
      return c.json({ error: 'Failed to fetch categories' }, 500);
    }
  }
}
