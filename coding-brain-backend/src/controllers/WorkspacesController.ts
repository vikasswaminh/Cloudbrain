import { Context } from 'hono';
import { nanoid } from 'nanoid';
import type {
  Workspace,
  CreateWorkspaceRequest,
  InviteMemberRequest,
  WorkspaceMember
} from '../types/phase1';

export class WorkspacesController {
  /**
   * GET /workspaces
   * List all workspaces user is a member of
   */
  static async listWorkspaces(c: Context) {
    try {
      const user = c.get('user');
      const db = c.env.DB;

      const result = await db
        .prepare(`
          SELECT w.*, wm.role as user_role
          FROM workspaces w
          INNER JOIN workspace_members wm ON w.id = wm.workspace_id
          WHERE wm.user_id = ?
          ORDER BY w.created_at DESC
        `)
        .bind(user.id)
        .all();

      const workspaces = result.results.map((row: any) => ({
        ...row,
        settings: row.settings ? JSON.parse(row.settings) : {},
        user_role: row.user_role
      }));

      return c.json({ workspaces });
    } catch (error: any) {
      console.error('List workspaces error:', error);
      return c.json({ error: 'Failed to fetch workspaces' }, 500);
    }
  }

  /**
   * GET /workspaces/:id
   * Get workspace details with members
   */
  static async getWorkspace(c: Context) {
    try {
      const user = c.get('user');
      const { id } = c.req.param();
      const db = c.env.DB;

      // Check membership
      const membership = await db
        .prepare('SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?')
        .bind(id, user.id)
        .first();

      if (!membership) {
        return c.json({ error: 'Workspace not found or access denied' }, 404);
      }

      // Get workspace
      const workspace = await db
        .prepare('SELECT * FROM workspaces WHERE id = ?')
        .bind(id)
        .first();

      if (!workspace) {
        return c.json({ error: 'Workspace not found' }, 404);
      }

      // Get members
      const members = await db
        .prepare(`
          SELECT wm.*, u.email
          FROM workspace_members wm
          INNER JOIN users u ON wm.user_id = u.id
          WHERE wm.workspace_id = ?
          ORDER BY wm.joined_at ASC
        `)
        .bind(id)
        .all();

      const workspaceData: Workspace = {
        ...workspace,
        settings: workspace.settings ? JSON.parse(workspace.settings as string) : {},
        members: members.results as any
      } as any;

      return c.json({ workspace: workspaceData, user_role: membership.role });
    } catch (error: any) {
      console.error('Get workspace error:', error);
      return c.json({ error: 'Failed to fetch workspace' }, 500);
    }
  }

