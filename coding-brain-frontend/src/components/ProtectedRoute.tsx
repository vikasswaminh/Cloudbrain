import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../auth/store';
import React from 'react';

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const isAuthenticated = useAuthStore((state) => state.token);

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return children;
};
