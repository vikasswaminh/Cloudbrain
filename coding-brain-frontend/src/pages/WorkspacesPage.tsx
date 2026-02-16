import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useNavigate } from 'react-router-dom';
import {
    Users,
    Plus,
    Settings,
    UserPlus,
    Crown,
    Shield,
    User,
    Eye,
    Trash2,
    LogOut,
    Mail
} from 'lucide-react';

interface Workspace {
    id: string;
    name: string;
    description: string;
    created_by: string;
    settings: {
        default_model?: string;
        max_concurrent_executions?: number;
        resource_limits?: any;
    };
    created_at: string;
}

interface WorkspaceMember {
    id: string;
    user_id: string;
    email: string;
    role: 'owner' | 'admin' | 'member' | 'viewer';
    joined_at: string;
}

interface WorkspaceWithMembers extends Workspace {
    members: WorkspaceMember[];
}

export const WorkspacesPage = () => {
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedWorkspace, setSelectedWorkspace] = useState<WorkspaceWithMembers | null>(null);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const navigate = useNavigate();

    const fetchWorkspaces = async () => {
        try {
            setLoading(true);
            const res = await api.get('/workspaces');
            setWorkspaces(res.data.workspaces || []);
        } catch (e) {
            console.error('Failed to fetch workspaces', e);
        } finally {
            setLoading(false);
        }
    };

    const fetchWorkspaceDetails = async (workspaceId: string) => {
        try {
            const res = await api.get(`/workspaces/${workspaceId}`);
            setSelectedWorkspace(res.data.workspace);
        } catch (e) {
            console.error('Failed to fetch workspace details', e);
        }
    };

    useEffect(() => {
        fetchWorkspaces();
    }, []);

    const handleDeleteWorkspace = async (workspaceId: string) => {
        if (!confirm('Are you sure you want to delete this workspace? This action cannot be undone.')) return;
        try {
            await api.delete(`/workspaces/${workspaceId}`);
            fetchWorkspaces();
        } catch (e) {
            console.error('Failed to delete workspace', e);
            alert('Failed to delete workspace');
        }
    };

    const handleLeaveWorkspace = async (workspaceId: string) => {
        if (!confirm('Are you sure you want to leave this workspace?')) return;
        try {
            await api.post(`/workspaces/${workspaceId}/leave`);
            fetchWorkspaces();
            setSelectedWorkspace(null);
        } catch (e) {
            console.error('Failed to leave workspace', e);
            alert('Failed to leave workspace');
        }
    };

    const getRoleIcon = (role: string) => {
        switch (role) {
            case 'owner': return <Crown className="w-4 h-4 text-yellow-500" />;
            case 'admin': return <Shield className="w-4 h-4 text-blue-500" />;
            case 'member': return <User className="w-4 h-4 text-green-500" />;
            case 'viewer': return <Eye className="w-4 h-4 text-gray-500" />;
            default: return <User className="w-4 h-4" />;
        }
    };

    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case 'owner': return 'bg-yellow-500/10 text-yellow-500';
            case 'admin': return 'bg-blue-500/10 text-blue-500';
            case 'member': return 'bg-green-500/10 text-green-500';
            case 'viewer': return 'bg-gray-500/10 text-gray-500';
            default: return 'bg-muted text-muted-foreground';
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Page Header */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                    <div>
                        <h1 className="text-3xl font-semibold text-foreground mb-2">Workspaces</h1>
                        <p className="text-muted-foreground">Collaborate with your team on projects</p>
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-smooth font-medium"
                    >
                        <Plus className="w-4 h-4" />
                        Create Workspace
                    </button>
                </div>
            </div>

            {/* Workspaces Grid */}
            {loading ? (
                <div className="text-center py-12">
                    <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="mt-4 text-muted-foreground">Loading workspaces...</p>
                </div>
            ) : workspaces.length === 0 ? (
                <div className="text-center py-12 bg-card border border-border rounded-lg">
                    <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">No workspaces yet</h3>
                    <p className="text-muted-foreground mb-6">
                        Create your first workspace to start collaborating with your team
                    </p>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-smooth font-medium"
                    >
                        <Plus className="w-4 h-4" />
                        Create Workspace
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {workspaces.map(workspace => (
                        <div key={workspace.id} className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-smooth">
                            {/* Workspace Header */}
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                                        <Users className="w-6 h-6 text-primary" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-foreground mb-2">{workspace.name}</h3>
                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                        {workspace.description || 'No description'}
                                    </p>
                                </div>
                            </div>

                            {/* Workspace Stats */}
                            <div className="mb-4 py-3 border-t border-border">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Created</span>
                                    <span className="text-foreground font-medium">
                                        {new Date(workspace.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => fetchWorkspaceDetails(workspace.id)}
                                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-smooth text-sm font-medium"
                                >
                                    <Eye className="w-4 h-4" />
                                    View
                                </button>
                                <button
                                    onClick={() => handleDeleteWorkspace(workspace.id)}
                                    className="px-3 py-2 bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20 transition-smooth"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Workspace Modal - Placeholder */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-card border border-border rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-semibold text-foreground mb-4">Create Workspace</h2>
                        <p className="text-muted-foreground mb-6">
                            Workspace creation form will be implemented here with name, description, and settings configuration.
                        </p>
                        <button
                            onClick={() => setShowCreateModal(false)}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-smooth"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            {/* Workspace Details Modal */}
            {selectedWorkspace && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-card border border-border rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-6">
                            <div>
                                <h2 className="text-2xl font-semibold text-foreground mb-2">{selectedWorkspace.name}</h2>
                                <p className="text-muted-foreground">{selectedWorkspace.description}</p>
                            </div>
                            <button
                                onClick={() => setSelectedWorkspace(null)}
                                className="text-muted-foreground hover:text-foreground"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Members Section */}
                        <div className="mb-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-foreground">Members</h3>
                                <button
                                    onClick={() => setShowInviteModal(true)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-smooth text-sm"
                                >
                                    <UserPlus className="w-4 h-4" />
                                    Invite
                                </button>
                            </div>

                            <div className="space-y-2">
                                {selectedWorkspace.members?.map(member => (
                                    <div key={member.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                                <User className="w-5 h-5 text-primary" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-foreground">{member.email}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    Joined {new Date(member.joined_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${getRoleBadgeColor(member.role)}`}>
                                                {getRoleIcon(member.role)}
                                                {member.role}
                                            </span>
                                        </div>
                                    </div>
                                )) || (
                                    <p className="text-center py-4 text-muted-foreground text-sm">No members yet</p>
                                )}
                            </div>
                        </div>

                        {/* Settings Section */}
                        <div className="mb-6 p-4 bg-muted/30 rounded-lg">
                            <h3 className="text-sm font-semibold text-foreground mb-3">Settings</h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-muted-foreground mb-1">Default Model</p>
                                    <p className="text-foreground font-medium">
                                        {selectedWorkspace.settings?.default_model || 'Not set'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground mb-1">Max Concurrent Executions</p>
                                    <p className="text-foreground font-medium">
                                        {selectedWorkspace.settings?.max_concurrent_executions || 'Unlimited'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setSelectedWorkspace(null)}
                                className="flex-1 px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:bg-accent/80 transition-smooth font-medium"
                            >
                                Close
                            </button>
                            <button
                                onClick={() => handleLeaveWorkspace(selectedWorkspace.id)}
                                className="px-4 py-2 bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20 transition-smooth font-medium flex items-center gap-2"
                            >
                                <LogOut className="w-4 h-4" />
                                Leave Workspace
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Invite Member Modal - Placeholder */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
                    <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full">
                        <h3 className="text-lg font-semibold text-foreground mb-4">Invite Member</h3>
                        <p className="text-muted-foreground mb-6">
                            Member invitation form will be implemented here with email input and role selection.
                        </p>
                        <button
                            onClick={() => setShowInviteModal(false)}
                            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-smooth"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
