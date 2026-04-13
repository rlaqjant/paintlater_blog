import Link from "next/link";
import type { PostMeta } from "@/lib/posts";

interface SeriesNavProps {
  series: string;
  posts: PostMeta[];
  currentSlug: string;
}

export function SeriesNav({ series, posts, currentSlug }: SeriesNavProps) {
  const index = posts.findIndex((p) => p.slug === currentSlug);
  if (index === -1) return null;
  const prev = index > 0 ? posts[index - 1] : null;
  const next = index < posts.length - 1 ? posts[index + 1] : null;

  return (
    <aside className="my-10 rounded-lg border border-border p-5">
      <div className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
        시리즈 ·{" "}
        <Link
          href={`/series/${encodeURIComponent(series)}`}
          className="underline underline-offset-2"
        >
          {series}
        </Link>
      </div>
      <ol className="space-y-2 text-sm">
        {posts.map((p, i) => (
          <li key={p.slug}>
            <Link
              href={`/posts/${p.slug}`}
              className={
                p.slug === currentSlug
                  ? "font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }
            >
              {i + 1}. {p.title}
            </Link>
          </li>
        ))}
      </ol>
      <div className="mt-5 flex items-center justify-between gap-4 text-sm">
        <div className="flex-1">
          {prev ? (
            <Link
              href={`/posts/${prev.slug}`}
              className="block rounded-md border border-border px-3 py-2 hover:bg-accent"
            >
              <div className="text-xs text-muted-foreground">← 이전</div>
              <div className="truncate">{prev.title}</div>
            </Link>
          ) : null}
        </div>
        <div className="flex-1 text-right">
          {next ? (
            <Link
              href={`/posts/${next.slug}`}
              className="block rounded-md border border-border px-3 py-2 hover:bg-accent"
            >
              <div className="text-xs text-muted-foreground">다음 →</div>
              <div className="truncate">{next.title}</div>
            </Link>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
