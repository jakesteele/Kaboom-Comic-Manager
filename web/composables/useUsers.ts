interface UserInfo {
  id: number;
  email: string;
  role: 'admin' | 'user';
  createdAt: string;
  updatedAt: string;
}

export function useUsers() {
  const usersList = ref<UserInfo[]>([]);
  const loading = ref(false);

  const { get, post, patch, del } = useApi();

  async function fetchUsers() {
    loading.value = true;
    try {
      usersList.value = await get<UserInfo[]>('/users');
    } finally {
      loading.value = false;
    }
  }

  async function createUser(email: string, password: string, role: string) {
    return await post<UserInfo>('/users', { email, password, role });
  }

  async function updateUser(id: number, data: { role?: string; password?: string }) {
    return await patch<UserInfo>(`/users/${id}`, data);
  }

  async function deleteUser(id: number) {
    await del(`/users/${id}`);
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    return await patch<{ message: string }>('/users/me/password', { currentPassword, newPassword });
  }

  return {
    usersList,
    loading,
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
    changePassword,
  };
}
