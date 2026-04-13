import { notFound } from "next/navigation";
import { compileMDX } from "next-mdx-remote/rsc";
import type { Metadata } from "next";
import Link from "next/link";
import {
  getAllPosts,
  getPostBySlug,
  getSeriesPosts,
} from "@/lib/posts";
import { mdxCompileOptions } from "@/lib/mdx";
import { siteConfig } from "@/lib/site";
import { extractHeadings } from "@/lib/toc";
import { getViewCount } from "@/lib/views";
import { SeriesNav } from "@/components/series-nav";
import { TableOfContents } from "@/components/table-of-contents";
import { ViewCounter } from "@/components/view-counter";
import { GiscusComments } from "@/components/giscus-comments";
import { MermaidRunner } from "@/components/mermaid-runner";

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  const url = `${siteConfig.url}/posts/${slug}`;
  return {
    title: post.meta.title,
    description: post.meta.description,
    alternates: { canonical: url },
    openGraph: {
      title: post.meta.title,
      description: post.meta.description,
      url,
      type: "article",
      publishedTime: post.meta.publishedAt,
      modifiedTime: post.meta.updatedAt,
      tags: post.meta.tags,
    },
    twitter: {
      card: "summary_large_image",
      title: post.meta.title,
      description: post.meta.description,
    },
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const [{ content }, views] = await Promise.all([
    compileMDX({ source: post.content, options: mdxCompileOptions }),
    getViewCount(slug),
  ]);

  const headings = extractHeadings(post.content);
  const seriesPosts = post.meta.series
    ? getSeriesPosts(post.meta.series)
    : [];

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 lg:grid lg:grid-cols-[minmax(0,1fr)_220px] lg:gap-10">
      <article className="min-w-0">
        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight">
            {post.meta.title}
          </h1>
          {post.meta.description ? (
            <p className="mt-2 text-muted-foreground">
              {post.meta.description}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <time dateTime={post.meta.publishedAt}>
              {post.meta.publishedAt}
            </time>
            {post.meta.tags?.length ? <span aria-hidden>·</span> : null}
            <div className="flex flex-wrap gap-2">
              {post.meta.tags?.map((t) => (
                <Link
                  key={t}
                  href={`/tags/${encodeURIComponent(t)}`}
                  className="hover:text-foreground hover:underline"
                >
                  #{t}
                </Link>
              ))}
            </div>
            {views !== null ? (
              <>
                <span aria-hidden>·</span>
                <ViewCounter slug={slug} initial={views} />
              </>
            ) : null}
          </div>
        </header>
        <div className="prose prose-zinc dark:prose-invert max-w-none">
          {content}
        </div>
        <MermaidRunner />
        {post.meta.series && seriesPosts.length > 1 ? (
          <SeriesNav
            series={post.meta.series}
            posts={seriesPosts}
            currentSlug={slug}
          />
        ) : null}
        <GiscusComments />
      </article>
      <aside className="hidden lg:block">
        <div className="sticky top-20">
          <TableOfContents headings={headings} />
        </div>
      </aside>
    </div>
  );
}
