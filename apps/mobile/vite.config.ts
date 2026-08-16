import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  if (mode === 'production' && env.VITE_COMMISSIONING_MODE === 'mock') {
    throw new Error('Mock commissioning is forbidden in production builds')
  }
  return {
    plugins: [vue()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: {
      port: 5174,
      proxy: env.VITE_API_PROXY ? { '/api': { target: env.VITE_API_PROXY, changeOrigin: true } } : undefined,
    },
  }
})
