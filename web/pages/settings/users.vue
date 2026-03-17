<script setup lang="ts">
const { user, isAdmin } = useAuth();
const { usersList, loading: usersLoading, fetchUsers, createUser, updateUser, deleteUser } = useUsers();

const showAddUser = ref(false);
const newUserEmail = ref('');
const newUserPassword = ref('');
const newUserRole = ref('user');

onMounted(() => {
  if (isAdmin.value) fetchUsers();
});

async function handleCreateUser() {
  if (!newUserEmail.value.trim() || !newUserPassword.value) return;
  try {
    await createUser(newUserEmail.value.trim(), newUserPassword.value, newUserRole.value);
    newUserEmail.value = '';
    newUserPassword.value = '';
    newUserRole.value = 'user';
    showAddUser.value = false;
    await fetchUsers();
  } catch (e: any) {
    alert(e?.data?.error || 'Failed to create user');
  }
}

function isSelf(userId: number) {
  return userId === user.value?.id;
}

async function handleSetRole(userId: number, newRole: string) {
  try {
    await updateUser(userId, { role: newRole });
    await fetchUsers();
  } catch (e: any) {
    alert(e?.data?.error || 'Failed to update role');
  }
}

async function handleDeleteUser(userId: number) {
  if (!confirm('Delete this user?')) return;
  try {
    await deleteUser(userId);
    await fetchUsers();
  } catch (e: any) {
    alert(e?.data?.error || 'Failed to delete user');
  }
}
</script>

<template>
  <div class="space-y-6">
    <UCard v-if="isAdmin">
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="font-semibold">User Management</h3>
          <UButton icon="i-lucide-plus" size="sm" variant="outline" @click="showAddUser = true">Add User</UButton>
        </div>
      </template>
      <div class="space-y-2">
        <div v-if="usersList.length === 0 && !usersLoading" class="text-sm text-gray-400 py-4 text-center">
          No users found.
        </div>
        <div v-else class="divide-y divide-gray-200 dark:divide-gray-800">
          <div v-for="u in usersList" :key="u.id" class="flex items-center gap-3 py-3">
            <UIcon name="i-lucide-user" class="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span class="flex-1 text-sm font-medium">
              {{ u.email }}
              <span v-if="isSelf(u.id)" class="text-xs text-gray-400 ml-1">(you)</span>
            </span>
            <select
              :value="u.role"
              :disabled="isSelf(u.id)"
              class="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-xs font-medium"
              :class="isSelf(u.id) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'"
              @change="handleSetRole(u.id, ($event.target as HTMLSelectElement).value)"
            >
              <option value="admin">Admin</option>
              <option value="user">User</option>
            </select>
            <UButton
              v-if="!isSelf(u.id)"
              icon="i-lucide-trash-2"
              size="xs"
              variant="ghost"
              color="error"
              @click="handleDeleteUser(u.id)"
            />
          </div>
        </div>
      </div>
    </UCard>

    <div v-else class="text-center py-8 text-gray-500">
      You do not have permission to manage users.
    </div>

    <!-- Add User Modal -->
    <UModal v-model:open="showAddUser">
      <template #header>
        <h3 class="font-semibold">Add User</h3>
      </template>
      <template #body>
        <form @submit.prevent="handleCreateUser" class="space-y-4">
          <UFormField label="Email">
            <UInput v-model="newUserEmail" type="email" placeholder="user@example.com" />
          </UFormField>
          <UFormField label="Password">
            <UInput v-model="newUserPassword" type="password" placeholder="Min 6 characters" />
          </UFormField>
          <UFormField label="Role">
            <select v-model="newUserRole" class="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm">
              <option value="user">User (read-only)</option>
              <option value="admin">Admin (full access)</option>
            </select>
          </UFormField>
        </form>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="showAddUser = false">Cancel</UButton>
          <UButton @click="handleCreateUser" :disabled="!newUserEmail.trim() || !newUserPassword">Create User</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
