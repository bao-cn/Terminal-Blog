import { z } from "zod";

const boundedText = (maximum: number) => z.string().trim().min(1).max(maximum);

export const articleWriteSchema = z
  .object({
    id: boundedText(128),
    title: boundedText(256),
    category: boundedText(96),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    readTime: z.string().max(64).optional(),
    excerpt: z.string().max(2000).optional(),
    content: z
      .string()
      .max(450 * 1024)
      .optional(),
    tags: z.array(z.string().trim().min(1).max(64)).max(32).optional(),
    pinyin: z.string().max(512).optional(),
    previousSourcePath: z.string().max(512).optional(),
  })
  .strict();

export const articleMoveSchema = z.object({ id: boundedText(128), category: boundedText(96) }).strict();
export const draftActionSchema = z.object({ id: boundedText(128) }).strict();
export const categorySchema = z.object({ category: boundedText(96) }).strict();
