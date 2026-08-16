import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

const baseVersion = process.env.DEMO_BASE_VERSION || packageJson.version;

const nextConfig = {
  output: "export",
  trailingSlash: true,
  allowedDevOrigins: ["127.0.0.1", "192.168.1.3"],
  devIndicators: false,
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_TERMINAL_DEMO: "true",
    NEXT_PUBLIC_TERMINAL_DEMO_BASE_VERSION: baseVersion,
    NEXT_PUBLIC_TERMINAL_DEMO_BASE_REF: process.env.DEMO_BASE_REF || `v${baseVersion}`,
  },
};

export default nextConfig;
