/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Server Component BQ fetches can take a moment; raise the inline timeout.
  },
};
module.exports = nextConfig;
