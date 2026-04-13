import Link from "next/link";
import type { PostMeta } from "@/lib/posts";

export function PostList({ posts }: { posts: PostMeta[] }) {
  if (posts.length === 0) {
    return (
      <p className="text-muted-foreground">아직 작성된 포스트가 없습니다.</p>
    );
  }
  return (
    <ul className="space-y-10">
      {posts.map((post) => (
        <li key={post.slug}>
          <Link
            href={`/posts/${post.slug}`}
            className="block group space-y-2"
          >
            <h2 className="text-xl font-semibold group-hover:underline">
              {post.title}
            </h2>
            <p className="text-sm text-muted-foreground">{post.description}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <time dateTime={post.publishedAt}>{post.publishedAt}</time>
              {post.tags?.length ? <span aria-hidden>·</span> : null}
              <div className="flex flex-wrap gap-2">
                {post.tags?.map((t) => (
                  <span key={t}>#{t}</span>
                ))}
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
