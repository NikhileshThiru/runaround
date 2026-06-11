import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@api': fileURLToPath(new URL('./api', import.meta.url)),
    },
  },
  optimizeDeps: {
    // Pre-bundle the lazy globe's deep three imports up front so the dev
    // server never discovers them mid-session and serves a 504
    // "Outdated Optimize Dep" for the dynamically imported chunk.
    include: [
      'three',
      'three/examples/jsm/controls/OrbitControls.js',
      'three/examples/jsm/lines/Line2.js',
      'three/examples/jsm/lines/LineGeometry.js',
      'three/examples/jsm/lines/LineMaterial.js',
    ],
  },
  build: {
    // Three.js is isolated behind the lazy globe boundary; warn if that
    // renderer chunk grows materially beyond its current raw size.
    chunkSizeWarningLimit: 800,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
    coverage: {
      reporter: ['text', 'html'],
    },
  },
})
