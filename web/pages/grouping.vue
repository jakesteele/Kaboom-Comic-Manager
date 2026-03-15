<script setup lang="ts">
const { suggestions, loading, fetchSuggestions, acceptSuggestion, rejectSuggestion } = useGrouping();

onMounted(fetchSuggestions);

function actionLabel(action: string) {
  switch (action) {
    case 'add_as_season': return 'Add as Season';
    case 'merge_series': return 'Merge Series';
    default: return action;
  }
}

function scoreColor(score: number) {
  if (score >= 0.95) return 'green';
  if (score >= 0.9) return 'blue';
  return 'amber';
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-2xl font-bold">Grouping Suggestions</h2>
      <p class="text-gray-500">Review and resolve series grouping suggestions</p>
    </div>

    <div v-if="loading" class="text-center py-16">
      <UIcon name="i-lucide-loader-2" class="animate-spin w-8 h-8" />
    </div>

    <div v-else-if="suggestions.length === 0" class="text-center py-16">
      <UIcon name="i-lucide-check-circle" class="w-12 h-12 text-green-500 mx-auto mb-4" />
      <p class="text-gray-500">No pending grouping suggestions. All caught up!</p>
    </div>

    <div v-else class="space-y-4">
      <UCard v-for="suggestion in suggestions" :key="suggestion.id">
        <div class="flex items-start gap-4">
          <!-- Source -->
          <div class="flex-1 text-center">
            <p class="text-sm text-gray-500">Source</p>
            <p class="font-semibold text-lg">{{ suggestion.sourceName }}</p>
          </div>

          <!-- Arrow & Score -->
          <div class="flex flex-col items-center gap-1 pt-4">
            <UBadge :color="scoreColor(suggestion.similarityScore)" variant="subtle">
              {{ (suggestion.similarityScore * 100).toFixed(0) }}% match
            </UBadge>
            <UIcon name="i-lucide-arrow-right" class="w-6 h-6 text-gray-400" />
            <UBadge variant="outline">{{ actionLabel(suggestion.suggestedAction) }}</UBadge>
            <p v-if="suggestion.suggestedSeasonName" class="text-xs text-gray-500">
              as "{{ suggestion.suggestedSeasonName }}"
            </p>
          </div>

          <!-- Target -->
          <div class="flex-1 text-center">
            <p class="text-sm text-gray-500">Target</p>
            <p class="font-semibold text-lg">{{ suggestion.targetSeriesName }}</p>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex justify-center gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
          <UButton
            icon="i-lucide-check"
            color="green"
            @click="acceptSuggestion(suggestion.id)"
          >
            Accept
          </UButton>
          <UButton
            icon="i-lucide-x"
            color="red"
            variant="outline"
            @click="rejectSuggestion(suggestion.id)"
          >
            Reject
          </UButton>
        </div>
      </UCard>
    </div>
  </div>
</template>
