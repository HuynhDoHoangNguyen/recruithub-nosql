import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getAccessToken } from '../utils/authHelper';
import { jwtDecode } from 'jwt-decode';
import dayjs from 'dayjs';
import { normalizeRole } from '../features/applications/applicationPresentation';

const ProtectedRoute = ({ allowedRoles }) => {
	const location = useLocation();
	const token = getAccessToken();

	if (!token) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;

	let decoded;
	try {
		decoded = jwtDecode(token);
	} catch {
		return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
	}

	const isExpired = !decoded?.exp || dayjs.unix(decoded.exp).isBefore(dayjs());
	if (isExpired) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;

	if (!allowedRoles.map(normalizeRole).includes(normalizeRole(decoded.role))) {
		return <Navigate to="/" replace />;
	}

	return <Outlet />;
};

export default ProtectedRoute;
