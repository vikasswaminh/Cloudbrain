import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { Key, Trash2, Copy, Terminal } from 'lucide-react';

interface ApiKey {
    id: string;
    name: string;
    last_used_at?: string;
    created_at: string;
}

export function ApiKeysPage() {
    const queryClient = useQueryClient();
    const [newKey, setNewKey] = useState<string | null>(null);

    const { data: keys, isLoading } = useQuery({
        queryKey: ['keys'],
        queryFn: async () => {
            const res = await api.get('/keys');
            return res.data;
        }
    });

    const createMutation = useMutation({
        mutationFn: (name: string) => api.post('/keys', { name }),
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['keys'] });
            setNewKey(res.data.key);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.delete(`/keys/${id}`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['keys'] })
    });

    if (isLoading) return <div className="p-8 text-white">Loading Keys...</div>;

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold text-white mb-6">API Keys & CLI Access</h1>

            {newKey && (
                <div className="bg-green-900/30 border border-green-500/50 p-6 rounded-lg mb-8">
                    <h3 className="text-lg font-semibold text-green-400 mb-2">New Key Check</h3>
                    <p className="text-sm text-gray-300 mb-4">
                        Save this key now. It will only be shown once!
                    </p>
                    <div className="flex items-center bg-black/50 p-3 rounded font-mono text-green-300">
                        <span className="flex-1 overflow-x-auto">{newKey}</span>
                        <button
                            onClick={() => navigator.clipboard.writeText(newKey)}
                            className="ml-2 text-gray-400 hover:text-white"
                        >
                            <Copy className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 mb-8">
                <h2 className="text-xl font-semibold text-white mb-4">Generate New CLI Key</h2>
                <div className="flex gap-4">
                    <input
                        type="text"
                        placeholder="Key Name (e.g. Work Laptop CLI)"
                        className="flex-1 bg-gray-700 text-white p-2 rounded"
                        id="keyName"
                    />
                    <button
                        onClick={() => {
                            const name = (document.getElementById('keyName') as HTMLInputElement).value;
                            createMutation.mutate(name || 'CLI Key');
                        }}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded flex items-center space-x-2"
                    >
                        <Terminal className="w-4 h-4" />
                        <span>Generate</span>
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                {keys?.map((key: ApiKey) => (
                    <div key={key.id} className="bg-gray-800 p-4 rounded-lg border border-gray-700 flex justify-between items-center">
                        <div className="flex items-center space-x-4">
                            <div className="p-2 bg-gray-700 rounded-full">
                                <Key className="w-5 h-5 text-purple-400" />
                            </div>
                            <div>
                                <h3 className="text-white font-medium">{key.name}</h3>
                                <p className="text-xs text-gray-400">Created: {new Date(key.created_at).toLocaleDateString()}</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-6">
                            <div className="text-right">
                                <p className="text-xs text-gray-500 uppercase tracking-wider">Last Used</p>
                                <p className="text-sm text-gray-300">
                                    {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : 'Never'}
                                </p>
                            </div>
                            <button
                                onClick={() => deleteMutation.mutate(key.id)}
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
