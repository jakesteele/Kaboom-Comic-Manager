<script setup lang="ts">
const { baseUrl } = useApi();
const { seriesList, fetchAll: fetchSeries } = useSeries();
const { directories, fetchDirectories } = useLibrary();
const { suggestions, fetchSuggestions } = useGrouping();

onMounted(async () => {
  await Promise.all([fetchSeries(), fetchDirectories(), fetchSuggestions()]);
});

const totalVolumes = computed(() =>
  seriesList.value.reduce((sum, s) => sum + (s.volumeCount || 0), 0)
);

const opdsUrl = computed(() => `${baseUrl}/opds`);
const copied = ref(false);

async function copyUrl() {
  await navigator.clipboard.writeText(opdsUrl.value);
  copied.value = true;
  setTimeout(() => (copied.value = false), 2000);
}
</script>

<template>
  <div class="space-y-8">
    <div>
      <h2 class="text-2xl font-bold mb-2">Dashboard</h2>
      <p class="text-gray-500">Kaboom Comic Manager overview</p>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <UCard>
        <div class="text-center">
          <p class="text-3xl font-bold">{{ seriesList.length }}</p>
          <p class="text-sm text-gray-500">Series</p>
        </div>
      </UCard>
      <UCard>
        <div class="text-center">
          <p class="text-3xl font-bold">{{ totalVolumes }}</p>
          <p class="text-sm text-gray-500">Volumes</p>
        </div>
      </UCard>
      <UCard>
        <div class="text-center">
          <p class="text-3xl font-bold">{{ directories.length }}</p>
          <p class="text-sm text-gray-500">Watch Directories</p>
        </div>
      </UCard>
      <UCard>
        <div class="text-center">
          <p class="text-3xl font-bold text-amber-500">{{ suggestions.length }}</p>
          <p class="text-sm text-gray-500">Pending Suggestions</p>
        </div>
      </UCard>
    </div>

    <!-- OPDS URL -->
    <UCard>
      <template #header>
        <h3 class="font-semibold">OPDS Catalog URL</h3>
      </template>
      <div class="flex items-center gap-2">
        <UInput :model-value="opdsUrl" readonly class="flex-1" />
        <UButton :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'" @click="copyUrl" variant="outline">
          {{ copied ? 'Copied!' : 'Copy' }}
        </UButton>
      </div>
      <p class="mt-2 text-sm text-gray-500">
        Add this URL in iPad Panels app under Library > Connect Service > OPDS
      </p>
    </UCard>

    <!-- Quick actions -->
    <div class="flex gap-4">
      <UButton to="/library" icon="i-lucide-folder-plus" variant="outline">
        Manage Library
      </UButton>
      <UButton to="/series" icon="i-lucide-book-open" variant="outline">
        Browse Series
      </UButton>
      <UButton v-if="suggestions.length > 0" to="/grouping" icon="i-lucide-git-merge" color="amber">
        Review {{ suggestions.length }} Grouping Suggestions
      </UButton>
    </div>
  </div>
</template>
