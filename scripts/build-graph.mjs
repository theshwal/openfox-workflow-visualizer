import { build } from 'esbuild'

/**
 * Bundle the iframe entry (React + the vendored workflow-manager diagram) into
 * a single IIFE asset served by the plugin. The vendored sources are pinned to
 * an upstream SHA (see src/vendor/PROVENANCE.md).
 */
await build({
  entryPoints: ['src/graph-entry.tsx'],
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  outfile: 'assets/graph.js',
  minify: true,
  jsx: 'automatic',
  logLevel: 'info',
  define: { 'process.env.NODE_ENV': '"production"' },
})
