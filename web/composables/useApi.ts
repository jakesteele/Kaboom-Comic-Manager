export function useApi() {
  const config = useRuntimeConfig();
  const baseUrl = config.public.apiBase;

  function authHeaders(): Record<string, string> {
    const { token } = useAuth();
    if (token.value) {
      return { Authorization: `Bearer ${token.value}` };
    }
    return {};
  }

  async function get<T>(path: string): Promise<T> {
    return await $fetch<T>(`${baseUrl}/api${path}`, { headers: authHeaders() });
  }

  async function post<T>(path: string, body?: Record<string, any>): Promise<T> {
    return await $fetch<T>(`${baseUrl}/api${path}`, { method: 'POST', body, headers: authHeaders() });
  }

  async function patch<T>(path: string, body: Record<string, any>): Promise<T> {
    return await $fetch<T>(`${baseUrl}/api${path}`, { method: 'PATCH', body, headers: authHeaders() });
  }

  async function del<T>(path: string): Promise<T> {
    return await $fetch<T>(`${baseUrl}/api${path}`, { method: 'DELETE', headers: authHeaders() });
  }

  return { get, post, patch, del, baseUrl };
}
