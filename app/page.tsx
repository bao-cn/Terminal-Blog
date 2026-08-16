import TerminalBlog from "@/components/TerminalBlog";
import { categories, seedArticles } from "@/lib/blog-data";
import { mergeSiteConfig } from "@/lib/site-config";
import siteConfigValue from "@/config/site.config.json";

export default function Home() {
  const demoArticles = seedArticles.map((article) => ({
    ...article,
    sourcePath: `articles/${article.category}/${article.id}.md`,
  }));
  return (
    <TerminalBlog
      initialArticles={demoArticles}
      initialCategories={categories.map((category) => category.slug)}
      initialConfig={mergeSiteConfig(siteConfigValue)}
      sourceAddress="demo.static.host"
    />
  );
}
