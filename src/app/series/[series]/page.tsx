import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAllPosts, getSeriesPosts } from "@/lib/posts";

export function generateStaticParams() {
  const series = new Set<string>();
  getAllPosts().forEach((p) => p.series && series.add(p.series));
  return [...series].map((s) => ({ series: encodeURIComponent(s) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ series: string }>;
}): Promise<Metadata> {
  const { series } = await params;
  const decoded = decodeURIComponent(series);
  return {
    title: `시리즈: ${decoded}`,
    description: `'${decoded}' 시리즈 포스트 모음`,
  };
}

export default async function SeriesPage({
  params,
}: {
  params: Promise<{ series: string }>;
}) {
  const { series } = await params;
  const decoded = decodeURIComponent(series);
  const posts = getSeriesPosts(decoded);
  if (posts.length === 0) notFound();

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight mb-2">
        시리즈: {decoded}
      </h1>
      <p className="mb-8 text-sm text-muted-foreground">
        총 {posts.length}개의 포스트
      </p>
      <ol className="space-y-6">
        {posts.map((post, i) => (
          <li key={post.slug} className="flex gap-4">
            <span className="mt-0.5 text-sm font-semibold text-muted-foreground">
              {String(i + 1).padStart(2, "0")}
            </span>
            <Link
              href={`/posts/${post.slug}`}
              className="block flex-1 group space-y-1"
            >
              <h2 className="text-lg font-semibold group-hover:underline">
                {post.title}
              </h2>
              <p className="text-sm text-muted-foreground">
                {post.description}
              </p>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
