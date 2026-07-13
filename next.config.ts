import type { NextConfig } from "next";

const installSalt = process.env.QADBAK_INSTALL_SALT?.trim() ?? "";

const nextConfig: NextConfig = {
  poweredByHeader: false,
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
