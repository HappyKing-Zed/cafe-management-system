/** @type {import('next').NextConfig} */
const { browserApiBasePath, backendApiPrefix } = require('./api-paths.json');

const nextConfig = {
  allowedDevOrigins: process.env.REPLIT_DEV_DOMAIN ? [process.env.REPLIT_DEV_DOMAIN] : [],
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    return [
      {
        source: `${browserApiBasePath}/:path*`,
        destination: `${backendUrl}${backendApiPrefix}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
