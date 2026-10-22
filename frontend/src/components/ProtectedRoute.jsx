import { Navigate, Outlet } from 'react-router-dom';
import { getAccessToken } from '../utils/authHelper';
import { jwtDecode } from 'jwt-decode';
import dayjs from 'dayjs';

const ProtectedRoute = ({ allowedRoles }) => {
	const token = getAccessToken();

	if (!token) return <Navigate to="/login" />;

	let decoded;
	try {
		decoded = jwtDecode(token);
	} catch {
		return <Navigate to="/login" />;
	}

	const isExpired = !decoded?.exp || dayjs.unix(decoded.exp).isBefore(dayjs());
	if (isExpired) return <Navigate to="/login" />;

	if (!allowedRoles.includes(decoded.role)) {
		return <Navigate to="/" replace />;
	}

	return <Outlet />;
};

export default ProtectedRoute;
