import "server-only";

import { openDatabase } from "./database";

export type ArticleIndexInput = {
  id: string;
  category: string;
  title: string;
  date: string;
  readTime: string;
  tags: string[];
  pinyin?: string;
  sourcePath?: string;
};

export type ArticleIndexRow = {
  id: string;
  category: string;
  title: string;
  date: string;
  readTime: string;
  tags: string[];
  pinyin: string;
  sourcePath: string;
};

export function upsertArticleIndex(article: ArticleIndexInput) {
  const database = openDatabase();
  try {
    database
      .prepare(
        `INSERT INTO article_index (id, category, title, date, read_time, tags_json, pinyin, source_path, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           category=excluded.category,
           title=excluded.title,
           date=excluded.date,
           read_time=excluded.read_time,
           tags_json=excluded.tags_json,
           pinyin=excluded.pinyin,
           source_path=excluded.source_path,
           updated_at=excluded.updated_at`,
      )
      .run(
        article.id,
        article.category,
        article.title,
        article.date,
        article.readTime,
        JSON.stringify(article.tags),
        article.pinyin || "",
        article.sourcePath || `memory://${article.id}`,
        new Date().toISOString(),
      );
  } finally {
    database.close();
  }
}

export function removeArticleIndex(id: string) {
  const database = openDatabase();
  try {
    database.prepare("DELETE FROM article_index WHERE id = ?").run(id);
  } finally {
    database.close();
  }
}

export function removeArticleIndexBySourcePath(sourcePath: string) {
  const database = openDatabase();
  try {
    database.prepare("DELETE FROM article_index WHERE source_path = ?").run(sourcePath);
  } finally {
    database.close();
  }
}

export function syncArticleIndex(articles: ArticleIndexInput[]) {
  const database = openDatabase();
  try {
    database.exec("BEGIN IMMEDIATE");
    const expectedSources = new Map(
      articles.map((article) => [article.id, article.sourcePath || `memory://${article.id}`]),
    );
    const rows = database.prepare("SELECT id, source_path AS sourcePath FROM article_index").all() as Array<{
      id: string;
      sourcePath: string;
    }>;
    for (const row of rows) {
      if (expectedSources.get(row.id) !== row.sourcePath)
        database.prepare("DELETE FROM article_index WHERE id = ?").run(row.id);
    }
    const statement = database.prepare(
      `INSERT INTO article_index (id, category, title, date, read_time, tags_json, pinyin, source_path, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         category=excluded.category,
         title=excluded.title,
         date=excluded.date,
         read_time=excluded.read_time,
         tags_json=excluded.tags_json,
         pinyin=excluded.pinyin,
         source_path=excluded.source_path,
         updated_at=excluded.updated_at`,
    );
    const updatedAt = new Date().toISOString();
    for (const article of articles) {
      statement.run(
        article.id,
        article.category,
        article.title,
        article.date,
        article.readTime,
        JSON.stringify(article.tags),
        article.pinyin || "",
        article.sourcePath || `memory://${article.id}`,
        updatedAt,
      );
    }
    database.exec("COMMIT");
  } catch (error) {
    try {
      database.exec("ROLLBACK");
    } catch {
      // Preserve the original database error.
    }
    throw error;
  } finally {
    database.close();
  }
}

export function searchArticleIndex(filters: {
  query?: string;
  tag?: string;
  category?: string;
  from?: string;
  to?: string;
}) {
  const database = openDatabase();
  try {
    const rows = database
      .prepare(
        `SELECT id, category, title, date, read_time AS readTime, tags_json AS tagsJson,
          pinyin, source_path AS sourcePath
         FROM article_index ORDER BY date DESC`,
      )
      .all() as Array<Omit<ArticleIndexRow, "tags"> & { tagsJson: string }>;
    const query = (filters.query || "").trim().toLocaleLowerCase();
    return rows
      .map(({ tagsJson, ...row }) => ({ ...row, tags: JSON.parse(tagsJson) as string[] }))
      .filter((row) => {
        const haystack = [row.id, row.title, row.category, row.pinyin, ...row.tags].join(" ").toLocaleLowerCase();
        return (
          (!query || haystack.includes(query)) &&
          (!filters.tag || row.tags.some((tag) => tag.toLocaleLowerCase() === filters.tag?.toLocaleLowerCase())) &&
          (!filters.category || row.category.toLocaleLowerCase() === filters.category.toLocaleLowerCase()) &&
          (!filters.from || row.date >= filters.from) &&
          (!filters.to || row.date <= filters.to)
        );
      });
  } finally {
    database.close();
  }
}
