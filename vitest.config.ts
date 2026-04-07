import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    conditions: ['browser'],
    extensions: ['.ts', '.svelte', '.mjs', '.js', '.jsx', '.tsx', '.json'],
  },
  test: {
    environment: 'jsdom',
    include: ['frontend/**/*.test.ts'],
  },
})
