// Minimal client-side router using the History API.
// Import `router` to read the current path; call `navigate()` to push a new route.

class Router {
  path = $state(typeof window !== 'undefined' ? window.location.pathname : '/');

  navigate(to) {
    if (to === this.path) return;
    history.pushState({}, '', to);
    this.path = to;
  }

  // Parse /area and /area/project from the current path
  get parts() {
    const segs = this.path.replace(/^\//, '').split('/').filter(Boolean);
    return { area: segs[0] ?? null, project: segs[1] ?? null };
  }
}

export const router = new Router();

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => { router.path = window.location.pathname; });
}
