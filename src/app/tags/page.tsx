import Link from "next/link";
import type { Metadata } from "next";
import { getAllPosts, getAllTags } from "@/lib/posts";

export const metadata: Metadata = {
  title: "태그",
  description: "모든 태그 목록",
};

export default function TagsPage() {
  const tags = getAllTags();
  const posts = getAllPosts();
  const counts = new Map<string, number>();
  posts.forEach((p) =>
    p.tags?.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1))
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight mb-8">태그</h1>
      {tags.length === 0 ? (
        <p className="text-muted-foreground">등록된 태그가 없습니다.</p>
      ) : (
        <ul className="flex flex-wrap gap-3">
          {tags.map((tag) => (
            <li key={tag}>
              <Link
                href={`/tags/${encodeURIComponent(tag)}`}
                className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm hover:bg-accent"
              >
                <span>#{tag}</span>
                <span className="text-xs text-muted-foreground">
                  {counts.get(tag) ?? 0}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