  /**
   * POST /workspaces
   * Create new workspace
   */
  static async createWorkspace(c: Context) {
    try {
      const user = c.get('user');
      const body: CreateWorkspaceRequest = await c.req.json();
      const db = c.env.DB;

      const workspace: Workspace = {
        id: nanoid(),
        name: body.name,
        description: body.description,
        owner_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        settings: body.settings || {}
      };

      await db
        .prepare(`
          INSERT INTO workspaces (id, name, description, owner_id, created_at, updated_at, settings)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          workspace.id,
          workspace.name,
          workspace.description,
          workspace.owner_id,
          workspace.created_at,
          workspace.updated_at,
          JSON.stringify(workspace.settings)
        )
        .run();

      // Add creator as owner
      await db
        .prepare(`
          INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at)
          VALUES (?, ?, ?, 'owner', ?)
        `)
        .bind(nanoid(), workspace.id, user.id, new Date().toISOString())
        .run();

      return c.json({ workspace }, 201);
    } catch (error: any) {
      console.error('Create workspace error:', error);
      return c.json({ error: 'Failed to create workspace' }, 500);
    }
  }

  /**
   * PUT /workspaces/:id
   * Update workspace
   */
  static async updateWorkspace(c: Context) {
    try {
      const user = c.get('user');
      const { id } = c.req.param();
      const body: Partial<CreateWorkspaceRequest> = await c.req.json();
      const db = c.env.DB;

      // Check if user is owner or admin
      const membership = await db
        .prepare('SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?')
        .bind(id, user.id)
        .first();

      if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
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
      if (body.settings) {
        updates.push('settings = ?');
        params.push(JSON.stringify(body.settings));
      }

      updates.push('updated_at = ?');
      params.push(new Date().toISOString());

      params.push(id);

      await db
        .prepare(`UPDATE workspaces SET ${updates.join(', ')} WHERE id = ?`)
        .bind(...params)
        .run();

      return c.json({ message: 'Workspace updated successfully' });
    } catch (error: any) {
      console.error('Update workspace error:', error);
      return c.json({ error: 'Failed to update workspace' }, 500);
    }
  }

  /**
   * DELETE /workspaces/:id
   * Delete workspace
   */
  static async deleteWorkspace(c: Context) {
    try {
      const user = c.get('user');
      const { id } = c.req.param();
      const db = c.env.DB;

      // Check if user is owner
      const workspace = await db
        .prepare('SELECT owner_id FROM workspaces WHERE id = ?')
        .bind(id)
        .first();

      if (!workspace) {
        return c.json({ error: 'Workspace not found' }, 404);
      }

      if (workspace.owner_id !== user.id) {
        return c.json({ error: 'Only workspace owner can delete workspace' }, 403);
      }

      await db.prepare('DELETE FROM workspaces WHERE id = ?').bind(id).run();

      return c.json({ message: 'Workspace deleted successfully' });
    } catch (error: any) {
      console.error('Delete workspace error:', error);
      return c.json({ error: 'Failed to delete workspace' }, 500);
    }
  }

  /**
   * POST /workspaces/:id/invite
   * Invite member to workspace
   */
  static async inviteMember(c: Context) {
    try {
      const user = c.get('user');
      const { id } = c.req.param();
      const body: InviteMemberRequest = await c.req.json();
      const db = c.env.DB;

      // Check if user is owner or admin
      const membership = await db
        .prepare('SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?')
        .bind(id, user.id)
        .first();

      if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
        return c.json({ error: 'Permission denied' }, 403);
      }

      // Find user by email
      const invitedUser = await db
        .prepare('SELECT id FROM users WHERE email = ?')
        .bind(body.email)
        .first();

      if (!invitedUser) {
        return c.json({ error: 'User not found' }, 404);
      }

      // Check if already a member
      const existing = await db
        .prepare('SELECT id FROM workspace_members WHERE workspace_id = ? AND user_id = ?')
        .bind(id, invitedUser.id)
        .first();

      if (existing) {
        return c.json({ error: 'User is already a member' }, 400);
      }

      // Add member
      await db
        .prepare(`
          INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at)
          VALUES (?, ?, ?, ?, ?)
        `)
        .bind(nanoid(), id, invitedUser.id, body.role, new Date().toISOString())
        .run();

      return c.json({ message: 'Member invited successfully' });
    } catch (error: any) {
      console.error('Invite member error:', error);
      return c.json({ error: 'Failed to invite member' }, 500);
    }
  }

  /**
   * DELETE /workspaces/:id/members/:userId
   * Remove member from workspace
   */
  static async removeMember(c: Context) {
    try {
      const user = c.get('user');
      const { id, userId } = c.req.param();
      const db = c.env.DB;

      // Check if user is owner or admin
      const membership = await db
        .prepare('SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?')
        .bind(id, user.id)
        .first();

      if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
        return c.json({ error: 'Permission denied' }, 403);
      }

      // Can't remove owner
      const workspace = await db
        .prepare('SELECT owner_id FROM workspaces WHERE id = ?')
        .bind(id)
        .first();

      if (workspace && workspace.owner_id === userId) {
        return c.json({ error: 'Cannot remove workspace owner' }, 400);
      }

      await db
        .prepare('DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?')
        .bind(id, userId)
        .run();

      return c.json({ message: 'Member removed successfully' });
    } catch (error: any) {
      console.error('Remove member error:', error);
      return c.json({ error: 'Failed to remove member' }, 500);
    }
  }

  /**
   * PUT /workspaces/:id/members/:userId/role
   * Update member role
   */
  static async updateMemberRole(c: Context) {
    try {
      const user = c.get('user');
      const { id, userId } = c.req.param();
      const { role } = await c.req.json();
      const db = c.env.DB;

      if (!['admin', 'member', 'viewer'].includes(role)) {
        return c.json({ error: 'Invalid role' }, 400);
      }

      // Check if user is owner or admin
      const membership = await db
        .prepare('SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?')
        .bind(id, user.id)
        .first();

      if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
        return c.json({ error: 'Permission denied' }, 403);
      }

      // Can't change owner role
      const workspace = await db
        .prepare('SELECT owner_id FROM workspaces WHERE id = ?')
        .bind(id)
        .first();

      if (workspace && workspace.owner_id === userId) {
        return c.json({ error: 'Cannot change owner role' }, 400);
      }

      await db
        .prepare('UPDATE workspace_members SET role = ? WHERE workspace_id = ? AND user_id = ?')
        .bind(role, id, userId)
        .run();

      return c.json({ message: 'Member role updated successfully' });
    } catch (error: any) {
      console.error('Update member role error:', error);
      return c.json({ error: 'Failed to update member role' }, 500);
    }
  }

  /**
   * POST /workspaces/:id/leave
   * Leave workspace
   */
  static async leaveWorkspace(c: Context) {
    try {
      const user = c.get('user');
      const { id } = c.req.param();
      const db = c.env.DB;

      // Check if user is owner
      const workspace = await db
        .prepare('SELECT owner_id FROM workspaces WHERE id = ?')
        .bind(id)
        .first();

      if (workspace && workspace.owner_id === user.id) {
        return c.json({ error: 'Owner cannot leave workspace. Transfer ownership or delete workspace.' }, 400);
      }

      await db
        .prepare('DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?')
        .bind(id, user.id)
        .run();

      return c.json({ message: 'Left workspace successfully' });
    } catch (error: any) {
      console.error('Leave workspace error:', error);
      return c.json({ error: 'Failed to leave workspace' }, 500);
    }
  }
}
