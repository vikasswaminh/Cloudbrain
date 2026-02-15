import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Plan } from '../types';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../auth/store';
import { LogOut, Play, RefreshCw } from 'lucide-react';

export const Dashboard = () => {
    const [task, setTask] = useState('');
    const [loading, setLoading] = useState(false);
    const [plan, setPlan] = useState<Plan | null>(null);
    const navigate = useNavigate();
    const logout = useAuthStore((state) => state.logout);
    const user = useAuthStore((state) => state.user);

    const [executions, setExecutions] = useState<any[]>([]);

    const fetchExecutions = async () => {
        try {
            const res = await api.get('/executions');
            setExecutions(res.data);
        } catch (e) {
            console.error('Failed to fetch executions');
        }
    };

    const handleCreatePlan = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await api.post('/plan', { task });
            setPlan(res.data);
            fetchExecutions(); // Refresh list
        } catch (e) {
            console.error(e);
            alert('Failed to generate plan');
        } finally {
            setLoading(false);
        }
    };

    const handleExecute = async () => {
        if (!plan) return;
        try {
            const res = await api.post('/execute', { planId: plan.id });
            navigate(`/execution/${res.data.executionId}`);
        } catch (e) {
            console.error(e);
            alert('Failed to start execution');
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    useEffect(() => {
        fetchExecutions();
    }, []);

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8">
            <header className="flex justify-between items-center mb-8 border-b border-gray-700 pb-4">
                <h1 className="text-3xl font-bold">Coding Brain Dashboard</h1>
                <div className="flex items-center gap-4">
                    <span>{user?.email} ({user?.role})</span>
                    <button onClick={handleLogout} className="p-2 hover:bg-gray-800 rounded">
                        <LogOut size={20} />
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div className="bg-gray-800 p-6 rounded shadow-md">
                        <h2 className="text-xl font-semibold mb-4">Create New Plan</h2>
                        <form onSubmit={handleCreatePlan} className="space-y-4">
                            <textarea
                                value={task}
                                onChange={(e) => setTask(e.target.value)}
                                placeholder="Describe your task..."
                                className="w-full p-3 bg-gray-700 rounded border border-gray-600 focus:outline-none focus:border-blue-500 h-32"
                                required
                            />
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex items-center gap-2 bg-blue-600 px-4 py-2 rounded hover:bg-blue-500 disabled:opacity-50"
                            >
                                {loading ? <RefreshCw className="animate-spin" /> : <Play size={18} />}
                                Generate Plan
                            </button>
                        </form>
                    </div>

                    {plan && (
                        <div className="bg-gray-800 p-6 rounded shadow-md animate-fade-in">
                            <h3 className="text-lg font-semibold mb-2">Generated Plan</h3>
                            <pre className="bg-gray-950 p-4 rounded overflow-auto max-h-64 text-sm text-green-400">
                                {JSON.stringify(plan.plan, null, 2)}
                            </pre>
                            <div className="mt-4">
                                <button
                                    onClick={handleExecute}
                                    className="bg-green-600 px-6 py-2 rounded hover:bg-green-500 font-bold"
                                >
                                    Execute Protocol
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-gray-800 p-6 rounded shadow-md">
                    <h2 className="text-xl font-semibold mb-4">Recent Executions</h2>
                    <div className="space-y-3">
                        {executions.length === 0 && <p className="text-gray-500">No executions found.</p>}
                        {executions.map((exe) => (
                            <Link
                                key={exe.id}
                                to={`/execution/${exe.id}`}
                                className="block p-3 bg-gray-700 rounded hover:bg-gray-600 transition border-l-4 border-blue-500"
                            >
                                <div className="flex justify-between items-center text-sm">
                                    <span className="font-mono text-xs">{exe.id.slice(0, 8)}...</span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${exe.status === 'COMPLETED' ? 'bg-green-900 text-green-300' :
                                        exe.status === 'FAILED' ? 'bg-red-900 text-red-300' :
                                            'bg-blue-900 text-blue-300'
                                        }`}>
                                        {exe.status}
                                    </span>
                                </div>
                                <div className="text-xs text-gray-400 mt-1">
                                    {new Date(exe.created_at).toLocaleString()}
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
