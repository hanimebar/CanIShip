import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Packages that are ESM-only or have native deps and cannot be bundled by webpack
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

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
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

    config.plugins = config.plugins || []
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^(lighthouse|chrome-launcher|@paulirish\/trace_engine|@axe-core\/playwright)$/,
      })
    )

    const stubPath = path.resolve(__dirname, 'lib/stubs/empty-stub.js')
    const aliases = {}
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
