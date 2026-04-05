import type { NextConfig } from "next";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:5000";
const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  // Dev: không export (để rewrite hoạt động)
  // Build: export static để FastAPI serve
  ...(isDev ? {} : { output: "export" }),
  allowedDevOrigins: ["192.168.1.15"],
  // Rewrite /api/* → backend (chỉ hoạt động trong dev, bị ignore khi export)
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
