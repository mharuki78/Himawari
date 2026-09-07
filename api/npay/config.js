import { json, methodNotAllowed } from '../_lib/http.js';
import { npayPublicConfiguration } from '../_lib/npay.js';

export async function fetch(request) {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);
  return json(npayPublicConfiguration());
}
