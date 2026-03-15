interface GroupingSuggestion {
  id: number;
  sourceType: string;
  sourceId: number | null;
  sourceName: string;
  targetSeriesId: number | null;
  targetSeriesName: string;
  similarityScore: number;
  suggestedAction: string;
  suggestedSeasonName: string | null;
  status: string;
  createdAt: string;
}

export function useGrouping() {
  const { get, post } = useApi();
  const suggestions = ref<GroupingSuggestion[]>([]);
  const loading = ref(false);

  async function fetchSuggestions() {
    loading.value = true;
    try {
      suggestions.value = await get<GroupingSuggestion[]>('/grouping/suggestions');
    } finally {
      loading.value = false;
    }
  }

  async function acceptSuggestion(id: number) {
    await post(`/grouping/suggestions/${id}/accept`);
    await fetchSuggestions();
  }

  async function rejectSuggestion(id: number) {
    await post(`/grouping/suggestions/${id}/reject`);
    await fetchSuggestions();
  }

  return { suggestions, loading, fetchSuggestions, acceptSuggestion, rejectSuggestion };
}
