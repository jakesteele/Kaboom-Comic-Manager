<script setup lang="ts">
const { baseUrl } = useApi();
const { seriesList, loading, fetchAll } = useSeries();

const search = ref('');
const sortBy = ref<'name' | 'updated' | 'volumes'>('name');

onMounted(fetchAll);

const filteredSeries = computed(() => {
  let list = [...seriesList.value];

  if (search.value) {
    const q = search.value.toLowerCase();
    list = list.filter(s => s.name.toLowerCase().includes(q));
  }

  switch (sortBy.value) {
    case 'name':
      list.sort((a, b) => a.sortTitle.localeCompare(b.sortTitle));
      break;
    case 'updated':
      list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      break;
    case 'volumes':
      list.sort((a, b) => b.volumeCount - a.volumeCount);
      break;
  }

  return list;
});

function thumbnailUrl(s: { id: number; thumbnailPath: string | null }) {
  if (!s.thumbnailPath) return '';
  const filename = s.thumbnailPath.split('/').pop();
  return `${baseUrl}/thumbnails/${filename}`;
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-2xl font-bold">Series</h2>
      <p class="text-gray-500">{{ seriesList.length }} series in your library</p>
    </div>

    <!-- Filters -->
    <div class="flex items-center gap-4">
      <UInput v-model="search" placeholder="Search series..." icon="i-lucide-search" class="flex-1 max-w-sm" />
      <USelect v-model="sortBy" class="min-w-[180px]" :items="[
        { label: 'Name', value: 'name' },
        { label: 'Recently Updated', value: 'updated' },
        { label: 'Volume Count', value: 'volumes' },
      ]" />
    </div>

    <!-- Grid -->
    <div v-if="loading" class="text-center py-16">
      <UIcon name="i-lucide-loader-2" class="animate-spin w-8 h-8" />
    </div>
    <div v-else-if="filteredSeries.length === 0" class="text-center py-16 text-gray-500">
      {{ search ? 'No series match your search.' : 'No series yet. Add a watch directory and scan.' }}
    </div>
    <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      <NuxtLink
        v-for="s in filteredSeries"
        :key="s.id"
        :to="`/series/${s.id}`"
        class="group h-full"
      >
        <UCard class="overflow-hidden hover:ring-2 hover:ring-primary transition-all h-full flex flex-col">
          <div class="aspect-[2/3] bg-gray-200 dark:bg-gray-800 relative">
            <img
              v-if="s.thumbnailPath"
              :src="thumbnailUrl(s)"
              :alt="s.name"
              class="w-full h-full object-cover"
            />
            <div v-else class="flex items-center justify-center h-full">
              <UIcon name="i-lucide-book-open" class="w-12 h-12 text-gray-400" />
            </div>
          </div>
          <div class="p-2 flex-1 flex flex-col">
            <p class="font-medium text-sm truncate">{{ s.name }}</p>
            <p class="text-xs text-gray-500">
              {{ s.seasonCount }} {{ s.seasonCount === 1 ? 'season' : 'seasons' }},
              {{ s.volumeCount }} {{ s.volumeCount === 1 ? 'vol' : 'vols' }}
            </p>
            <div v-if="s.tags?.length" class="flex flex-wrap gap-1 mt-auto pt-1">
              <UBadge v-for="tag in s.tags" :key="tag.id" size="xs" variant="subtle" color="neutral">
                {{ tag.name }}
              </UBadge>
            </div>
          </div>
        </UCard>
      </NuxtLink>
    </div>
  </div>
</template>
