<script setup lang="ts">
const { isAdmin } = useAuth();

const allNavigation = [
  { label: 'Dashboard', icon: 'i-lucide-layout-dashboard', to: '/', adminOnly: false },
  { label: 'Library', icon: 'i-lucide-folder-open', to: '/library', adminOnly: true },
  { label: 'Series', icon: 'i-lucide-book-open', to: '/series', adminOnly: false },
  { label: 'Grouping', icon: 'i-lucide-git-merge', to: '/grouping', adminOnly: true },
  { label: 'Settings', icon: 'i-lucide-settings', to: '/settings', adminOnly: false },
];

const navigation = computed(() =>
  allNavigation.filter(item => !item.adminOnly || isAdmin.value)
);
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
    <header class="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-zap" class="w-6 h-6 text-primary" />
            <h1 class="text-lg font-bold">Kaboom Comic Manager</h1>
          </div>
          <nav class="flex items-center gap-1">
            <UButton
              v-for="item in navigation"
              :key="item.to"
              :to="item.to"
              :icon="item.icon"
              :label="item.label"
              variant="ghost"
              size="sm"
            />
          </nav>
        </div>
      </div>
    </header>
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <slot />
    </main>
  </div>
</template>
