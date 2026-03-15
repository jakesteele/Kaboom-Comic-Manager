export default defineNuxtConfig({
  modules: ['@nuxt/ui'],
  ssr: false,
  devtools: { enabled: true },
  css: ['~/assets/main.css'],

  runtimeConfig: {
    public: {
      apiBase: process.env.API_BASE ?? '',
    },
  },

  compatibilityDate: '2025-03-14',
});
