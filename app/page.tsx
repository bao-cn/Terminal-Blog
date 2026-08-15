import TerminalBlog from "@/components/TerminalBlog";
import { headers } from "next/headers";
import { loadArticleCategories, loadArticles } from "@/lib/article-store";
import { readSiteConfig } from "@/lib/site-config-server";
import { loadAccessFiles } from "@/lib/upload-store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const requestHeaders = await headers();
  const forwardedAddress =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip") || "public.gateway";
  const { config } = readSiteConfig();
  return (
    <TerminalBlog
      initialAccessFiles={loadAccessFiles()}
      initialArticles={loadArticles()}
      initialCategories={loadArticleCategories()}
      initialConfig={config}
      sourceAddress={forwardedAddress}
    />
  );
}
