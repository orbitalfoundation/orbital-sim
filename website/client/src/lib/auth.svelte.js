// Auth — Web3Auth no-modal integration.
// Requires VITE_WEB3AUTH_CLIENT_ID in website/client/.env
// Sessions are token-based (Authorization: Bearer <token>), no cookies.
//
// Uses redirect mode (uiConfig.uxMode = 'redirect') because Google's OAuth page sets
// Cross-Origin-Opener-Policy: same-origin, which nulls window.opener in the popup and
// prevents Web3Auth's postMessage callback from reaching our page. Redirect mode avoids
// the popup entirely: the whole page navigates to Google and back.

const CLIENT_ID = import.meta.env.VITE_WEB3AUTH_CLIENT_ID ?? '';

let _web3auth = null;

async function getWeb3Auth() {
  if (_web3auth) return _web3auth;
  const [{ Web3AuthNoModal }, { CHAIN_NAMESPACES }] = await Promise.all([
    import('@web3auth/no-modal'),
    import('@web3auth/base'),
  ]);
  _web3auth = new Web3AuthNoModal({
    clientId: CLIENT_ID,
    web3AuthNetwork: 'sapphire_mainnet',
    // OTHER skips EIP1193 Ethereum provider setup (setupWeb3/readable-stream).
    chainConfig: { chainNamespace: CHAIN_NAMESPACES.OTHER },
    // redirect mode: no popup, full-page navigation to OAuth provider and back.
    // Passed via uiConfig because no-modal v10 reads uiConfig.uxMode into connectorSettings.
    uiConfig: { uxMode: 'redirect' },
  });
  // init() processes any pending OAuth redirect result stored in localStorage.
  await _web3auth.init();
  return _web3auth;
}

class Auth {
  user    = $state(null);   // { name, email, profileImage } when logged in
  token   = $state(null);   // session token — send as Authorization: Bearer <token>
  loading = $state(false);

  get loggedIn() { return !!this.user; }

  get headers() {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }

  // Derive the namespace/area this user owns from their email prefix
  get area() {
    return this.user?.email?.split('@')[0]?.toLowerCase() ?? null;
  }

  // Shared: exchange a connected Web3Auth instance for an Orbital session token.
  async _finishLogin(w3a) {
    const info = await w3a.getUserInfo();
    if (!info?.idToken) throw new Error('no idToken in getUserInfo response');
    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: info.idToken }),
    });
    if (!res.ok) throw new Error(await res.text());
    const { token } = await res.json();
    this.token = token;
    this.user  = { name: info.name, email: info.email, profileImage: info.profileImage };
    sessionStorage.setItem('orbital_token', token);
    sessionStorage.setItem('orbital_user',  JSON.stringify(this.user));
  }

  async login(provider = 'google') {
    if (!CLIENT_ID) {
      alert('VITE_WEB3AUTH_CLIENT_ID not set in website/client/.env');
      return;
    }
    this.loading = true;
    try {
      const w3a = await getWeb3Auth();
      // Wait until the auth connector is ready to accept a new connection.
      for (let i = 0; i < 50; i++) {
        const s = w3a.getConnector?.('auth')?.status;
        if (s === 'ready' || s === 'connected') break;
        await new Promise(r => setTimeout(r, 100));
      }
      if (w3a.getConnector?.('auth')?.status === 'connected') await w3a.logout();
      // sessionStorage survives same-tab OAuth redirects (cleared only when tab closes).
      // This flag lets checkRedirect know the return leg of the redirect is ours.
      sessionStorage.setItem('orbital_oauth_pending', '1');
      // In redirect mode connectTo navigates the page away — nothing after it runs.
      await w3a.connectTo('auth', { authConnection: provider });
      // Only reached if the connector fell back to popup mode:
      sessionStorage.removeItem('orbital_oauth_pending');
      await this._finishLogin(w3a);
    } catch (err) {
      sessionStorage.removeItem('orbital_oauth_pending');
      console.error('[auth] login failed', err);
      alert(`Sign-in failed: ${err.message}`);
    }
    this.loading = false;
  }

  // Called on every page load. Does nothing unless orbital_oauth_pending is set,
  // meaning we just returned from an OAuth redirect — complete the login here.
  async checkRedirect() {
    if (!sessionStorage.getItem('orbital_oauth_pending')) return;
    this.loading = true;
    try {
      const w3a = await getWeb3Auth();
      // init() above processes the redirect result; wait until the connector reaches 'connected'.
      // v10: this transition can lag behind init() resolving, so poll up to 10s.
      for (let i = 0; i < 100; i++) {
        const s = w3a.getConnector?.('auth')?.status;
        if (s === 'connected') break;
        await new Promise(r => setTimeout(r, 100));
      }
      const authStatus = w3a.getConnector?.('auth')?.status;
      sessionStorage.removeItem('orbital_oauth_pending');
      if (authStatus === 'connected') {
        await this._finishLogin(w3a);
      } else {
        console.warn('[auth] redirect: connector did not connect, status:', authStatus);
      }
    } catch (err) {
      sessionStorage.removeItem('orbital_oauth_pending');
      console.error('[auth] checkRedirect failed', err);
    }
    this.loading = false;
  }

  async logout() {
    try {
      await fetch('/api/auth/session', { method: 'DELETE', headers: this.headers });
      const w3a = await getWeb3Auth().catch(() => null);
      if (w3a?.getConnector?.('auth')?.status === 'connected') await w3a.logout();
    } catch { /* best effort */ }
    this.user  = null;
    this.token = null;
    sessionStorage.removeItem('orbital_token');
    sessionStorage.removeItem('orbital_user');
  }

  // Restore session from sessionStorage on page load (no server round-trip needed for UI).
  restore() {
    const token = sessionStorage.getItem('orbital_token');
    const user  = sessionStorage.getItem('orbital_user');
    if (token && user) {
      this.token = token;
      this.user  = JSON.parse(user);
    }
  }
}

export const auth = new Auth();
