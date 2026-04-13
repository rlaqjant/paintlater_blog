import fs from "fs";
import path from "path";
import matter from "gray-matter";

const POSTS_DIR = path.join(process.cwd(), "content", "posts");

export interface PostMeta {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  updatedAt?: string;
  tags: string[];
  series?: string;
  seriesOrder?: number;
  draft: boolean;
  thumbnail?: string;
}

export interface Post {
  meta: PostMeta;
  content: string;
}

function readPostFile(file: string): Post | null {
  const slug = file.replace(/\.mdx$/, "");
  const raw = fs.readFileSync(path.join(POSTS_DIR, file), "utf-8");
  const { data, content } = matter(raw);
  const meta = { slug, ...data } as PostMeta;
  return { meta, content };
}

export function getAllPosts(): PostMeta[] {
  if (!fs.existsSync(POSTS_DIR)) return [];
  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith(".mdx"));
  const posts = files
    .map((file) => readPostFile(file)?.meta)
    .filter((m): m is PostMeta => !!m && !m.draft);
  return posts.sort((a, b) =>
    a.publishedAt < b.publishedAt ? 1 : -1
  );
}

export function getPostBySlug(slug: string): Post | null {
  const file = path.join(POSTS_DIR, `${slug}.mdx`);
  if (!fs.existsSync(file)) return null;
  return readPostFile(`${slug}.mdx`);
}

export function getAllTags(): string[] {
  const tags = new Set<string>();
  getAllPosts().forEach((p) => p.tags?.forEach((t) => tags.add(t)));
  return [...tags].sort();
}

export function getPostsByTag(tag: string): PostMeta[] {
  return getAllPosts().filter((p) => p.tags?.includes(tag));
}

export function getSeriesPosts(series: string): PostMeta[] {
  return getAllPosts()
    .filter((p) => p.series === series)
    .sort((a, b) => (a.seriesOrder ?? 0) - (b.seriesOrder ?? 0));
}
