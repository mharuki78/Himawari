import { completeOAuth } from '../../_lib/oauth.js';

export function fetch(request) {
  return completeOAuth(request, 'google');
}

