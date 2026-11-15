import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // The isolated native source checkout lives in .upstream/ and has its own
    // toolchain; never collect its tests from the plugin repo.
    exclude: ['node_modules/**', '.upstream/**', 'dist/**'],
  },
})
