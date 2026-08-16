import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createTerminalApi, type DemoBootstrap } from "../lib/demo-runtime";
import { defaultSiteConfig } from "../lib/site-config";

const bootstrap: DemoBootstrap = {
  accessFiles: [],
  articles: [
    {
      id: "hello",
      title: "Hello",
      category: "notes",
      date: "2026-08-17",
      readTime: "3 min",
      excerpt: "Initial article",
      tags: ["demo"],
      content: "Hello world",
      sourcePath: "articles/notes/hello.md",
    },
  ],
  categories: ["notes"],
  config: defaultSiteConfig,
};

async function login(api: ReturnType<typeof createTerminalApi>) {
  return api.fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "root" }),
  });
}

describe("demo runtime", () => {
  it("keeps browser API calls behind the terminal gateway", () => {
    const component = fs.readFileSync(path.join(process.cwd(), "components", "TerminalBlog.tsx"), "utf8");
    expect(component).not.toMatch(/\bfetch\(\s*[`'"]\/api\//);
  });

  it("keeps administrator mutations in memory and resets them", async () => {
    const api = createTerminalApi(bootstrap, { demo: true });
    expect((await login(api)).ok).toBe(true);

    const write = await api.fetch("/api/articles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "new-entry",
        title: "New entry",
        category: "lab",
        content: "Temporary",
      }),
    });
    expect(write.ok).toBe(true);

    const beforeReset = (await (await api.fetch("/api/articles")).json()) as { rows: Array<{ id: string }> };
    expect(beforeReset.rows.map((article) => article.id)).toContain("new-entry");

    api.reset();
    const afterReset = (await (await api.fetch("/api/articles")).json()) as { rows: Array<{ id: string }> };
    expect(afterReset.rows.map((article) => article.id)).toEqual(["hello"]);

    const unauthorized = await api.fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "private" }),
    });
    expect(unauthorized.status).toBe(403);
  });

  it("supports temporary drafts and configuration updates", async () => {
    const api = createTerminalApi(bootstrap, { demo: true });
    await login(api);

    const draftWrite = await api.fetch("/api/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "draft-one", title: "Draft one", category: "notes" }),
    });
    expect(draftWrite.ok).toBe(true);

    const publish = await api.fetch("/api/drafts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "draft-one" }),
    });
    expect(publish.ok).toBe(true);

    const configWrite = await api.fetch("/api/site-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...defaultSiteConfig, blogName: "demo.blog" }),
    });
    const configResult = (await configWrite.json()) as { config: { blogName: string } };
    expect(configResult.config.blogName).toBe("demo.blog");
  });

  it("returns a short-lived token for sudo commands", async () => {
    const api = createTerminalApi(bootstrap, { demo: true });
    const response = await api.fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "root", session: false }),
    });
    const result = (await response.json()) as { token?: string };
    expect(result.token).toBeTruthy();

    const category = await api.fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${result.token}` },
      body: JSON.stringify({ category: "sudo-created" }),
    });
    expect(category.ok).toBe(true);
  });
});
