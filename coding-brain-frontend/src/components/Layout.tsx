import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import React from 'react';
import { useAuthStore } from '../auth/store';
import {
    LayoutDashboard,
    PlusCircle,
    Key,
    Database,
    BarChart3,
    LogOut,
    Menu,
    X,
    Package,
    Clock,
    Users
} from 'lucide-react';

export const Layout = () => {
    const { user, logout } = useAuthStore();
    const location = useLocation();
    const navigate = useNavigate();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const isAdmin = user?.role === 'admin';

    const NavItem = ({ to, icon: Icon, label, adminOnly }: { to: string, icon: any, label: string, adminOnly?: boolean }) => {
        if (adminOnly && !isAdmin) return null;

        const isActive = location.pathname === to;
        return (
            <Link
                to={to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-smooth ${
                    isActive
                        ? 'bg-accent text-accent-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
            >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
            </Link>
        );
    };

    return (
        <div className="min-h-screen bg-background flex">
            {/* Mobile Menu Button */}
            <button
                className="lg:hidden fixed top-4 right-4 z-50 p-2 glass-dark rounded-lg text-foreground"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Sidebar */}
            <aside className={`
                fixed lg:static inset-y-0 left-0 z-40 w-64 bg-card border-r border-border transform transition-transform duration-200 ease-in-out
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                {/* Header with glassmorphism */}
                <div className="p-6 glass-dark">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                            <span className="text-primary-foreground font-bold text-sm">CB</span>
                        </div>
                        <div>
                            <h1 className="text-lg font-semibold text-foreground">
                                CloudBrain
                            </h1>
                            <p className="text-xs text-muted-foreground">AI Platform</p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="px-3 py-4 space-y-1">
                    {/* Show different nav items based on role */}
                    {isAdmin ? (
                        <>
                            <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
                            <NavItem to="/plan" icon={PlusCircle} label="New Plan" />
                            <NavItem to="/keys" icon={Key} label="API Keys" />

                            {/* Phase 1 Features */}
                            <div className="py-2">
                                <div className="px-3 pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Collaboration
                                </div>
                                <NavItem to="/templates" icon={Package} label="Templates" />
                                <NavItem to="/schedules" icon={Clock} label="Schedules" />
                                <NavItem to="/workspaces" icon={Users} label="Workspaces" />
                            </div>

                            <div className="py-2">
                                <div className="px-3 pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Admin
                                </div>
                                <NavItem to="/admin/models" icon={Database} label="Models" adminOnly={true} />
                                <NavItem to="/admin/dashboard" icon={BarChart3} label="Analytics" adminOnly={true} />
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Non-admin users see limited navigation */}
                            <NavItem to="/keys" icon={Key} label="API Keys" />
                            <NavItem to="/templates" icon={Package} label="Templates" />
                            <NavItem to="/schedules" icon={Clock} label="Schedules" />
                            <NavItem to="/workspaces" icon={Users} label="Workspaces" />
                        </>
                    )}
                </nav>

                {/* User Profile & Logout */}
                <div className="absolute bottom-0 w-full p-3 border-t border-border glass-dark">
                    <div className="flex items-center gap-3 mb-3 px-3 py-2 rounded-md bg-muted/50">
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-sm">
                            {user?.email[0].toUpperCase()}
                        </div>
                        <div className="overflow-hidden flex-1">
                            <p className="text-sm font-medium text-foreground truncate">{user?.email}</p>
                            <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-secondary hover:bg-destructive/10 text-secondary-foreground hover:text-destructive rounded-md text-sm font-medium transition-smooth"
                    >
                        <LogOut className="w-4 h-4" />
                        <span>Logout</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                <Outlet />
            </main>

            {/* Overlay for mobile */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-30 lg:hidden backdrop-blur-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}
        </div>
    );
};
