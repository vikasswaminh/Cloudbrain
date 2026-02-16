import { useEffect, useState } from 'react';
import { api } from '../api/client';
import {
    Clock,
    Plus,
    Play,
    Pause,
    Trash2,
    Edit,
    CalendarClock,
    CheckCircle2,
    XCircle,
    PlayCircle
} from 'lucide-react';

interface ScheduledExecution {
    id: string;
    name: string;
    description: string;
    template_id: string;
    cron_expression: string;
    timezone: string;
    is_active: boolean;
    last_run_at: string | null;
    next_run_at: string;
    execution_count: number;
    config: {
        template_variables?: any;
        notifications?: any;
        retry_policy?: any;
    };
    created_at: string;
}

export const SchedulesPage = () => {
    const [schedules, setSchedules] = useState<ScheduledExecution[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');

    const fetchSchedules = async () => {
        try {
            setLoading(true);
            const res = await api.get('/schedules');
            setSchedules(res.data.schedules || []);
        } catch (e) {
            console.error('Failed to fetch schedules', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSchedules();
    }, []);

    const handleToggleSchedule = async (scheduleId: string) => {
        try {
            await api.post(`/schedules/${scheduleId}/toggle`);
            fetchSchedules();
        } catch (e) {
            console.error('Failed to toggle schedule', e);
            alert('Failed to toggle schedule');
        }
    };

    const handleRunNow = async (scheduleId: string) => {
        try {
            await api.post(`/schedules/${scheduleId}/run-now`);
            alert('Schedule triggered successfully!');
            fetchSchedules();
        } catch (e) {
            console.error('Failed to run schedule', e);
            alert('Failed to trigger schedule');
        }
    };

    const handleDeleteSchedule = async (scheduleId: string) => {
        if (!confirm('Are you sure you want to delete this schedule?')) return;
        try {
            await api.delete(`/schedules/${scheduleId}`);
            fetchSchedules();
        } catch (e) {
            console.error('Failed to delete schedule', e);
            alert('Failed to delete schedule');
        }
    };

    const filteredSchedules = schedules.filter(s => {
        if (filterActive === 'active') return s.is_active;
        if (filterActive === 'inactive') return !s.is_active;
        return true;
    });

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return 'Never';
        return new Date(dateStr).toLocaleString();
    };

    const getCronDescription = (cron: string) => {
        const descriptions: { [key: string]: string } = {
            '*/5 * * * *': 'Every 5 minutes',
            '0 * * * *': 'Every hour',
            '0 */2 * * *': 'Every 2 hours',
            '0 0 * * *': 'Daily at midnight',
            '0 2 * * *': 'Daily at 2 AM',
            '0 0 * * 0': 'Weekly on Sunday',
            '0 0 1 * *': 'Monthly on 1st'
        };
        return descriptions[cron] || cron;
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Page Header */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                    <div>
                        <h1 className="text-3xl font-semibold text-foreground mb-2">Scheduled Executions</h1>
                        <p className="text-muted-foreground">Automate your tasks with cron-based scheduling</p>
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-smooth font-medium"
                    >
                        <Plus className="w-4 h-4" />
                        Create Schedule
                    </button>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="mb-6 flex gap-2">
                {(['all', 'active', 'inactive'] as const).map(filter => (
                    <button
                        key={filter}
                        onClick={() => setFilterActive(filter)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-smooth capitalize ${
                            filterActive === filter
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-card border border-border text-muted-foreground hover:bg-accent'
                        }`}
                    >
                        {filter}
                    </button>
                ))}
            </div>

            {/* Schedules List */}
            {loading ? (
                <div className="text-center py-12">
                    <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="mt-4 text-muted-foreground">Loading schedules...</p>
                </div>
            ) : filteredSchedules.length === 0 ? (
                <div className="text-center py-12 bg-card border border-border rounded-lg">
                    <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">No schedules found</h3>
                    <p className="text-muted-foreground mb-6">
                        Create your first schedule to automate tasks
                    </p>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-smooth font-medium"
                    >
                        <Plus className="w-4 h-4" />
                        Create Schedule
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredSchedules.map(schedule => (
                        <div key={schedule.id} className="bg-card border border-border rounded-lg p-6">
                            <div className="flex items-start justify-between">
                                {/* Left Section */}
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                            schedule.is_active ? 'bg-green-500/10' : 'bg-muted'
                                        }`}>
                                            {schedule.is_active ? (
                                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                                            ) : (
                                                <Pause className="w-5 h-5 text-muted-foreground" />
                                            )}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-lg font-semibold text-foreground">{schedule.name}</h3>
                                                <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                                                    schedule.is_active
                                                        ? 'bg-green-500/10 text-green-500'
                                                        : 'bg-muted text-muted-foreground'
                                                }`}>
                                                    {schedule.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </div>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                {schedule.description || 'No description'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Schedule Details */}
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-1">Schedule</p>
                                            <p className="text-sm font-medium text-foreground">
                                                {getCronDescription(schedule.cron_expression)}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {schedule.cron_expression}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-1">Timezone</p>
                                            <p className="text-sm font-medium text-foreground">{schedule.timezone}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-1">Next Run</p>
                                            <p className="text-sm font-medium text-foreground">
                                                {formatDate(schedule.next_run_at)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-1">Executions</p>
                                            <p className="text-sm font-medium text-foreground">{schedule.execution_count || 0}</p>
                                        </div>
                                    </div>

                                    {/* Last Run Info */}
                                    {schedule.last_run_at && (
                                        <div className="mt-3 pt-3 border-t border-border">
                                            <p className="text-xs text-muted-foreground">
                                                Last run: {formatDate(schedule.last_run_at)}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Right Section - Actions */}
                                <div className="flex flex-col gap-2 ml-4">
                                    <button
                                        onClick={() => handleToggleSchedule(schedule.id)}
                                        className={`p-2 rounded-lg transition-smooth ${
                                            schedule.is_active
                                                ? 'bg-accent text-accent-foreground hover:bg-accent/80'
                                                : 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
                                        }`}
                                        title={schedule.is_active ? 'Pause' : 'Activate'}
                                    >
                                        {schedule.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                    </button>
                                    <button
                                        onClick={() => handleRunNow(schedule.id)}
                                        className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-smooth"
                                        title="Run now"
                                    >
                                        <PlayCircle className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteSchedule(schedule.id)}
                                        className="p-2 bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20 transition-smooth"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Schedule Modal - Placeholder */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-card border border-border rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-semibold text-foreground mb-4">Create Schedule</h2>
                        <p className="text-muted-foreground mb-6">
                            Schedule creation form will be implemented here with cron expression builder,
                            template selection, timezone picker, and notification settings.
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
        </div>
    );
};
