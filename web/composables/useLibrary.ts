interface WatchDirectory {
  id: number;
  path: string;
  enabled: boolean;
  lastScanAt: string | null;
  fileCount: number;
  createdAt: string;
}

export function useLibrary() {
  const { get, post, del } = useApi();
  const directories = ref<WatchDirectory[]>([]);
  const loading = ref(false);

  async function fetchDirectories() {
    loading.value = true;
    try {
      directories.value = await get<WatchDirectory[]>('/library/directories');
    } finally {
      loading.value = false;
    }
  }

  async function addDirectory(path: string): Promise<WatchDirectory> {
    const dir = await post<WatchDirectory>('/library/directories', { path });
    await fetchDirectories();
    return dir;
  }

  async function removeDirectory(id: number) {
    await del(`/library/directories/${id}`);
    await fetchDirectories();
  }

  async function triggerScan(id: number) {
    await post(`/library/directories/${id}/scan`);
  }

  async function triggerScanAll() {
    await post('/library/scan-all');
  }

  return { directories, loading, fetchDirectories, addDirectory, removeDirectory, triggerScan, triggerScanAll };
}
