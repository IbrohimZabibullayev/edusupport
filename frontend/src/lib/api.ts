export const API_URL: string = import.meta.env.VITE_API_URL || "http://localhost:3000";

const TOKEN_KEY = "es_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (res.status === 401 && !path.startsWith("/api/auth")) {
    setToken(null);
    window.location.assign("/login");
    throw new Error("Sessiya muddati tugadi");
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error ?? `Server xatosi (${res.status})`);
  }
  return body as T;
}
