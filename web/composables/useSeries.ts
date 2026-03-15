interface SeriesSummary {
  id: number;
  name: string;
  sortTitle: string;
  thumbnailPath: string | null;
  seasonCount: number;
  volumeCount: number;
  updatedAt: string;
}

interface Volume {
  id: number;
  seasonId: number;
  filePath: string;
  fileName: string;
  displayName: string;
  volumeNumber: number | null;
  year: number | null;
  fileSizeBytes: number;
  thumbnailPath: string | null;
  sortOrder: number;
}

interface Season {
  id: number;
  seriesId: number;
  name: string;
  sortOrder: number;
  volumes: Volume[];
}

interface SeriesDetail {
  id: number;
  name: string;
  sortTitle: string;
  thumbnailPath: string | null;
  seasons: Season[];
}

export function useSeries() {
  const { get, patch, post } = useApi();
  const seriesList = ref<SeriesSummary[]>([]);
  const currentSeries = ref<SeriesDetail | null>(null);
  const loading = ref(false);

  async function fetchAll() {
    loading.value = true;
    try {
      seriesList.value = await get<SeriesSummary[]>('/series');
    } finally {
      loading.value = false;
    }
  }

  async function fetchOne(id: number) {
    loading.value = true;
    try {
      currentSeries.value = await get<SeriesDetail>(`/series/${id}`);
    } finally {
      loading.value = false;
    }
  }

  async function updateSeries(id: number, data: { name?: string; sortTitle?: string }) {
    await patch(`/series/${id}`, data);
    await fetchOne(id);
  }

  async function mergeSeries(targetId: number, sourceSeriesId: number) {
    await post(`/series/${targetId}/merge`, { sourceSeriesId });
    await fetchAll();
  }

  async function moveVolume(volumeId: number, targetSeasonId: number, sortOrder: number) {
    await post(`/volumes/${volumeId}/move`, { targetSeasonId, sortOrder });
  }

  async function reorderVolumes(updates: { id: number; sortOrder: number }[]) {
    await patch('/volumes/reorder', { updates });
  }

  async function createSeason(seriesId: number, name: string) {
    await post('/seasons', { seriesId, name });
  }

  async function updateSeason(seasonId: number, data: { name?: string; sortOrder?: number }) {
    await patch(`/seasons/${seasonId}`, data);
  }

  async function deleteSeason(seasonId: number) {
    const { del } = useApi();
    await del(`/seasons/${seasonId}`);
  }

  return {
    seriesList, currentSeries, loading,
    fetchAll, fetchOne, updateSeries, mergeSeries,
    moveVolume, reorderVolumes,
    createSeason, updateSeason, deleteSeason,
  };
}
