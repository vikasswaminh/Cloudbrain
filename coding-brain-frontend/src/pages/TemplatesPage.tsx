import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useNavigate } from 'react-router-dom';
import {
    Package,
    Plus,
    Star,
    Search,
    Filter,
    Play,
    Edit,
    Trash2,
    Eye,
    TrendingUp
} from 'lucide-react';

interface ExecutionTemplate {
    id: string;
    name: string;
    description: string;
    category: 'api' | 'database' | 'testing' | 'devops' | 'custom';
    is_public: boolean;
    created_by: string;
    usage_count: number;
    rating_avg: number | null;
    rating_count: number;
    tags: string[];
    template_config: {
        task_description: string;
        variables: any[];
        default_model?: string;
    };
    created_at: string;
}

export const TemplatesPage = () => {
    const [templates, setTemplates] = useState<ExecutionTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<ExecutionTemplate | null>(null);
    const navigate = useNavigate();

    const categories = [
        { value: 'all', label: 'All Templates', icon: Package },
        { value: 'api', label: 'API Development', icon: Package },
        { value: 'database', label: 'Database', icon: Package },
        { value: 'testing', label: 'Testing', icon: Package },
        { value: 'devops', label: 'DevOps', icon: Package },
        { value: 'custom', label: 'Custom', icon: Package }
    ];

    const fetchTemplates = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (selectedCategory !== 'all') {
                params.append('category', selectedCategory);
            }
            const res = await api.get(`/templates?${params.toString()}`);
            setTemplates(res.data.templates || []);
        } catch (e) {
            console.error('Failed to fetch templates', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTemplates();
    }, [selectedCategory]);

    const handleExecuteTemplate = (template: ExecutionTemplate) => {
        setSelectedTemplate(template);
    };

    const handleDeleteTemplate = async (templateId: string) => {
        if (!confirm('Are you sure you want to delete this template?')) return;
        try {
            await api.delete(`/templates/${templateId}`);
            fetchTemplates();
        } catch (e) {
            console.error('Failed to delete template', e);
            alert('Failed to delete template');
        }
    };

    const filteredTemplates = templates.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Page Header */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                    <div>
                        <h1 className="text-3xl font-semibold text-foreground mb-2">Templates</h1>
                        <p className="text-muted-foreground">Reusable task templates for faster development</p>
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-smooth font-medium"
                    >
                        <Plus className="w-4 h-4" />
                        Create Template
                    </button>
                </div>
            </div>

            {/* Search and Filter Bar */}
            <div className="mb-6 space-y-4">
                <div className="flex gap-4">
                    <div className="flex-1 relative">
                        <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search templates..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground"
                        />
                    </div>
                </div>

                {/* Category Filters */}
                <div className="flex gap-2 overflow-x-auto pb-2">
                    {categories.map(cat => (
                        <button
                            key={cat.value}
                            onClick={() => setSelectedCategory(cat.value)}
                            className={`px-4 py-2 rounded-lg whitespace-nowrap text-sm font-medium transition-smooth ${
                                selectedCategory === cat.value
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-card border border-border text-muted-foreground hover:bg-accent'
                            }`}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Templates Grid */}
            {loading ? (
                <div className="text-center py-12">
                    <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="mt-4 text-muted-foreground">Loading templates...</p>
                </div>
            ) : filteredTemplates.length === 0 ? (
                <div className="text-center py-12 bg-card border border-border rounded-lg">
                    <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">No templates found</h3>
                    <p className="text-muted-foreground mb-6">
                        {searchTerm ? 'Try a different search term' : 'Create your first template to get started'}
                    </p>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-smooth font-medium"
                    >
                        <Plus className="w-4 h-4" />
                        Create Template
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredTemplates.map(template => (
                        <div key={template.id} className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-smooth">
                            {/* Template Header */}
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <h3 className="text-lg font-semibold text-foreground">{template.name}</h3>
                                        {template.is_public && (
                                            <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded">
                                                Public
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                        {template.description || 'No description'}
                                    </p>
                                </div>
                            </div>

                            {/* Category Badge */}
                            <div className="mb-4">
                                <span className="inline-flex items-center px-2.5 py-1 bg-accent text-accent-foreground text-xs font-medium rounded-md">
                                    {template.category}
                                </span>
                            </div>

                            {/* Tags */}
                            {template.tags && template.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {template.tags.slice(0, 3).map(tag => (
                                        <span key={tag} className="px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded">
                                            {tag}
                                        </span>
                                    ))}
                                    {template.tags.length > 3 && (
                                        <span className="px-2 py-0.5 text-muted-foreground text-xs">
                                            +{template.tags.length - 3}
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Stats */}
                            <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                    <TrendingUp className="w-4 h-4" />
                                    <span>{template.usage_count || 0} uses</span>
                                </div>
                                {template.rating_count > 0 && (
                                    <div className="flex items-center gap-1">
                                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                                        <span>{template.rating_avg?.toFixed(1)} ({template.rating_count})</span>
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleExecuteTemplate(template)}
                                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-smooth text-sm font-medium"
                                >
                                    <Play className="w-4 h-4" />
                                    Execute
                                </button>
                                <button
                                    onClick={() => navigate(`/templates/${template.id}`)}
                                    className="px-3 py-2 bg-accent text-accent-foreground rounded-lg hover:bg-accent/80 transition-smooth"
                                >
                                    <Eye className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Template Modal - Placeholder */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-card border border-border rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-semibold text-foreground mb-4">Create Template</h2>
                        <p className="text-muted-foreground mb-6">
                            Template creation form will be implemented here with variable configuration, category selection, and settings.
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

            {/* Execute Template Modal - Placeholder */}
            {selectedTemplate && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-card border border-border rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-semibold text-foreground mb-4">Execute: {selectedTemplate.name}</h2>
                        <p className="text-muted-foreground mb-6">
                            Variable input form will be implemented here based on template configuration.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setSelectedTemplate(null)}
                                className="px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:bg-accent/80 transition-smooth"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    alert('Template execution will be implemented');
                                    setSelectedTemplate(null);
                                }}
                                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-smooth"
                            >
                                Execute
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
