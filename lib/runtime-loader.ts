/**
 * Runtime module loader
 *
 * Uses Function() constructor to create a require that webpack's
 * static analysis cannot trace. This is the only safe way to load
 * ESM-only or native-binary packages (lighthouse, playwright) in
 * a Next.js API route without bundling them.
 *
 * These modules are loaded at runtime in the worker process only.
 * The Next.js build never needs them — only the Node.js worker does.
 */

// Create a require function that webpack cannot statically analyze
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const _require = typeof __non_webpack_require__ !== 'undefined'
  // In webpack bundle: use the non-webpack require
  ? __non_webpack_require__
  // In Node.js (worker process): use standard require
  : typeof require !== 'undefined'
  ? require
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  : new Function('id', 'return require(id)')

declare const __non_webpack_require__: NodeRequire | undefined

export function runtimeRequire(modulePath: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return _require(modulePath) as any
}
