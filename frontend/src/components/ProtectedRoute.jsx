import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

const ProtectedRoute = ({ allowedRoles = [] }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="flex justify-center items-center min-h-screen"><div className="loading-spinner" /></div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles.length && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
};

export default ProtectedRoute;
