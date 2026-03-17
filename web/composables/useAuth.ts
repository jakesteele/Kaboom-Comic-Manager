interface AuthUser {
  id: number;
  email: string;
  role: 'admin' | 'user';
}

const token = ref<string | null>(null);
const user = ref<AuthUser | null>(null);
const setupRequired = ref<boolean | null>(null);

export function useAuth() {
  // Initialize from localStorage
  if (import.meta.client && token.value === null) {
    token.value = localStorage.getItem('kaboom_token');
    const stored = localStorage.getItem('kaboom_user');
    if (stored) {
      try { user.value = JSON.parse(stored); } catch { /* ignore */ }
    }
  }

  const isAuthenticated = computed(() => !!token.value);
  const isAdmin = computed(() => user.value?.role === 'admin');

  function setAuth(t: string, u: AuthUser) {
    token.value = t;
    user.value = u;
    if (import.meta.client) {
      localStorage.setItem('kaboom_token', t);
      localStorage.setItem('kaboom_user', JSON.stringify(u));
    }
  }

  function clearAuth() {
    token.value = null;
    user.value = null;
    if (import.meta.client) {
      localStorage.removeItem('kaboom_token');
      localStorage.removeItem('kaboom_user');
    }
  }

  async function checkSetupRequired(): Promise<boolean> {
    const config = useRuntimeConfig();
    const baseUrl = config.public.apiBase;
    const result = await $fetch<{ setupRequired: boolean }>(`${baseUrl}/api/users/setup-required`);
    setupRequired.value = result.setupRequired;
    return result.setupRequired;
  }

  async function setup(email: string, password: string) {
    const config = useRuntimeConfig();
    const baseUrl = config.public.apiBase;
    const result = await $fetch<{ user: AuthUser; token: string }>(`${baseUrl}/api/users/setup`, {
      method: 'POST',
      body: { email, password },
    });
    setAuth(result.token, result.user);
    setupRequired.value = false;
  }

  async function login(email: string, password: string) {
    const config = useRuntimeConfig();
    const baseUrl = config.public.apiBase;
    const result = await $fetch<{ user: AuthUser; token: string }>(`${baseUrl}/api/users/login`, {
      method: 'POST',
      body: { email, password },
    });
    setAuth(result.token, result.user);
  }

  function logout() {
    clearAuth();
    navigateTo('/login');
  }

  return {
    token,
    user,
    isAuthenticated,
    isAdmin,
    setupRequired,
    setAuth,
    clearAuth,
    checkSetupRequired,
    setup,
    login,
    logout,
  };
}
