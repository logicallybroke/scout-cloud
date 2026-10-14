import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Scout Cloud is an API; it never needs the "X-Powered-By" banner.
  poweredByHeader: false,
};

export default nextConfig;
