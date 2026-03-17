<script setup lang="ts">
const { changePassword } = useUsers();

const serverHost = ref('');
const serverPort = ref('');
const opdsUrl = ref('');
const copied = ref(false);

const currentPassword = ref('');
const newPassword = ref('');
const confirmNewPassword = ref('');
const passwordMessage = ref('');
const passwordError = ref('');

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

async function handleChangePassword() {
  passwordMessage.value = '';
  passwordError.value = '';

  if (!currentPassword.value || !newPassword.value) {
    passwordError.value = 'All fields are required';
    return;
  }
  if (newPassword.value !== confirmNewPassword.value) {
    passwordError.value = 'New passwords do not match';
    return;
  }
  if (newPassword.value.length < 6) {
    passwordError.value = 'Password must be at least 6 characters';
    return;
  }

  try {
    await changePassword(currentPassword.value, newPassword.value);
    passwordMessage.value = 'Password updated successfully';
    currentPassword.value = '';
    newPassword.value = '';
    confirmNewPassword.value = '';
  } catch (e: any) {
    passwordError.value = e?.data?.error || 'Failed to change password';
  }
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

    <!-- Change Password -->
    <UCard>
      <template #header>
        <h3 class="font-semibold">Change Password</h3>
      </template>
      <form @submit.prevent="handleChangePassword" class="space-y-4">
        <UFormField label="Current Password">
          <UInput v-model="currentPassword" type="password" />
        </UFormField>
        <UFormField label="New Password">
          <UInput v-model="newPassword" type="password" />
        </UFormField>
        <UFormField label="Confirm New Password">
          <UInput v-model="confirmNewPassword" type="password" />
        </UFormField>

        <div v-if="passwordError" class="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
          {{ passwordError }}
        </div>
        <div v-if="passwordMessage" class="text-sm text-green-600 bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
          {{ passwordMessage }}
        </div>

        <UButton type="submit">Update Password</UButton>
      </form>
    </UCard>
  </div>
</template>
