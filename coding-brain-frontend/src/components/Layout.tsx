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
    X
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

    const NavItem = ({ to, icon: Icon, label, adminOnly }: { to: string, icon: any, label: string, adminOnly?: boolean }) => {
        if (adminOnly && user?.role !== 'admin') return null;

        const isActive = location.pathname === to;
        return (
            <Link
                to={to}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                    }`}
                onClick={() => setIsMobileMenuOpen(false)}
            >
                <Icon className="w-5 h-5" />
                <span>{label}</span>
            </Link>
        );
    };

    return (
        <div className="min-h-screen bg-gray-900 flex">
            {/* Mobile Menu Button */}
            <button
                className="lg:hidden fixed top-4 right-4 z-50 p-2 bg-gray-800 rounded text-white"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
                {isMobileMenuOpen ? <X /> : <Menu />}
            </button>

            {/* Sidebar */}
            <aside className={`
                fixed lg:static inset-y-0 left-0 z-40 w-64 bg-gray-900 border-r border-gray-800 transform transition-transform duration-200 ease-in-out
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                <div className="p-6">
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
                        CloudBrain
                    </h1>
                    <p className="text-xs text-gray-500 mt-1">AI Execution Platform</p>
                </div>

                <nav className="px-4 space-y-2 mt-4">
                    <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
                    <NavItem to="/plan" icon={PlusCircle} label="New Plan" />
                    <NavItem to="/keys" icon={Key} label="API Keys" />
                    <NavItem to="/admin/models" icon={Database} label="Models" adminOnly={true} />
                    <NavItem to="/admin/dashboard" icon={BarChart3} label="Analytics" adminOnly={true} />
                </nav>

                <div className="absolute bottom-0 w-full p-4 border-t border-gray-800">
                    <div className="flex items-center space-x-3 mb-4 px-4">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                            {user?.email[0].toUpperCase()}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm text-white truncate">{user?.email}</p>
                            <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center space-x-2 p-2 bg-gray-800 hover:bg-red-900/30 text-gray-400 hover:text-red-400 rounded transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        <span>Logout</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto bg-gray-900">
                <Outlet />
            </main>

            {/* Overlay for mobile */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-30 lg:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}
        </div>
    );
};
