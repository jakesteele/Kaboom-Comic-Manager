<script setup lang="ts">
import draggable from 'vuedraggable'

const route = useRoute();
const { baseUrl } = useApi();
const { isAdmin } = useAuth();
const {
  currentSeries, loading, fetchOne, updateSeries,
  createSeason, updateSeason, deleteSeason,
  moveVolume, reorderVolumes,
  seriesList, fetchAll, promoteSeason, moveSeason,
} = useSeries();
const { tags: allTags, fetchTags, createTag, addTagToSeries, removeTagFromSeries, getSeriesTags } = useTags();

const seriesId = computed(() => Number(route.params.id));

// Inline editing state
const editingName = ref(false);
const editName = ref('');
const editingSeasonId = ref<number | null>(null);
const editSeasonName = ref('');

// Accordion state for collapsible seasons
const collapsedSeasons = ref(new Set<number>());

function toggleSeason(seasonId: number) {
  if (collapsedSeasons.value.has(seasonId)) {
    collapsedSeasons.value.delete(seasonId);
  } else {
    collapsedSeasons.value.add(seasonId);
  }
  collapsedSeasons.value = new Set(collapsedSeasons.value);
}

// Modals
const showAddSeason = ref(false);
const newSeasonName = ref('');
const showMoveSeasonModal = ref(false);
const moveSeasonId = ref<number | null>(null);
const moveTargetSeriesId = ref<number | null>(null);
const moveSeriesSearch = ref('');

// Tags state
const seriesTags = ref<Array<{ id: number; name: string }>>([]);
const showTagPicker = ref(false);
const tagSearch = ref('');
const tagPickerPage = ref(0);
const TAG_PAGE_SIZE = 20;

// Local editable copy of seasons with volumes for drag-and-drop
const localSeasons = ref<Array<{
  id: number;
  name: string;
  sortOrder: number;
  volumes: Array<{
    id: number;
    seasonId: number;
    displayName: string;
    volumeNumber: number | null;
    year: number | null;
    fileSizeBytes: number;
    thumbnailPath: string | null;
    sortOrder: number;
    fileName: string;
  }>;
}>>([]);

// Sync from server data to local
watch(() => currentSeries.value, (val) => {
  if (val) {
    localSeasons.value = val.seasons.map(s => ({
      id: s.id,
      name: s.name,
      sortOrder: s.sortOrder,
      volumes: s.volumes.map(v => ({ ...v })),
    }));
  }
}, { deep: true });

const isSingleSeason = computed(() => localSeasons.value.length === 1);
const totalVolumes = computed(() => localSeasons.value.reduce((sum, s) => sum + s.volumes.length, 0));

// Filtered series for move-to dropdown (exclude current)
const filteredSeriesForMove = computed(() => {
  const q = moveSeriesSearch.value.toLowerCase();
  return seriesList.value
    .filter(s => s.id !== seriesId.value)
    .filter(s => !q || s.name.toLowerCase().includes(q));
});

// Available tags not yet assigned, filtered by search
const filteredAvailableTags = computed(() => {
  const assignedIds = new Set(seriesTags.value.map(t => t.id));
  const q = tagSearch.value.toLowerCase().trim();
  return allTags.value
    .filter(t => !assignedIds.has(t.id))
    .filter(t => !q || t.name.toLowerCase().includes(q));
});

const pagedAvailableTags = computed(() =>
  filteredAvailableTags.value.slice(0, (tagPickerPage.value + 1) * TAG_PAGE_SIZE)
);

const hasMoreTags = computed(() =>
  pagedAvailableTags.value.length < filteredAvailableTags.value.length
);

// Check if search term matches no existing tag exactly (for create option)
const canCreateTag = computed(() => {
  const q = tagSearch.value.trim();
  if (!q) return false;
  return !allTags.value.some(t => t.name.toLowerCase() === q.toLowerCase());
});

onMounted(async () => {
  await fetchOne(seriesId.value);
  await loadSeriesTags();
  await fetchTags();
});

async function loadSeriesTags() {
  seriesTags.value = await getSeriesTags(seriesId.value);
}

