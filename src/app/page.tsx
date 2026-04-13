import { getAllPosts } from "@/lib/posts";
import { siteConfig } from "@/lib/site";
import { PostList } from "@/components/post-list";
import { Pagination } from "@/components/pagination";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  const posts = getAllPosts();
  const currentPage = Math.max(1, Number(page) || 1);
  const pageSize = siteConfig.pageSize;
  const totalPages = Math.max(1, Math.ceil(posts.length / pageSize));
  const start = (currentPage - 1) * pageSize;
  const paged = posts.slice(start, start + pageSize);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight mb-8">최근 포스트</h1>
      <PostList posts={paged} />
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        basePath="/"
      />
    </div>
  );
}
