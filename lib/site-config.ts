export type SiteConfig = {
  blogName: string;
  contactEmail: string;
  description: string;
  titleTemplate: string;
  favicon: string;
  sourceFallback: string;
  filings: { icp: string; police: string };
  friendlyLinks: Array<{ label: string; href: string }>;
  cookieNotice: string;
};

export const defaultSiteConfig: SiteConfig = {
  blogName: "terminal.blog",
  contactEmail: "root@terminal.blog",
  description: "Field notes from the command line.",
  titleTemplate: "{BlogName} | {ArticleName}",
  favicon: "/favicon.svg",
  sourceFallback: "public.gateway",
  filings: {
    icp: "ICP备案号：待配置",
    police: "公安备案号：待配置",
  },
  friendlyLinks: [
    { label: "Maple Font", href: "https://github.com/subframe7536/Maple-font" },
    { label: "Next.js", href: "https://nextjs.org" },
    { label: "React", href: "https://react.dev" },
  ],
  cookieNotice: "本站使用本地存储保存语言、主题和终端偏好。",
};

export function mergeSiteConfig(value: unknown): SiteConfig {
  const candidate = value && typeof value === "object" && !Array.isArray(value) ? (value as Partial<SiteConfig>) : {};
  const filings: Partial<SiteConfig["filings"]> =
    candidate.filings && typeof candidate.filings === "object" ? candidate.filings : {};
  const friendlyLinks = Array.isArray(candidate.friendlyLinks)
    ? candidate.friendlyLinks.filter(
        (link): link is { label: string; href: string } =>
          Boolean(link) && typeof link === "object" && typeof link.label === "string" && typeof link.href === "string",
      )
    : [];
  return {
    blogName: typeof candidate.blogName === "string" ? candidate.blogName : defaultSiteConfig.blogName,
    contactEmail: typeof candidate.contactEmail === "string" ? candidate.contactEmail : defaultSiteConfig.contactEmail,
    description: typeof candidate.description === "string" ? candidate.description : defaultSiteConfig.description,
    titleTemplate:
      typeof candidate.titleTemplate === "string" ? candidate.titleTemplate : defaultSiteConfig.titleTemplate,
    favicon: typeof candidate.favicon === "string" ? candidate.favicon : defaultSiteConfig.favicon,
    sourceFallback:
      typeof candidate.sourceFallback === "string" ? candidate.sourceFallback : defaultSiteConfig.sourceFallback,
    filings: {
      icp: typeof filings.icp === "string" ? filings.icp : defaultSiteConfig.filings.icp,
      police: typeof filings.police === "string" ? filings.police : defaultSiteConfig.filings.police,
    },
    friendlyLinks: friendlyLinks.length ? friendlyLinks : defaultSiteConfig.friendlyLinks,
    cookieNotice: typeof candidate.cookieNotice === "string" ? candidate.cookieNotice : defaultSiteConfig.cookieNotice,
  };
}

export function formatSiteTitle(config: SiteConfig, articleName = "") {
  return config.titleTemplate
    .replaceAll("{BlogName}", config.blogName)
    .replaceAll("{ArticleName}", articleName || "Field notes from the command line");
}