// Series name editing
function startEditName() {
  editName.value = currentSeries.value?.name || '';
  editingName.value = true;
  nextTick(() => {
    const input = document.querySelector('.series-name-input input') as HTMLInputElement;
    input?.focus();
    input?.select();
  });
}

async function saveName() {
  const name = editName.value.trim();
  if (name && currentSeries.value && name !== currentSeries.value.name) {
    await updateSeries(currentSeries.value.id, { name });
  }
  editingName.value = false;
}

// Season name editing
function startEditSeason(season: { id: number; name: string }) {
  editSeasonName.value = season.name;
  editingSeasonId.value = season.id;
  nextTick(() => {
    const input = document.querySelector('.season-name-input input') as HTMLInputElement;
    input?.focus();
    input?.select();
  });
}

async function saveSeasonName(seasonId: number) {
  const name = editSeasonName.value.trim();
  if (name) {
    await updateSeason(seasonId, { name });
    await fetchOne(seriesId.value);
  }
  editingSeasonId.value = null;
}

// Add season
async function handleAddSeason() {
  if (!newSeasonName.value.trim() || !currentSeries.value) return;
  await createSeason(currentSeries.value.id, newSeasonName.value.trim());
  newSeasonName.value = '';
  showAddSeason.value = false;
  await fetchOne(seriesId.value);
}

// Delete season
async function handleDeleteSeason(seasonId: number) {
  const season = localSeasons.value.find(s => s.id === seasonId);
  if (season && season.volumes.length > 0) {
    const target = localSeasons.value.find(s => s.id !== seasonId);
    if (target) {
      for (const vol of season.volumes) {
        await moveVolume(vol.id, target.id, vol.sortOrder + 1000);
      }
    }
  }
  await deleteSeason(seasonId);
  await fetchOne(seriesId.value);
}

// Flatten: merge all seasons into one
async function flattenSeries() {
  if (localSeasons.value.length <= 1) return;
  const target = localSeasons.value[0];
  let offset = target.volumes.length;

  for (let i = 1; i < localSeasons.value.length; i++) {
    const season = localSeasons.value[i];
    for (const vol of season.volumes) {
      await moveVolume(vol.id, target.id, offset++);
    }
    await deleteSeason(season.id);
  }
  await fetchOne(seriesId.value);
}

// Promote season to its own series
async function handlePromoteSeason(seasonId: number) {
  if (!currentSeries.value) return;
  const result = await promoteSeason(currentSeries.value.id, seasonId);
  navigateTo(`/series/${result.newSeriesId}`);
}

// Move season to different series
async function openMoveSeasonModal(seasonId: number) {
  moveSeasonId.value = seasonId;
  moveTargetSeriesId.value = null;
  moveSeriesSearch.value = '';
  await fetchAll();
  showMoveSeasonModal.value = true;
}

async function handleMoveSeason() {
  if (!moveSeasonId.value || !moveTargetSeriesId.value || !currentSeries.value) return;
  await moveSeason(currentSeries.value.id, moveSeasonId.value, moveTargetSeriesId.value);
  showMoveSeasonModal.value = false;
  // Refresh — if source series was deleted we go back to list
  try {
    await fetchOne(seriesId.value);
  } catch {
    navigateTo('/series');
  }
}

// Tag handlers
async function handleAddTag(tagId: number) {
  await addTagToSeries(tagId, seriesId.value);
  await loadSeriesTags();
  await fetchTags();
  tagSearch.value = '';
}

async function handleRemoveTag(tagId: number) {
  await removeTagFromSeries(tagId, seriesId.value);
  await loadSeriesTags();
  await fetchTags();
}

async function handleCreateAndAddTag() {
  const name = tagSearch.value.trim();
  if (!name) return;
  try {
    const newTag = await createTag(name);
    await addTagToSeries(newTag.id, seriesId.value);
    await loadSeriesTags();
    await fetchTags();
    tagSearch.value = '';
  } catch (e: any) {
    alert(e?.data?.error || 'Failed to create tag');
  }
}

function openTagPicker() {
  tagSearch.value = '';
  tagPickerPage.value = 0;
  showTagPicker.value = !showTagPicker.value;
}

