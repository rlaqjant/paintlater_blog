import type { MetadataRoute } from "next";
import { getAllPosts, getAllTags } from "@/lib/posts";
import { siteConfig } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url;
  const posts = getAllPosts();
  const tags = getAllTags();
  const series = new Set<string>();
  posts.forEach((p) => p.series && series.add(p.series));

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/tags`, changeFrequency: "weekly", priority: 0.6 },
  ];

  const postRoutes: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${base}/posts/${p.slug}`,
    lastModified: new Date(p.updatedAt ?? p.publishedAt),
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  const tagRoutes: MetadataRoute.Sitemap = tags.map((t) => ({
    url: `${base}/tags/${encodeURIComponent(t)}`,
    changeFrequency: "weekly",
    priority: 0.4,
  }));

  const seriesRoutes: MetadataRoute.Sitemap = [...series].map((s) => ({
    url: `${base}/series/${encodeURIComponent(s)}`,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  return [...staticRoutes, ...postRoutes, ...tagRoutes, ...seriesRoutes];
}
