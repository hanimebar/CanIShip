import type { NextConfig } from 'next'
import path from 'path'

// Packages that are ESM-only or have native deps and cannot be bundled by webpack
// They must be loaded at runtime via require()/import() in the worker process
const RUNTIME_ONLY_PACKAGES = [
  'lighthouse',
  'chrome-launcher',
  '@paulirish/trace_engine',
  'playwright',
  'playwright-core',
  '@playwright/test',
  '@axe-core/playwright',
  'bullmq',
  'ioredis',
]

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: RUNTIME_ONLY_PACKAGES,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
        perf_hooks: false,
        async_hooks: false,
      }
    }

    // Use IgnorePlugin to completely prevent webpack from processing these packages
    config.plugins = config.plugins || []
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^(lighthouse|chrome-launcher|@paulirish\/trace_engine|@axe-core\/playwright)$/,
      })
    )

    // Also use resolve.alias to stub them for any remaining references
    const stubPath = path.resolve(__dirname, 'lib/stubs/empty-stub.js')
    const aliases: Record<string, string> = {}
    for (const pkg of RUNTIME_ONLY_PACKAGES) {
      aliases[pkg] = stubPath
    }
    config.resolve.alias = {
      ...config.resolve.alias,
      ...aliases,
    }

    return config
  },
}

export default nextConfig
