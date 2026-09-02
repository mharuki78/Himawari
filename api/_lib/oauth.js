import { createHash, randomBytes } from 'node:crypto';
import {
  clearOAuthCookies,
  createMemberSession,
  createOAuthStateCookie,
  providerIsConfigured,
  readOAuthState,
  safeReturnTo,
  upsertOAuthUser,
} from './member-auth.js';
import { redirect } from './http.js';

const PROVIDERS = new Set(['naver', 'google']);

function applicationOrigin(request) {
  try {
    return new URL(process.env.PUBLIC_SITE_URL || new URL(request.url).origin).origin;
  } catch {
    return new URL(request.url).origin;
  }
}

function callbackUrl(request, provider) {
  return `${applicationOrigin(request)}/api/auth/callback/${provider}`;
}

function statusUrl(request, returnTo, status) {
  const url = new URL(safeReturnTo(returnTo), applicationOrigin(request));
  url.searchParams.set('auth', status);
  return url.href;
}

function formBody(values) {
  return new URLSearchParams(values).toString();
}

async function postForm(url, values) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: formBody(values),
    signal: AbortSignal.timeout(12_000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.error) throw new Error('OAuth token exchange failed.');
  return body;
}

async function getJson(url, accessToken) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error('OAuth profile request failed.');
  return body;
}

export function startOAuth(request) {
  const url = new URL(request.url);
  const canonicalOrigin = applicationOrigin(request);
  if (url.origin !== canonicalOrigin) {
    return redirect(`${canonicalOrigin}${url.pathname}${url.search}`);
  }
  const provider = url.searchParams.get('provider') || '';
  if (!PROVIDERS.has(provider) || !providerIsConfigured(provider)) {
    return redirect(statusUrl(request, url.searchParams.get('returnTo'), 'provider-unavailable'));
  }

  const verifier = provider === 'google' ? randomBytes(48).toString('base64url') : '';
  const { state, cookie } = createOAuthStateCookie(request, {
    provider,
    returnTo: url.searchParams.get('returnTo'),
    verifier,
  });
  const redirectUri = callbackUrl(request, provider);
  let authorization;

  if (provider === 'naver') {
    authorization = new URL('https://nid.naver.com/oauth2.0/authorize');
    authorization.search = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.NAVER_CLIENT_ID,
      redirect_uri: redirectUri,
      state,
    });
  } else {
    authorization = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authorization.search = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      scope: 'openid email profile',
      state,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
      prompt: 'select_account',
    });
  }

  return redirect(authorization.href, 302, [cookie]);
}

async function googleProfile(request, code, verifier) {
  const token = await postForm('https://oauth2.googleapis.com/token', {
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: callbackUrl(request, 'google'),
    grant_type: 'authorization_code',
    code_verifier: verifier,
  });
  const profile = await getJson('https://openidconnect.googleapis.com/v1/userinfo', token.access_token);
  if (!profile.sub) throw new Error('Google profile is missing a subject.');
  return {
    provider: 'google',
    providerUserId: String(profile.sub),
    email: profile.email_verified === false ? '' : String(profile.email || ''),
    displayName: String(profile.name || profile.email || 'Google 회원'),
    avatarUrl: String(profile.picture || ''),
  };
}

async function naverProfile(request, code, state) {
  const token = await postForm('https://nid.naver.com/oauth2.0/token', {
    grant_type: 'authorization_code',
    client_id: process.env.NAVER_CLIENT_ID,
    client_secret: process.env.NAVER_CLIENT_SECRET,
    redirect_uri: callbackUrl(request, 'naver'),
    code,
    state,
  });
  const result = await getJson('https://openapi.naver.com/v1/nid/me', token.access_token);
  const profile = result.response || {};
  if (result.resultcode !== '00' || !profile.id) throw new Error('Naver profile is missing an id.');
  return {
    provider: 'naver',
    providerUserId: String(profile.id),
    email: String(profile.email || ''),
    displayName: String(profile.name || profile.nickname || profile.email || '네이버 회원'),
    avatarUrl: String(profile.profile_image || ''),
  };
}

export async function completeOAuth(request, provider) {
  const url = new URL(request.url);
  const providedState = url.searchParams.get('state') || '';
  const state = readOAuthState(request, provider, providedState);
  const cleared = clearOAuthCookies(request);
  if (!state || !providerIsConfigured(provider)) {
    return redirect(statusUrl(request, '/', 'state-error'), 302, cleared);
  }
  if (url.searchParams.get('error')) {
    return redirect(statusUrl(request, state.returnTo, 'cancelled'), 302, cleared);
  }
  const code = url.searchParams.get('code') || '';
  if (!code) return redirect(statusUrl(request, state.returnTo, 'callback-error'), 302, cleared);

  try {
    const profile = provider === 'google'
      ? await googleProfile(request, code, state.verifier)
      : await naverProfile(request, code, providedState);
    const user = await upsertOAuthUser(profile);
    const sessionCookie = await createMemberSession(request, user.id);
    return redirect(statusUrl(request, state.returnTo, 'success'), 302, [...cleared, sessionCookie]);
  } catch (error) {
    console.error(`OAuth callback failed for ${provider}:`, error instanceof Error ? error.message : 'unknown error');
    return redirect(statusUrl(request, state.returnTo, 'failed'), 302, cleared);
  }
}
