<script setup lang="ts">
const { baseUrl } = useApi();
const opdsUrl = computed(() => `${baseUrl}/opds`);
const copied = ref(false);

function copyUrl() {
  navigator.clipboard.writeText(opdsUrl.value);
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 2000);
}
</script>

<template>
  <div class="space-y-6 max-w-2xl">
    <div>
      <h2 class="text-2xl font-bold">Settings</h2>
      <p class="text-gray-500">Server information</p>
    </div>

    <!-- OPDS Catalog URL -->
    <UCard>
      <template #header>
        <h3 class="font-semibold">OPDS Catalog URL</h3>
      </template>
      <p class="text-sm text-gray-500 mb-3">
        Add this URL in your OPDS reader (e.g. Panels on iPad) under Library &gt; Connect Service &gt; OPDS.
      </p>
      <div class="flex items-center gap-2">
        <UInput :model-value="opdsUrl" readonly class="flex-1 font-mono" />
        <UButton
          :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
          :label="copied ? 'Copied' : 'Copy'"
          variant="outline"
          @click="copyUrl"
        />
      </div>
      <p class="text-xs text-gray-400 mt-2">
        For HTTPS, use a reverse proxy like Tailscale, Cloudflare Tunnel, or ngrok.
      </p>
    </UCard>
  </div>
</template>
