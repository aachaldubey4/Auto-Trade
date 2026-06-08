import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface Props {
  children: React.ReactNode;
}

/**
 * AdminRoute — wraps any page that requires Admin role.
 *
 * HOW IT WORKS:
 *   - Reads isAuthenticated, user, and isLoading from AuthContext
 *   - If auth is loading, shows a loading spinner
 *   - If not logged in, redirects to /login
 *   - If logged in but not an Admin, redirects to /
 *   - If logged in AND role is 'Admin', renders the children
 */
export default function AdminRoute({ children }: Props) {
  const { isAuthenticated, user, isLoading } = useAuth();

  // Show a spinner while checking auth state or loading user profile
  if (isLoading || (isAuthenticated && !user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  // Not logged in → redirect to login page
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Logged in but not Admin → redirect to standard homepage
  if (user?.role !== 'Admin') {
    return <Navigate to="/" replace />;
  }

  // Admin verified → render child components
  return <>{children}</>;
}
