// Auth — Web3Auth no-modal v9 integration.
// Requires VITE_WEB3AUTH_CLIENT_ID in website/client/.env
// Sessions are token-based (Authorization: Bearer <token>), no cookies.
//
// Uses redirect mode because Google's OAuth page sets Cross-Origin-Opener-Policy: same-origin,
// which nulls window.opener in the popup and prevents the postMessage callback from working.
// Redirect mode avoids the popup: the whole page navigates to the OAuth provider and back.

const CLIENT_ID = import.meta.env.VITE_WEB3AUTH_CLIENT_ID ?? '';

let _web3auth = null;

async function getWeb3Auth() {
  if (_web3auth) return _web3auth;
  const [{ Web3AuthNoModal }, { CHAIN_NAMESPACES }, { AuthAdapter }, { CommonPrivateKeyProvider }] = await Promise.all([
    import('@web3auth/no-modal'),
    import('@web3auth/base'),
    import('@web3auth/auth-adapter'),
    import('@web3auth/base-provider'),
  ]);
  const chainConfig = {
    chainNamespace: CHAIN_NAMESPACES.OTHER,
    chainId: '0x0',
    rpcTarget: 'http://localhost',  // unused — OTHER namespace makes no RPC calls
  };
  // v9: privateKeyProvider must be passed so no-modal can call setKeyExportFlag on it
  // when project config returns key_export_enabled. CommonPrivateKeyProvider skips
  // EIP-1559 probing and other chain calls — safe for auth-only (no wallet) use.
  const privateKeyProvider = new CommonPrivateKeyProvider({ config: { chainConfig } });
  _web3auth = new Web3AuthNoModal({
    clientId: CLIENT_ID,
    web3AuthNetwork: 'sapphire_mainnet',
    privateKeyProvider,
  });
  // v9: social login requires an explicitly configured AuthAdapter.
  _web3auth.configureAdapter(new AuthAdapter({
    adapterSettings: { uxMode: 'redirect' },
  }));
  // init() on the redirect-return page automatically processes the stored OAuth result.
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
    console.log('[auth] signed in:', info.name, info.email);
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
      // If already connected from a previous session, log out first.
      if (w3a.connected) await w3a.logout();
      // sessionStorage survives same-tab OAuth redirects (cleared only when tab closes).
      sessionStorage.setItem('orbital_oauth_pending', '1');
      // In redirect mode connectTo navigates the page away — nothing after it runs.
      await w3a.connectTo('auth', { loginProvider: provider });
      // Only reached if the adapter fell back to popup mode:
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
      // v9: init() above automatically processes the OAuth redirect result.
      // After init() resolves, w3a.connected should be true if the redirect succeeded.
      // Brief poll in case the status update lags behind init() resolving.
      for (let i = 0; i < 50; i++) {
        if (w3a.connected) break;
        await new Promise(r => setTimeout(r, 100));
      }
      sessionStorage.removeItem('orbital_oauth_pending');
      if (w3a.connected) {
        await this._finishLogin(w3a);
      } else {
        console.warn('[auth] redirect: not connected after init, status:', w3a.status);
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
      if (w3a?.connected) await w3a.logout();
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
