import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import type { ExecutionState } from '../types';
import { ArrowLeft, RefreshCw, CheckCircle, XCircle } from 'lucide-react';

export const ExecutionDetail = () => {
    const { id } = useParams<{ id: string }>();
    const [state, setState] = useState<ExecutionState | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchStatus = async () => {
        try {
            const res = await api.get(`/executions/${id}`);
            setState(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(() => {
            if (state?.status === 'COMPLETED' || state?.status === 'FAILED') {
                clearInterval(interval);
                return;
            }
            fetchStatus();
        }, 2000);
        return () => clearInterval(interval);
    }, [id, state?.status]);

    if (loading && !state) return <div className="p-8 text-white">Loading...</div>;
    if (!state) return <div className="p-8 text-white">Execution not found</div>;

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8">
            <Link to="/" className="flex items-center gap-2 text-gray-400 hover:text-white mb-6">
                <ArrowLeft size={20} /> Back to Dashboard
            </Link>

            <div className="bg-gray-800 p-6 rounded shadow-md mb-8">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-bold mb-2">Execution: {id}</h1>
                        <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded text-sm font-bold ${state.status === 'COMPLETED' ? 'bg-green-900 text-green-300' :
                                state.status === 'FAILED' ? 'bg-red-900 text-red-300' :
                                    'bg-blue-900 text-blue-300'
                                }`}>
                                {state.status}
                            </span>
                            <span className="text-gray-400 text-sm">Plan ID: {state.planId}</span>
                        </div>
                    </div>
                    {state.status === 'RUNNING' && <RefreshCw className="animate-spin text-blue-400" />}
                </div>
            </div>

            <div className="space-y-4">
                <h2 className="text-xl font-semibold">Steps</h2>
                {Object.values(state.results || {}).map((step: any) => (
                    <div key={step.stepId} className="bg-gray-800 p-4 rounded border border-gray-700">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-bold">{step.stepId}</h3>
                            {step.status === 'COMPLETED' ? <CheckCircle className="text-green-500" size={18} /> :
                                step.status === 'FAILED' ? <XCircle className="text-red-500" size={18} /> :
                                    <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />}
                        </div>
                        {step.output && (
                            <pre className="bg-gray-950 p-2 rounded text-xs text-gray-300 overflow-auto">
                                {JSON.stringify(step.output, null, 2)}
                            </pre>
                        )}
                        {step.error && (
                            <p className="text-red-400 text-sm">{step.error}</p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
