import { methodNotAllowed } from '../_lib/http.js';
import { startOAuth } from '../_lib/oauth.js';

export function fetch(request) {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);
  return startOAuth(request);
}

