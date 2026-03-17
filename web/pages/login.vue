<script setup lang="ts">
definePageMeta({ layout: false });

const { isAuthenticated, setupRequired, checkSetupRequired, setup, login } = useAuth();

const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const error = ref('');
const loading = ref(false);
const isSetup = ref(false);

onMounted(async () => {
  if (isAuthenticated.value) {
    navigateTo('/');
    return;
  }
  try {
    const needsSetup = await checkSetupRequired();
    isSetup.value = needsSetup;
  } catch {
    // No users API available — proceed with login
  }
});

async function handleSubmit() {
  error.value = '';
  if (!email.value.trim() || !password.value) {
    error.value = 'Email and password are required';
    return;
  }

  if (isSetup.value) {
    if (password.value !== confirmPassword.value) {
      error.value = 'Passwords do not match';
      return;
    }
    if (password.value.length < 6) {
      error.value = 'Password must be at least 6 characters';
      return;
    }
  }

  loading.value = true;
  try {
    if (isSetup.value) {
      await setup(email.value.trim(), password.value);
    } else {
      await login(email.value.trim(), password.value);
    }
    navigateTo('/');
  } catch (e: any) {
    error.value = e?.data?.error || e?.message || 'Login failed';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <div class="flex items-center justify-center gap-2 mb-2">
          <UIcon name="i-lucide-zap" class="w-8 h-8 text-primary" />
          <h1 class="text-2xl font-bold">Kaboom</h1>
        </div>
        <p class="text-gray-500 text-sm">
          {{ isSetup ? 'Create your admin account to get started' : 'Sign in to your account' }}
        </p>
      </div>

      <UCard>
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <UFormField label="Email">
            <UInput
              v-model="email"
              type="email"
              placeholder="admin@example.com"
              autofocus
            />
          </UFormField>

          <UFormField label="Password">
            <UInput
              v-model="password"
              type="password"
              placeholder="Enter password"
            />
          </UFormField>

          <UFormField v-if="isSetup" label="Confirm Password">
            <UInput
              v-model="confirmPassword"
              type="password"
              placeholder="Confirm password"
            />
          </UFormField>

          <div v-if="error" class="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
            {{ error }}
          </div>

          <UButton type="submit" block :loading="loading">
            {{ isSetup ? 'Create Admin Account' : 'Sign In' }}
          </UButton>
        </form>
      </UCard>
    </div>
  </div>
</template>
