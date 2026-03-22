/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable Turbopack to avoid unicode path bug (GIÁOANS has unicode chars)
  experimental: {},
};

export default nextConfig;
