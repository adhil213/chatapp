import { API_BASE_URL } from './config';

let authToken = null;

export function setAuthToken(token) {
  authToken = token || null;
}

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = {};

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const bearer = token || authToken;

  if (bearer) {
    headers.Authorization = `Bearer ${bearer}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const payload = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(payload.message || `Request failed with status ${res.status}`);
    error.status = res.status;
    error.code = payload.code;
    throw error;
  }

  return payload;
}

export async function getHealth() {
  return request('/api/health');
}

export async function register({ username, displayName, password, secretKey }) {
  return request('/api/auth/register', {
    method: 'POST',
    body: { username, displayName, password, secretKey },
  });
}

export async function login({ username, password }) {
  return request('/api/auth/login', {
    method: 'POST',
    body: { username, password },
  });
}

export async function getMe() {
  const body = await request('/api/auth/me');

  return body.user;
}

export async function updateMe({ displayName }) {
  const body = await request('/api/auth/me', {
    method: 'PATCH',
    body: { displayName },
  });

  return body.user;
}

export async function deleteAccount() {
  return request('/api/auth/me', { method: 'DELETE' });
}

export async function searchUsers(q) {
  const params = new URLSearchParams({ q });

  const body = await request(`/api/users/search?${params.toString()}`);

  return body.users;
}

export async function getUser(id) {
  const body = await request(`/api/users/${id}`);

  return body.user;
}

export async function listConversations() {
  const body = await request('/api/conversations');

  return body.conversations;
}

export async function listRequests() {
  return request('/api/requests');
}

export async function createRequest({ userId, username }) {
  const body = await request('/api/requests', {
    method: 'POST',
    body: userId ? { userId } : { username },
  });

  return body.request;
}

export async function acceptRequest(id) {
  return request(`/api/requests/${id}/accept`, { method: 'POST' });
}

export async function rejectRequest(id) {
  return request(`/api/requests/${id}/reject`, { method: 'POST' });
}

export async function verifySecretKey({ secretKey }) {
  return request('/api/vault/unlock', {
    method: 'POST',
    body: { secretKey },
  });
}

export async function createSecretKey({ secretKey }) {
  const body = await request('/api/vault/secret-key', {
    method: 'POST',
    body: { secretKey },
  });

  return body.user;
}

export async function changeSecretKey({ currentSecretKey, newSecretKey }) {
  const body = await request('/api/vault/secret-key', {
    method: 'PATCH',
    body: { currentSecretKey, newSecretKey },
  });

  return body.user;
}

export async function resetSecretKey({ secretKey }) {
  const body = await request('/api/vault/reset', {
    method: 'POST',
    body: { secretKey },
  });

  return body.user;
}

export async function setNotepadMode(enabled) {
  const body = await request('/api/vault/notepad-mode', {
    method: 'PATCH',
    body: { enabled },
  });

  return body.user;
}

export async function listNotes() {
  const body = await request('/api/notes');

  return body.notes;
}

export async function createNote({ title, content }) {
  const body = await request('/api/notes', {
    method: 'POST',
    body: { title, content },
  });

  return body.note;
}

export async function updateNote(id, { title, content }) {
  const body = await request(`/api/notes/${id}`, {
    method: 'PATCH',
    body: { title, content },
  });

  return body.note;
}

export async function deleteNote(id) {
  return request(`/api/notes/${id}`, { method: 'DELETE' });
}

export async function clearConversation(otherId) {
  return request(`/api/conversations/${otherId}/messages`, { method: 'DELETE' });
}

export async function clearAllConversations() {
  return request('/api/conversations/messages', { method: 'DELETE' });
}

export async function getConversationMessages({ otherId, limit, before, after } = {}) {
  const params = new URLSearchParams();

  if (limit) params.set('limit', String(limit));
  if (before) params.set('before', before);
  if (after) params.set('after', after);

  const query = params.toString();

  return request(`/api/conversations/${otherId}/messages${query ? `?${query}` : ''}`);
}
