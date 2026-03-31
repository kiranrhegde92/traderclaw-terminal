/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3', 'pdf-parse', 'ws', 'bufferutil', 'utf-8-validate'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals ?? []), 'better-sqlite3', 'pdf-parse', 'ws', 'bufferutil', 'utf-8-validate']
    }
    return config
  },
}

export default nextConfig
