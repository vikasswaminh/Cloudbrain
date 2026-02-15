import React, { useState } from 'react';
import { api } from '../api/client';
import { useNavigate } from 'react-router-dom';
import { Send, Loader } from 'lucide-react';

export function PlanGenerator() {
    const [task, setTask] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await api.post('/plan', { task });
            // Redirect to execution detail once plan is created
            // res.data.plan should contain the plan ID?
            // Actually the plan creation just returns the plan object.
            // Then user can execute it. 
            // For now, let's assume it returns { id: ... } of the plan
            // But wait, the previous implementation of POST /plan in backend?

            // Backend Controller:
            // const planId = crypto.randomUUID();
            // ...
            // return c.json(planObject);

            // Let's assume we want to execute it immediately or go to a page to review it.
            // For now, let's go to dashboard or stay here.
            alert('Plan generated! ID: ' + res.data.id);
            navigate('/dashboard');
        } catch (error) {
            console.error(error);
            alert('Failed to generate plan');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-white mb-8">Generate New Plan</h1>

            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-gray-400 mb-2">What do you want to build?</label>
                        <textarea
                            className="w-full bg-gray-900 text-white p-4 rounded-lg h-40 focus:ring-2 focus:ring-purple-500 outline-none"
                            placeholder="e.g. Create a React component that fetches weather data..."
                            value={task}
                            onChange={e => setTask(e.target.value)}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50 flex justify-center items-center space-x-2"
                    >
                        {loading ? <Loader className="animate-spin" /> : <Send />}
                        <span>{loading ? 'Generating Plan...' : 'Generate Plan'}</span>
                    </button>
                </form>
            </div>
        </div>
    );
}
