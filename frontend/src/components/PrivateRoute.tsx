import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface Props {
  children: React.ReactNode;
}

/**
 * PrivateRoute — wraps any page that requires login.
 *
 * HOW IT WORKS:
 *   - Reads isAuthenticated from AuthContext
 *   - If user IS logged in → renders the children (the protected page)
 *   - If user is NOT logged in → redirects to /login
 *
 * Usage in App.tsx:
 *   <Route path="/" element={
 *     <PrivateRoute><Dashboard /></PrivateRoute>
 *   } />
 *
 * The `replace` prop on <Navigate> replaces the current history entry,
 * so pressing Back in the browser doesn't loop back to the protected page.
 */
export default function PrivateRoute({ children }: Props) {
  const { isAuthenticated, isLoading } = useAuth();

  // Show a spinner while checking auth state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  // Not logged in → go to login page
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Logged in → render the protected page
  return <>{children}</>;
}
