interface Tag {
  id: number;
  name: string;
  createdAt: string;
  seriesCount: number;
}

export function useTags() {
  const tags = ref<Tag[]>([]);
  const loading = ref(false);

  const { get, post, patch, del } = useApi();

  async function fetchTags() {
    loading.value = true;
    try {
      tags.value = await get<Tag[]>('/tags');
    } finally {
      loading.value = false;
    }
  }

  async function createTag(name: string) {
    return await post<Tag>('/tags', { name });
  }

  async function renameTag(id: number, name: string) {
    return await patch<Tag>(`/tags/${id}`, { name });
  }

  async function deleteTag(id: number) {
    await del(`/tags/${id}`);
  }

  async function addTagToSeries(tagId: number, seriesId: number) {
    await post(`/tags/${tagId}/series/${seriesId}`);
  }

  async function removeTagFromSeries(tagId: number, seriesId: number) {
    await del(`/tags/${tagId}/series/${seriesId}`);
  }

  async function getSeriesTags(seriesId: number): Promise<Tag[]> {
    return await get<Tag[]>(`/tags/series/${seriesId}`);
  }

  return {
    tags,
    loading,
    fetchTags,
    createTag,
    renameTag,
    deleteTag,
    addTagToSeries,
    removeTagFromSeries,
    getSeriesTags,
  };
}
