<script setup lang="ts">
const { isAdmin } = useAuth();
const { tags, loading: tagsLoading, fetchTags, createTag, renameTag, deleteTag } = useTags();

const newTagName = ref('');
const editingTagId = ref<number | null>(null);
const editTagName = ref('');

onMounted(fetchTags);

async function handleCreateTag() {
  if (!newTagName.value.trim()) return;
  try {
    await createTag(newTagName.value.trim());
    newTagName.value = '';
    await fetchTags();
  } catch (e: any) {
    alert(e?.data?.error || 'Failed to create tag');
  }
}

function startEditTag(tag: { id: number; name: string }) {
  editingTagId.value = tag.id;
  editTagName.value = tag.name;
}

async function saveTagName(tagId: number) {
  if (!editTagName.value.trim()) return;
  try {
    await renameTag(tagId, editTagName.value.trim());
    editingTagId.value = null;
    await fetchTags();
  } catch (e: any) {
    alert(e?.data?.error || 'Failed to rename tag');
  }
}

async function handleDeleteTag(tagId: number) {
  if (!confirm('Delete this tag? It will be removed from all series.')) return;
  await deleteTag(tagId);
  await fetchTags();
}
</script>

<template>
  <div class="space-y-6">
    <UCard>
      <template #header>
        <h3 class="font-semibold">Tags</h3>
      </template>
      <div class="space-y-4">
        <p class="text-sm text-gray-500">Manage tags to organize your series. Tags with series assigned will appear in OPDS as "By Tags".</p>

        <!-- Add new tag -->
        <div v-if="isAdmin" class="flex items-center gap-2">
          <UInput
            v-model="newTagName"
            placeholder="New tag name..."
            class="flex-1"
            @keyup.enter="handleCreateTag"
          />
          <UButton icon="i-lucide-plus" @click="handleCreateTag" :disabled="!newTagName.trim()">Add</UButton>
        </div>

        <!-- Tags list -->
        <div v-if="tags.length === 0 && !tagsLoading" class="text-sm text-gray-400 py-4 text-center">
          No tags yet. Create one above.
        </div>
        <div v-else class="divide-y divide-gray-200 dark:divide-gray-800">
          <div v-for="tag in tags" :key="tag.id" class="flex items-center gap-3 py-2">
            <template v-if="editingTagId === tag.id">
              <UInput
                v-model="editTagName"
                class="flex-1"
                size="sm"
                @keyup.enter="saveTagName(tag.id)"
                @keyup.escape="editingTagId = null"
              />
              <UButton icon="i-lucide-check" size="xs" @click="saveTagName(tag.id)" />
              <UButton icon="i-lucide-x" size="xs" variant="ghost" @click="editingTagId = null" />
            </template>
            <template v-else>
              <UIcon name="i-lucide-tag" class="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span class="flex-1 text-sm">{{ tag.name }}</span>
              <UBadge variant="subtle" size="sm">{{ tag.seriesCount }} series</UBadge>
              <template v-if="isAdmin">
                <UButton icon="i-lucide-pencil" size="xs" variant="ghost" @click="startEditTag(tag)" />
                <UButton icon="i-lucide-trash-2" size="xs" variant="ghost" color="error" @click="handleDeleteTag(tag.id)" />
              </template>
            </template>
          </div>
        </div>
      </div>
    </UCard>
  </div>
</template>
