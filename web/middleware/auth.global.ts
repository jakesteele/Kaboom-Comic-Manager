export default defineNuxtRouteMiddleware(async (to) => {
  // Skip auth check on login page
  if (to.path === '/login') return;

  const { isAuthenticated, checkSetupRequired } = useAuth();

  // Check if setup is needed or auth is required
  try {
    const needsSetup = await checkSetupRequired();
    if (needsSetup) {
      return navigateTo('/login');
    }
  } catch {
    // If the API isn't available (e.g. no users table yet), allow access
    return;
  }

  // If users exist but we're not authenticated, redirect to login
  if (!isAuthenticated.value) {
    return navigateTo('/login');
  }
});
