export function getDashboardBasePath(pathname = typeof window !== 'undefined' ? window.location.pathname : '') {
  const segs = String(pathname || '').split('/').filter(Boolean);
  const dashIdx = segs.findIndex((s) =>
    s === 'dashboard' || s === 'superadmin' || s.startsWith('dashboard_')
  );

  return dashIdx >= 0 ? `/${segs.slice(dashIdx, dashIdx + 1).join('/')}` : '/dashboard';
}

export function buildDashboardPath(route = '', pathname) {
  const base = getDashboardBasePath(pathname);
  const clean = String(route || '').replace(/^\/+|\/+$/g, '');
  return clean ? `${base}/${clean}` : base;
}

export function useDashboardBasePath(location) {
  if (location && typeof location.pathname === 'string') {
    return getDashboardBasePath(location.pathname);
  }

  if (typeof window === 'undefined') return '/dashboard';
  return getDashboardBasePath(window.location.pathname);
}
