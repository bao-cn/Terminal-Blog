import "./globals.css";
import { formatSiteTitle, mergeSiteConfig } from "@/lib/site-config";
import siteConfigValue from "@/config/site.config.json";
import type { Metadata } from "next";
import type { ReactNode } from "react";

const siteConfig = mergeSiteConfig(siteConfigValue);

export const metadata: Metadata = {
  title: formatSiteTitle(siteConfig),
  description: siteConfig.description,
  icons: { icon: siteConfig.favicon },
};

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
