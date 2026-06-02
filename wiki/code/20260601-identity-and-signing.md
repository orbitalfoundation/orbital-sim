# Identity and signing

## Why cryptographic identity matters here

Orbital publishes simulations as arguments — claims about how the world works, backed by
mechanistic models and real data. Authorship provenance matters in a way it doesn't for
a blog post. A scenario that projects 3°C warming in MENA by 2049 should be attributable
to a specific, verifiable identity that cannot be forged or reassigned.

Standard OAuth (Google, GitHub, email link) gives you a session tied to a corporate
account that can be revoked, suspended, or impersonated at the platform level. It gives
users no way to prove they created something outside the platform's own records.

## Web3Auth and keypairs

We use Web3Auth for login specifically because it issues users real secp256k1 keypairs,
not just session cookies. Every user has an Ethereum-compatible public/private key pair.
Today those keys are custodied by Web3Auth's distributed key generation (DKG) network —
not by us, and not by any single party. Users can migrate to a self-custodied wallet
(MetaMask, hardware wallet) and retain the same public key and address.

This gives us a stable, portable, cryptographically verifiable author identity from day one.

## What we store

When a user logs in, the server extracts from the Web3Auth idToken:

- `email`, `name`, `profileImage` — from the OAuth provider (Google, etc.)
- `address` — checksummed Ethereum address (e.g. `0xAbC...`), derived from the public key
- `publicKey` — uncompressed secp256k1 hex (65 bytes, `04` prefix)

The address is the stable public identity. The public key enables signature verification.

## Signing scenarios (future)

When a user publishes a scenario, the intended flow is:

1. The scenario manifest (or a hash of it) is presented to the user's wallet for signing
2. The resulting signature is stored alongside the manifest
3. Anyone can verify: `ecrecover(hash, signature) === author_address`

This works the same whether the key is custodied by Web3Auth or held in a hardware wallet.
The signature is the proof; the custody arrangement is irrelevant to verification.

## Area ownership

Currently, area namespaces (`/anselm`, `/rania`, etc.) are first-come-first-serve based
on the email prefix. The correct long-term model is: an area belongs to a public key, not
an email. A user who migrates wallets should be able to re-claim their area by signing a
challenge with their new key, proving they control the same identity.

## Security status and open todos

The current implementation is functional but deliberately minimal. Items to tighten over time:

**JWT verification**
The server now verifies Web3Auth idTokens against the JWKS endpoint
(`https://api-auth.web3auth.io/.well-known/jwks.json`) using ES256 signature checking.
This means forged tokens are rejected at the boundary.

@todo Verify the `iss` (issuer) and `aud` (audience) claims in the JWT, not just the
signature. Right now any valid Web3Auth token for any project will pass.

@todo Set an expiry check on the idToken (`exp` claim) — Web3Auth tokens are short-lived
but we should enforce this explicitly rather than relying on the SDK.

**Session store**
Sessions are in-memory only — a server restart logs everyone out. Acceptable for now.

@todo Persist sessions to disk or Redis so restarts are transparent to users.

@todo Add session expiry. Currently sessions live forever in the Map. A sensible default
is 7 days or until explicit logout.

@todo Rate-limit `/api/auth/session` to prevent token-scanning attacks.

**Area ownership**
@todo Area namespaces are currently first-come-first-serve by email prefix with no
server-side auth check — the `Authorization` header is present on `POST /api/areas/:name/:project`
but the token is only checked for existence, not matched against the area name. Anyone
with a valid session can create projects in any area.

**Scenario integrity**
@todo Scenario manifests and published files are not signed. There is nothing currently
preventing someone with filesystem access from modifying a published scenario.
The signing flow described above (ecrecover against author address) is the intended fix.

**WEB3AUTH_SECRET**
The client secret is loaded from `website/server/.env` and available as
`process.env.WEB3AUTH_SECRET`. It is not yet used in the codebase.

@todo Determine the correct use for the secret (server-to-server Web3Auth API calls,
if any) and wire it up or document that it is not needed for this use case.

## What this is not

This is not a blockchain application. We are not storing anything on-chain, issuing tokens,
or requiring users to understand crypto. Web3Auth's social login flow looks identical to
standard OAuth from the user's perspective — one click, no seed phrases. The keypair is
an implementation detail that enables provenance without adding friction.
