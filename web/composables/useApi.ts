export function useApi() {
  const config = useRuntimeConfig();
  const baseUrl = config.public.apiBase;

  async function get<T>(path: string): Promise<T> {
    return await $fetch<T>(`${baseUrl}/api${path}`);
  }

  async function post<T>(path: string, body?: unknown): Promise<T> {
    return await $fetch<T>(`${baseUrl}/api${path}`, { method: 'POST', body });
  }

  async function patch<T>(path: string, body: unknown): Promise<T> {
    return await $fetch<T>(`${baseUrl}/api${path}`, { method: 'PATCH', body });
  }

  async function del<T>(path: string): Promise<T> {
    return await $fetch<T>(`${baseUrl}/api${path}`, { method: 'DELETE' });
  }

  return { get, post, patch, del, baseUrl };
}
