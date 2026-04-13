import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAllTags, getPostsByTag } from "@/lib/posts";
import { PostList } from "@/components/post-list";

export function generateStaticParams() {
  return getAllTags().map((tag) => ({ tag: encodeURIComponent(tag) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string }>;
}): Promise<Metadata> {
  const { tag } = await params;
  const decoded = decodeURIComponent(tag);
  return {
    title: `#${decoded}`,
    description: `'${decoded}' 태그가 달린 포스트 목록`,
  };
}

export default async function TagPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag } = await params;
  const decoded = decodeURIComponent(tag);
  const posts = getPostsByTag(decoded);
  if (posts.length === 0) notFound();

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight mb-2">#{decoded}</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        총 {posts.length}개의 포스트
      </p>
      <PostList posts={posts} />
    </div>
  );
}
