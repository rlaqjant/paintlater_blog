"use client";

import Fuse from "fuse.js";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { PostMeta } from "@/lib/posts";

export function SearchClient({ posts }: { posts: PostMeta[] }) {
  const [query, setQuery] = useState("");

  const fuse = useMemo(
    () =>
      new Fuse(posts, {
        keys: [
          { name: "title", weight: 0.5 },
          { name: "description", weight: 0.3 },
          { name: "tags", weight: 0.2 },
        ],
        threshold: 0.4,
        ignoreLocation: true,
      }),
    [posts]
  );

  const results = query.trim()
    ? fuse.search(query).map((r) => r.item)
    : posts;

  return (
    <div className="space-y-6">
      <input
        type="search"
        placeholder="제목, 설명, 태그로 검색"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-4 py-2.5 outline-none focus:ring-2 focus:ring-ring"
        autoFocus
      />
      <div className="text-sm text-muted-foreground">
        {query.trim() ? `${results.length}개 결과` : `전체 ${posts.length}개`}
      </div>
      <ul className="space-y-6">
        {results.map((p) => (
          <li key={p.slug}>
            <Link
              href={`/posts/${p.slug}`}
              className="block group space-y-1"
            >
              <h2 className="text-lg font-semibold group-hover:underline">
                {p.title}
              </h2>
              <p className="text-sm text-muted-foreground">{p.description}</p>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <time dateTime={p.publishedAt}>{p.publishedAt}</time>
                {p.tags?.map((t) => (
                  <span key={t}>#{t}</span>
                ))}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
