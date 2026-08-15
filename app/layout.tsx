import "./globals.css";
import { formatSiteTitle } from "@/lib/site-config";
import { readSiteConfig } from "@/lib/site-config-server";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { config } = readSiteConfig();
  return {
    title: formatSiteTitle(config),
    description: config.description,
    icons: { icon: config.favicon },
  };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <link
          rel="preload"
          href="/fonts/maple-mono/maple-mono-ascii.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
