import type { Metadata } from "next";
import { getAllPosts } from "@/lib/posts";
import { SearchClient } from "@/components/search-client";

export const metadata: Metadata = {
  title: "검색",
  description: "포스트 제목, 설명, 태그로 검색합니다.",
};

export default function SearchPage() {
  const posts = getAllPosts();
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight mb-8">검색</h1>
      <SearchClient posts={posts} />
    </div>
  );
}
