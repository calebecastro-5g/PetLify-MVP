const TOKEN_KEY = 'petlify_access_token';
const ROLE_KEY = 'petlify_role';
const NAME_KEY = 'petlify_name';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export type UserRole = 'cliente' | 'funcionario' | 'dono';

export function saveSession(accessToken: string, role: UserRole | string, name?: string) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(ROLE_KEY, role);
  if (name) localStorage.setItem(NAME_KEY, name);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRole() {
  return localStorage.getItem(ROLE_KEY) as UserRole | null;
}

export function getName() {
  return localStorage.getItem(NAME_KEY);
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(NAME_KEY);
}

export function apiUrl(path: string) {
  if (path.startsWith('http')) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers = new Headers(options.headers);

  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(apiUrl(path), {
    ...options,
    headers,
  });
}
