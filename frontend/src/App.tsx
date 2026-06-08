import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';
import Dashboard from './components/Dashboard';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AdminDashboard from './pages/AdminDashboard';

/**
 * App — root component with routing.
 *
 * Route structure:
 *   /login     → LoginPage    (public — no login required)
 *   /register  → RegisterPage (public — no login required)
 *   /          → Dashboard    (PROTECTED — PrivateRoute redirects to /login if not logged in)
 *   *          → redirect to /
 *
 * AuthProvider wraps everything so ALL components can access auth state via useAuth().
 */
function App() {
  return (
    <ErrorBoundary>
      {/* AuthProvider must wrap BrowserRouter so PrivateRoute can access auth state */}
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public routes — accessible without login */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected route — PrivateRoute checks if user is logged in */}
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              }
            />

            {/* Admin route — AdminRoute checks if user is logged in and role is Admin */}
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              }
            />

            {/* Catch-all: redirect unknown paths to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
