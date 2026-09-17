import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Customer CSV uploads go through a Server Action; the 1MB default is too tight.
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
};

export default nextConfig;
