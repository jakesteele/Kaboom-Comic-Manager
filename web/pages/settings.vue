<script setup lang="ts">
const route = useRoute();

const navItems = [
  { label: 'General', to: '/settings', icon: 'i-lucide-settings' },
  { label: 'Tags', to: '/settings/tags', icon: 'i-lucide-tag' },
];

function isActive(to: string) {
  if (to === '/settings') return route.path === '/settings';
  return route.path.startsWith(to);
}
</script>

<template>
  <div class="space-y-6 max-w-2xl">
    <div>
      <h2 class="text-2xl font-bold">Settings</h2>
      <p class="text-gray-500">Server configuration and tags</p>
    </div>

    <!-- Sub-navigation -->
    <div class="flex gap-1 border-b border-gray-200 dark:border-gray-800">
      <NuxtLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors"
        :class="isActive(item.to)
          ? 'border-primary-500 text-primary-600 dark:text-primary-400'
          : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'"
      >
        <UIcon :name="item.icon" class="w-4 h-4" />
        {{ item.label }}
      </NuxtLink>
    </div>

    <NuxtPage />
  </div>
</template>
