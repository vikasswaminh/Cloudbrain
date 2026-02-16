import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { PlanGenerator } from './pages/PlanGenerator';
import { ExecutionDetail } from './pages/ExecutionDetail';
import { ModelsPage } from './pages/ModelsPage';
import { ApiKeysPage } from './pages/ApiKeysPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/plan" element={<PlanGenerator />} />
          <Route path="/execution/:id" element={<ExecutionDetail />} />
          <Route path="/keys" element={<ApiKeysPage />} />
          <Route path="/admin/models" element={<ModelsPage />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
