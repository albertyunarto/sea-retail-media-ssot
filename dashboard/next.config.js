const path = require("node:path");

/**
 * Explicit webpack alias for `@/*` so the build doesn't depend on tsconfig
 * paths. (Vercel will reach for tsconfig first, but if an older commit gets
 * deployed without it — e.g. from a partial merge — this fallback keeps the
 * build green.)
 *
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@": path.resolve(__dirname),
    };
    return config;
  },
};
module.exports = nextConfig;
