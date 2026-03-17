<script setup lang="ts">
const { directories, loading, fetchDirectories, addDirectory, removeDirectory, triggerScan, triggerScanAll } = useLibrary();

const showAddModal = ref(false);
const newPath = ref('');
const scanning = ref<number | null>(null);

onMounted(fetchDirectories);

async function handleAdd() {
  if (!newPath.value.trim()) return;
  try {
    const dir = await addDirectory(newPath.value.trim());
    newPath.value = '';
    showAddModal.value = false;
    // Auto-scan the newly added directory
    handleScan(dir.id);
  } catch (e: any) {
    alert(e?.data?.error || 'Failed to add directory');
  }
}

async function handleScan(id: number) {
  scanning.value = id;
  try {
    await triggerScan(id);
    // Poll for completion
    setTimeout(async () => {
      await fetchDirectories();
      scanning.value = null;
    }, 2000);
  } catch {
    scanning.value = null;
  }
}

async function handleScanAll() {
  scanning.value = -1;
  try {
    await triggerScanAll();
    setTimeout(async () => {
      await fetchDirectories();
      scanning.value = null;
    }, 3000);
  } catch {
    scanning.value = null;
  }
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleString();
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold">Library</h2>
        <p class="text-gray-500">Manage watch directories for CBZ files</p>
      </div>
      <div class="flex gap-2">
        <UButton icon="i-lucide-refresh-cw" @click="handleScanAll" :loading="scanning === -1" variant="outline">
          Scan All
        </UButton>
        <UButton icon="i-lucide-folder-plus" @click="showAddModal = true">
          Add Directory
        </UButton>
      </div>
    </div>

    <!-- Directories table -->
    <UCard>
      <div v-if="loading" class="text-center py-8">
        <UIcon name="i-lucide-loader-2" class="animate-spin w-6 h-6" />
      </div>
      <div v-else-if="directories.length === 0" class="text-center py-8 text-gray-500">
        No watch directories configured. Add a directory to get started.
      </div>
      <div v-else class="divide-y divide-gray-200 dark:divide-gray-800">
        <div v-for="dir in directories" :key="dir.id" class="flex items-center justify-between py-4 px-2">
          <div class="flex-1 min-w-0">
            <p class="font-mono text-sm truncate">{{ dir.path }}</p>
            <div class="flex gap-4 mt-1 text-sm text-gray-500">
              <span>{{ dir.fileCount }} files</span>
              <span>Last scan: {{ formatDate(dir.lastScanAt) }}</span>
            </div>
          </div>
          <div class="flex items-center gap-2 ml-4">
            <UBadge :color="dir.enabled ? 'green' : 'gray'" variant="subtle">
              {{ dir.enabled ? 'Active' : 'Disabled' }}
            </UBadge>
            <UButton
              icon="i-lucide-scan"
              size="sm"
              variant="ghost"
              :loading="scanning === dir.id"
              @click="handleScan(dir.id)"
            />
            <UButton
              icon="i-lucide-trash-2"
              size="sm"
              variant="ghost"
              color="red"
              @click="removeDirectory(dir.id)"
            />
          </div>
        </div>
      </div>
    </UCard>

    <!-- Add Directory Modal -->
    <UModal v-model:open="showAddModal">
      <template #header>
        <h3 class="font-semibold">Add Watch Directory</h3>
      </template>
      <template #body>
        <div class="space-y-4">
          <UFormField label="Directory Path">
            <UInput v-model="newPath" placeholder="/manga" class="font-mono" />
          </UFormField>
          <p class="text-sm text-gray-500">
            Enter the absolute path to a directory containing CBZ files.
            The directory will be scanned recursively.
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="showAddModal = false">Cancel</UButton>
          <UButton @click="handleAdd" :disabled="!newPath.trim()">Add & Scan</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
