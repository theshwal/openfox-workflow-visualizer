import { build } from 'esbuild'

/**
 * Bundle the plugin entry into ONE file.
 *
 * The host reloads a plugin by importing its entry with a cache-busting query
 * (`index.js?v=...`), but a relative import such as `./state.js` keeps the same
 * URL and therefore stays in Node's ESM cache — a reinstall would silently keep
 * running the old code. Bundling removes every relative import, so
 * disable → enable (or a reinstall) really loads the new code without a restart.
 */
await build({
  entryPoints: ['src/index.js'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: ['node20'],
  outfile: 'lib/index.js',
  logLevel: 'info',
})
