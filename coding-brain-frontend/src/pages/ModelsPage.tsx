import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { Plus, Trash2 } from 'lucide-react';

interface Model {
    id: string;
    name: string;
    provider: string;
    base_url?: string;
    api_key_env_var?: string;
    is_active: boolean;
    required_plan: string;
}

export function ModelsPage() {
    const queryClient = useQueryClient();
    const [isEditing, setIsEditing] = useState(false);
    const [currentModel, setCurrentModel] = useState<Partial<Model>>({});

    const { data: models, isLoading } = useQuery({
        queryKey: ['models'],
        queryFn: async () => {
            const res = await api.get('/admin/models');
            return res.data;
        }
    });

    const createMutation = useMutation({
        mutationFn: (newModel: any) => api.post('/admin/models', newModel),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['models'] });
            setIsEditing(false);
            setCurrentModel({});
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.delete(`/admin/models/${id}`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['models'] })
    });

    const handleSave = () => {
        createMutation.mutate({
            ...currentModel,
            is_active: true, // Default to active
            required_plan: currentModel.required_plan || 'free'
        });
    };

    if (isLoading) return <div className="p-8 text-white">Loading Models...</div>;

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-white">AI Models Registry</h1>
                <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    <span>Add Model</span>
                </button>
            </div>

            {isEditing && (
                <div className="bg-gray-800 p-6 rounded-lg mb-8 border border-gray-700">
                    <h2 className="text-xl font-semibold text-white mb-4">Add New Model</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input
                            type="text"
                            placeholder="Model ID (e.g. gpt-4-turbo)"
                            className="bg-gray-700 text-white p-2 rounded"
                            value={currentModel.id || ''}
                            onChange={e => setCurrentModel({ ...currentModel, id: e.target.value })}
                        />
                        <input
                            type="text"
                            placeholder="Display Name (e.g. GPT-4 Turbo)"
                            className="bg-gray-700 text-white p-2 rounded"
                            value={currentModel.name || ''}
                            onChange={e => setCurrentModel({ ...currentModel, name: e.target.value })}
                        />
                        <select
                            className="bg-gray-700 text-white p-2 rounded"
                            value={currentModel.provider || ''}
                            onChange={e => setCurrentModel({ ...currentModel, provider: e.target.value })}
                        >
                            <option value="">Select Provider</option>
                            <option value="openai_compatible">OpenAI Compatible (Grok, DeepSeek, etc.)</option>
                            <option value="cloudflare">Cloudflare Workers AI</option>
                            <option value="anthropic">Anthropic</option>
                        </select>
                        <input
                            type="text"
                            placeholder="Base URL (e.g. https://api.deepseek.com/v1)"
                            className="bg-gray-700 text-white p-2 rounded"
                            value={currentModel.base_url || ''}
                            onChange={e => setCurrentModel({ ...currentModel, base_url: e.target.value })}
                        />
                        <input
                            type="text"
                            placeholder="Env Var for API Key (e.g. DEEPSEEK_KEY)"
                            className="bg-gray-700 text-white p-2 rounded"
                            value={currentModel.api_key_env_var || ''}
                            onChange={e => setCurrentModel({ ...currentModel, api_key_env_var: e.target.value })}
                        />
                        <select
                            className="bg-gray-700 text-white p-2 rounded"
                            value={currentModel.required_plan || 'free'}
                            onChange={e => setCurrentModel({ ...currentModel, required_plan: e.target.value })}
                        >
                            <option value="free">Free Plan</option>
                            <option value="pro">Pro Plan</option>
                        </select>
                    </div>
                    <div className="mt-4 flex space-x-2">
                        <button
                            onClick={handleSave}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                        >
                            Save Model
                        </button>
                        <button
                            onClick={() => setIsEditing(false)}
                            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {models?.map((model: Model) => (
                    <div key={model.id} className="bg-gray-800 p-6 rounded-lg border border-gray-700 hover:border-purple-500 transition-colors">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-lg font-semibold text-white">{model.name}</h3>
                                <p className="text-sm text-gray-400">{model.provider}</p>
                            </div>
                            <div className={`px-2 py-1 rounded text-xs ${model.is_active ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                                {model.is_active ? 'Active' : 'Inactive'}
                            </div>
                        </div>
                        <div className="space-y-2 text-sm text-gray-300 mb-4">
                            <p><span className="text-gray-500">ID:</span> {model.id}</p>
                            <p><span className="text-gray-500">Base URL:</span> {model.base_url || 'N/A'}</p>
                            <p><span className="text-gray-500">Plan:</span> {model.required_plan}</p>
                        </div>
                        <div className="flex justify-end space-x-2">
                            <button
                                onClick={() => deleteMutation.mutate(model.id)}
                                className="text-red-400 hover:text-red-300 p-2 hover:bg-red-900/30 rounded"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
