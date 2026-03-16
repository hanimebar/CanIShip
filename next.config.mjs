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
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Prevent clickjacking
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // Prevent MIME-type sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Enforce HTTPS for 1 year, include subdomains
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          // Control referrer information sent with requests
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Restrict browser feature access
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // Content Security Policy — allows Supabase, Stripe, Google/GitHub OAuth
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://accounts.google.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://accounts.google.com",
              "frame-src https://js.stripe.com https://accounts.google.com",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ]
  },
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
