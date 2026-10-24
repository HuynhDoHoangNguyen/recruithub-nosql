import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { normalizeRole } from '../features/applications/applicationPresentation';

// JWT is only a credential transport: access decisions use the User verified by /auth/me.
const ProtectedRoute = ({ allowedRoles = [] }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="loading-spinner" /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}${location.hash}` }} />;
  const allowed = allowedRoles.map(normalizeRole);
  if (allowed.length && !allowed.includes(normalizeRole(user.role))) return <Navigate to="/" replace />;
  return <Outlet />;
};

export default ProtectedRoute;
