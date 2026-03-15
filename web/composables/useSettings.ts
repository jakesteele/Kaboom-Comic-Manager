interface AppSettings {
  serverPort: number;
  authEnabled: boolean;
  authUsername: string;
  authPassword: string;
  paginationSize: number;
  thumbnailWidth: number;
  thumbnailHeight: number;
  thumbnailQuality: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  serverPort: 3000,
  authEnabled: false,
  authUsername: '',
  authPassword: '',
  paginationSize: 20,
  thumbnailWidth: 300,
  thumbnailHeight: 450,
  thumbnailQuality: 80,
};

export function useSettings() {
  const { get, patch } = useApi();
  const settings = ref<AppSettings>({ ...DEFAULT_SETTINGS });
  const loading = ref(false);

  async function fetchSettings() {
    loading.value = true;
    try {
      settings.value = await get<AppSettings>('/settings');
    } catch {
      settings.value = { ...DEFAULT_SETTINGS };
    } finally {
      loading.value = false;
    }
  }

  async function updateSettings(data: Partial<AppSettings>) {
    await patch('/settings', data);
    await fetchSettings();
  }

  return { settings, loading, fetchSettings, updateSettings };
}
