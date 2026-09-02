import { json, methodNotAllowed } from '../_lib/http.js';
import { getMember, memberAuthIsConfigured, providerStatus } from '../_lib/member-auth.js';

export async function fetch(request) {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);
  if (!memberAuthIsConfigured()) {
    return json({ authenticated: false, configured: false, providers: providerStatus() }, 503);
  }
  try {
    const user = await getMember(request);
    return json({ authenticated: Boolean(user), configured: true, providers: providerStatus(), user });
  } catch {
    return json({ authenticated: false, configured: true, providers: providerStatus(), user: null });
  }
}

