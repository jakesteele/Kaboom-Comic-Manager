<script setup lang="ts">
const serverHost = ref('');
const serverPort = ref('');
const opdsUrl = ref('');
const copied = ref(false);

onMounted(() => {
  const loc = window.location;
  serverHost.value = loc.hostname;
  serverPort.value = loc.port || (loc.protocol === 'https:' ? '443' : '80');
  opdsUrl.value = `${loc.protocol}//${loc.hostname}${loc.port ? ':' + loc.port : ''}/opds`;
});

function copyUrl() {
  navigator.clipboard.writeText(opdsUrl.value);
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 2000);
}

</script>

<template>
  <div class="space-y-6">
    <!-- Connection Info -->
    <UCard>
      <template #header>
        <h3 class="font-semibold">Connection Info</h3>
      </template>
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Host">
            <UInput :model-value="serverHost" readonly class="font-mono" />
          </UFormField>
          <UFormField label="Port">
            <UInput :model-value="serverPort" readonly class="font-mono" />
          </UFormField>
        </div>

        <UFormField label="OPDS Catalog URL">
          <div class="flex items-center gap-2">
            <UInput :model-value="opdsUrl" readonly class="flex-1 font-mono" />
            <UButton
              :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
              :label="copied ? 'Copied' : 'Copy'"
              variant="outline"
              @click="copyUrl"
            />
          </div>
        </UFormField>

        <p class="text-sm text-gray-500">
          Add the OPDS URL above in your reader app (e.g. Panels on iPad) under <strong>Library &gt; Connect Service &gt; OPDS</strong>.
        </p>
      </div>
    </UCard>

  </div>
</template>