// Drag and drop handler
async function onDragChange(seasonId: number, evt: any) {
  if (evt.added) {
    const vol = evt.added.element;
    await moveVolume(vol.id, seasonId, evt.added.newIndex);
  }

  const season = localSeasons.value.find(s => s.id === seasonId);
  if (season) {
    const updates = season.volumes.map((v, idx) => ({ id: v.id, sortOrder: idx }));
    if (updates.length > 0) {
      await reorderVolumes(updates);
    }
  }
}

function thumbnailUrl(volumeId: number) {
  return `${baseUrl}/thumbnails/${volumeId}.jpg`;
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}
</script>

<template>
  <div class="space-y-6">
    <!-- Back link -->
    <UButton to="/series" icon="i-lucide-arrow-left" variant="ghost" size="sm">
      All Series
    </UButton>

    <div v-if="loading && !currentSeries" class="text-center py-16">
      <UIcon name="i-lucide-loader-2" class="animate-spin w-8 h-8" />
    </div>

    <template v-else-if="currentSeries">
      <!-- Header -->
      <div class="flex items-start gap-4">
        <!-- Thumbnail -->
        <div class="w-20 h-28 bg-gray-200 dark:bg-gray-800 rounded-lg overflow-hidden flex-shrink-0 shadow-sm">
          <img
            v-if="currentSeries.thumbnailPath"
            :src="thumbnailUrl(currentSeries.seasons[0]?.volumes[0]?.id || 0)"
            class="w-full h-full object-cover"
          />
          <div v-else class="flex items-center justify-center h-full">
            <UIcon name="i-lucide-book-open" class="w-8 h-8 text-gray-400" />
          </div>
        </div>

        <div class="flex-1 min-w-0">
          <!-- Editable series name -->
          <div v-if="editingName" class="flex items-center gap-2">
            <UInput
              v-model="editName"
              class="series-name-input text-2xl font-bold flex-1"
              @keyup.enter="saveName"
              @keyup.escape="editingName = false"
            />
            <UButton icon="i-lucide-check" @click="saveName" size="sm" color="primary" />
            <UButton icon="i-lucide-x" @click="editingName = false" variant="ghost" size="sm" />
          </div>
          <h2
            v-else
            class="text-2xl font-bold cursor-pointer hover:text-primary transition-colors inline-flex items-center gap-2"
            @click="startEditName"
          >
            {{ currentSeries.name }}
            <UIcon name="i-lucide-pencil" class="w-4 h-4 opacity-30" />
          </h2>

          <p class="text-sm text-gray-500 mt-1">
            {{ totalVolumes }} {{ totalVolumes === 1 ? 'volume' : 'volumes' }}
            <span v-if="!isSingleSeason"> across {{ localSeasons.length }} seasons</span>
          </p>

          <!-- Tags -->
          <div class="flex flex-wrap items-center gap-1.5 mt-2">
            <UBadge
              v-for="tag in seriesTags"
              :key="tag.id"
              variant="subtle"
              size="sm"
              class="gap-1"
            >
              {{ tag.name }}
              <UIcon
                v-if="isAdmin"
                name="i-lucide-x"
                class="w-3 h-3 cursor-pointer opacity-50 hover:opacity-100"
                @click="handleRemoveTag(tag.id)"
              />
            </UBadge>
            <UButton
              v-if="isAdmin"
              icon="i-lucide-tag"
              size="xs"
              variant="ghost"
              @click="openTagPicker"
              title="Add tag"
            />
          </div>

          <!-- Tag picker dropdown -->
          <div v-if="showTagPicker" class="mt-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg max-w-xs">
            <div class="p-2 border-b border-gray-200 dark:border-gray-800">
              <UInput
                v-model="tagSearch"
                placeholder="Search or create tag..."
                icon="i-lucide-search"
                size="sm"
                autofocus
                @keyup.enter="canCreateTag ? handleCreateAndAddTag() : null"
                @keyup.escape="showTagPicker = false"
              />
            </div>
            <div class="max-h-48 overflow-y-auto">
              <div
                v-for="tag in pagedAvailableTags"
                :key="tag.id"
                class="px-3 py-1.5 text-sm rounded-md mx-1 my-0.5 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                @click="handleAddTag(tag.id)"
              >
                {{ tag.name }}
              </div>
              <div
                v-if="hasMoreTags"
                class="px-3 py-1.5 text-xs text-primary-500 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 text-center"
                @click="tagPickerPage++"
              >
                Show more...
              </div>
              <div v-if="filteredAvailableTags.length === 0 && !canCreateTag" class="px-3 py-3 text-xs text-gray-400 text-center">
                No matching tags
              </div>
            </div>
            <div
              v-if="canCreateTag && isAdmin"
              class="border-t border-gray-200 dark:border-gray-800 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400"
              @click="handleCreateAndAddTag"
            >
              <UIcon name="i-lucide-plus" class="w-4 h-4" />
              Create "{{ tagSearch.trim() }}"
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex gap-2 flex-shrink-0">
          <UButton
            v-if="!isSingleSeason"
            icon="i-lucide-layers"
            variant="outline"
            size="sm"
            title="Remove season groupings and put all volumes into one list"
            @click="flattenSeries"
          >
            Flatten
          </UButton>
          <UButton
            icon="i-lucide-plus"
            variant="outline"
            size="sm"
            title="Create a new collection to organize volumes into"
            @click="showAddSeason = true"
          >
            Add Season
          </UButton>
        </div>
      </div>

      <!-- Single Season: flat volume list -->
      <template v-if="isSingleSeason">
        <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <draggable
            v-model="localSeasons[0].volumes"
            item-key="id"
            handle=".drag-handle"
            animation="200"
            ghost-class="opacity-30"
            @change="(evt: any) => onDragChange(localSeasons[0].id, evt)"
          >
            <template #item="{ element: vol }">
              <div class="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <div class="drag-handle cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 p-1">
                  <UIcon name="i-lucide-grip-vertical" class="w-4 h-4" />
                </div>

                <div class="w-10 h-14 bg-gray-200 dark:bg-gray-800 rounded overflow-hidden flex-shrink-0">
                  <img
                    v-if="vol.thumbnailPath"
                    :src="thumbnailUrl(vol.id)"
                    class="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>

                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium truncate">{{ vol.displayName }}</p>
                  <p class="text-xs text-gray-500 truncate">
                    {{ formatSize(vol.fileSizeBytes) }}
                    <span v-if="vol.year"> &middot; {{ vol.year }}</span>
                  </p>
                </div>

                <UBadge v-if="vol.volumeNumber !== null" variant="subtle" size="sm">
                  Vol. {{ vol.volumeNumber }}
                </UBadge>
              </div>
            </template>
          </draggable>
        </div>
      </template>

      <!-- Multi Season: grouped sections -->
      <template v-else>
        <div class="space-y-4">
          <div
            v-for="season in localSeasons"
            :key="season.id"
            class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden"
          >
            <!-- Season header -->
            <div
              class="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800/50 cursor-pointer select-none"
              :class="{ 'border-b border-gray-200 dark:border-gray-800': !collapsedSeasons.has(season.id) }"
              @click="toggleSeason(season.id)"
            >
              <UIcon
                :name="collapsedSeasons.has(season.id) ? 'i-lucide-chevron-right' : 'i-lucide-chevron-down'"
                class="w-4 h-4 text-gray-400 transition-transform flex-shrink-0"
              />

              <div v-if="editingSeasonId === season.id" class="flex items-center gap-2 flex-1" @click.stop>
                <UInput
                  v-model="editSeasonName"
                  class="season-name-input flex-1"
                  size="sm"
                  @keyup.enter="saveSeasonName(season.id)"
                  @keyup.escape="editingSeasonId = null"
                />
                <UButton icon="i-lucide-check" size="xs" @click="saveSeasonName(season.id)" />
                <UButton icon="i-lucide-x" size="xs" variant="ghost" @click="editingSeasonId = null" />
              </div>
              <h3
                v-else
                class="font-semibold flex-1 inline-flex items-center gap-1"
                @click.stop="startEditSeason(season)"
              >
                <span class="hover:text-primary transition-colors cursor-pointer">{{ season.name }}</span>
                <UIcon name="i-lucide-pencil" class="w-3 h-3 opacity-30" />
              </h3>

              <UBadge variant="subtle" size="sm">{{ season.volumes.length }} vols</UBadge>

              <!-- Season actions -->
              <div class="flex items-center gap-1" @click.stop>
                <UButton
                  icon="i-lucide-arrow-up-right"
                  size="xs"
                  variant="ghost"
                  title="Promote to its own series"
                  @click="handlePromoteSeason(season.id)"
                />
                <UButton
                  icon="i-lucide-move"
                  size="xs"
                  variant="ghost"
                  title="Move to another series"
                  @click="openMoveSeasonModal(season.id)"
                />
                <UButton
                  icon="i-lucide-trash-2"
                  size="xs"
                  variant="ghost"
                  color="error"
                  @click="handleDeleteSeason(season.id)"
                />
              </div>
            </div>

            <!-- Volumes -->
            <div v-show="!collapsedSeasons.has(season.id)">
              <draggable
                v-model="season.volumes"
                item-key="id"
                group="volumes"
                handle=".drag-handle"
                animation="200"
                ghost-class="opacity-30"
                @change="(evt: any) => onDragChange(season.id, evt)"
              >
                <template #item="{ element: vol }">
                  <div class="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <div class="drag-handle cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 p-1">
                      <UIcon name="i-lucide-grip-vertical" class="w-4 h-4" />
                    </div>

                    <div class="w-10 h-14 bg-gray-200 dark:bg-gray-800 rounded overflow-hidden flex-shrink-0">
                      <img
                        v-if="vol.thumbnailPath"
                        :src="thumbnailUrl(vol.id)"
                        class="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>

                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium truncate">{{ vol.displayName }}</p>
                      <p class="text-xs text-gray-500 truncate">
                        {{ formatSize(vol.fileSizeBytes) }}
                        <span v-if="vol.year"> &middot; {{ vol.year }}</span>
                      </p>
                    </div>

                    <UBadge v-if="vol.volumeNumber !== null" variant="subtle" size="sm">
                      Vol. {{ vol.volumeNumber }}
                    </UBadge>
                  </div>
                </template>
              </draggable>

              <div v-if="season.volumes.length === 0" class="text-center py-8 text-gray-400 text-sm">
                Drag volumes here or delete this empty season
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- Add Season Modal -->
      <UModal v-model:open="showAddSeason">
        <template #header>
          <h3 class="font-semibold">Add Season</h3>
        </template>
        <template #body>
          <UFormField label="Season Name">
            <UInput
              v-model="newSeasonName"
              placeholder="e.g. Season 2, Zero, Main"
              @keyup.enter="handleAddSeason"
            />
          </UFormField>
        </template>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" @click="showAddSeason = false">Cancel</UButton>
            <UButton @click="handleAddSeason" :disabled="!newSeasonName.trim()">Create</UButton>
          </div>
        </template>
      </UModal>

      <!-- Move Season Modal -->
      <UModal v-model:open="showMoveSeasonModal">
        <template #header>
          <h3 class="font-semibold">Move Season to Another Series</h3>
        </template>
        <template #body>
          <div class="space-y-4">
            <UInput
              v-model="moveSeriesSearch"
              placeholder="Search series..."
              icon="i-lucide-search"
            />
            <div class="max-h-64 overflow-y-auto space-y-1">
              <div
                v-for="s in filteredSeriesForMove"
                :key="s.id"
                class="px-3 py-2 rounded-lg cursor-pointer text-sm flex items-center justify-between"
                :class="moveTargetSeriesId === s.id ? 'bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary' : 'hover:bg-gray-100 dark:hover:bg-gray-800'"
                @click="moveTargetSeriesId = s.id"
              >
                <span>{{ s.name }}</span>
                <span class="text-xs text-gray-400">{{ s.volumeCount }} vols</span>
              </div>
              <div v-if="filteredSeriesForMove.length === 0" class="text-center py-4 text-gray-400 text-sm">
                No matching series found
              </div>
            </div>
          </div>
        </template>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" @click="showMoveSeasonModal = false">Cancel</UButton>
            <UButton @click="handleMoveSeason" :disabled="!moveTargetSeriesId">Move</UButton>
          </div>
        </template>
      </UModal>
    </template>
  </div>
</template>
