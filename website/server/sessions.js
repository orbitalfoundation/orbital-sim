// sessions — in-memory session store.
// Sessions are bearer tokens; no cookies.
// idTokens from Web3Auth are verified against their public JWKS before use.

import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS = createRemoteJWKSet(
  new URL('https://api-auth.web3auth.io/.well-known/jwks.json')
);

const store = new Map(); // token → { email, name, profileImage, publicKey, address, createdAt }

async function verifyIdToken(idToken) {
  try {
    const { payload } = await jwtVerify(idToken, JWKS, { algorithms: ['ES256'] });
    return payload;
  } catch (err) {
    throw new Error(`invalid id token: ${err.message}`);
  }
}

export async function createSession(idToken) {
  const claims = await verifyIdToken(idToken);

  const email        = claims.email ?? claims.aggregateVerifierData?.email ?? null;
  const name         = claims.name  ?? claims.aggregateVerifierData?.name  ?? email;
  const profileImage = claims.picture ?? null;

  // Cryptographic identity — stable across sessions, portable to self-custodied wallets.
  const wallet    = claims.wallets?.[0] ?? null;
  const publicKey = wallet?.public_key ?? null;  // uncompressed secp256k1 hex
  const address   = wallet?.address    ?? null;  // checksummed Ethereum address

  const sessionToken = crypto.randomUUID();
  store.set(sessionToken, { email, name, profileImage, publicKey, address, createdAt: Date.now() });
  return { token: sessionToken, email, name, address };
}

export function getSession(bearerToken) {
  if (!bearerToken) return null;
  const token = bearerToken.replace(/^Bearer\s+/i, '');
  return store.get(token) ?? null;
}

export function deleteSession(bearerToken) {
  const token = (bearerToken ?? '').replace(/^Bearer\s+/i, '');
  store.delete(token);
}
