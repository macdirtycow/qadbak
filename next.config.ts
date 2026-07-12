import type { NextConfig } from "next";

const installSalt = process.env.QADBAK_INSTALL_SALT?.trim() ?? "";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Enabled in Next 15.5+ — types may lag behind runtime.
    nodeMiddleware: true,
  } as NextConfig["experimental"],
  async rewrites() {
    if (!installSalt) return [];
    return [
      {
        source: `/api/x/${installSalt}/:path*`,
        destination: "/api/:path*",
      },
    ];
  },
};

export default nextConfig;
