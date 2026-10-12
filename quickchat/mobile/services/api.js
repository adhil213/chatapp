import { API_BASE_URL } from './config';

async function request(path, options) {
  const res = await fetch(`${API_BASE_URL}${path}`, options);
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(body.message || `Request failed with status ${res.status}`);
    error.status = res.status;
    error.suggestions = body.suggestions || [];
    throw error;
  }

  return body;
}

export async function getHealth() {
  return request('/api/health');
}

export async function registerUser(displayName) {
  const body = await request('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName }),
  });

  return body.user;
}

export async function listUsers({ exclude, q } = {}) {
  const params = new URLSearchParams();

  if (exclude) params.set('exclude', exclude);
  if (q) params.set('q', q);

  const query = params.toString();
  const body = await request(`/api/users${query ? `?${query}` : ''}`);

  return body.users;
}

export async function getUser(id) {
  const body = await request(`/api/users/${id}`);

  return body.user;
}

export async function getMessages({ userId, otherId, limit, before, after } = {}) {
  const params = new URLSearchParams();

  params.set('userId', userId);
  params.set('otherId', otherId);

  if (limit) params.set('limit', String(limit));
  if (before) params.set('before', before);
  if (after) params.set('after', after);

  return request(`/api/messages?${params.toString()}`);
}
