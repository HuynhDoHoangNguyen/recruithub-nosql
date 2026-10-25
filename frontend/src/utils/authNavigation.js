const DASHBOARD_BY_ROLE = Object.freeze({
  CANDIDATE: '/user/dashboard',
  RECRUITER: '/recruiter/dashboard',
  ADMIN: '/admin/dashboard',
});

function allowedDestination(role, pathname) {

  if (role === 'CANDIDATE') {
    if (['/profile', '/user/dashboard'].includes(pathname)) return true;
    if (!pathname.startsWith('/jobs/')) return false;
    try {
      return /^job:(?:cms:J_[0-9]{6}|[a-z0-9_-]+)$/.test(decodeURIComponent(pathname.slice('/jobs/'.length)));
    } catch {
      return false;
    }
  }
  if (role === 'RECRUITER') return /^\/recruiter\/(dashboard|jobs\/create|jobs\/[^/]+\/(edit|applicants))$/.test(pathname);

  if (role === 'ADMIN') return pathname === '/admin/dashboard';
  return false;
}

export function dashboardPathForRole(role) {
  return DASHBOARD_BY_ROLE[role] || '/';
}

export function postLoginPath(role, destination) {
  const fallback = dashboardPathForRole(role);
  if (typeof destination !== 'string' || !destination.startsWith('/') || destination.startsWith('//') || destination.includes('\\') || [...destination].some((character) => character.charCodeAt(0) < 0x20)) return fallback;
  const match = destination.match(/^([^?#]*)([?#].*)?$/);
  const pathname = match?.[1] || '';
  if (!allowedDestination(role, pathname)) return fallback;
  return `${pathname}${match?.[2] || ''}`;
}
