// In deployed environments API_URL is the stable API domain
// (api.<domain>, fronted by CloudFront) so this build-time-baked value does
// not change when the Lambda Function URL is regenerated. Falls back to the
// local API dev server when unset.
const API_DEV_URL = process.env.API_URL ?? "http://localhost:3001";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@loppemarked/shared"],
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
  async rewrites() {
    return [
      { source: "/health", destination: `${API_DEV_URL}/health` },
      { source: "/public/:path*", destination: `${API_DEV_URL}/public/:path*` },
      { source: "/admin/:path*", destination: `${API_DEV_URL}/admin/:path*` },
    ];
  },
};

export default nextConfig;
