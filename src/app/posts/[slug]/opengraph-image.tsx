import { ImageResponse } from "next/og";
import { getPostBySlug } from "@/lib/posts";
import { siteConfig } from "@/lib/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Post cover";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  const title = post?.meta.title ?? siteConfig.name;
  const description = post?.meta.description ?? siteConfig.description;
  const tags = post?.meta.tags ?? [];
  const publishedAt = post?.meta.publishedAt ?? "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background:
            "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
          color: "white",
          display: "flex",
          flexDirection: "column",
          padding: "80px",
        }}
      >
        <div
          style={{
            fontSize: 24,
            opacity: 0.6,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          {siteConfig.name}
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            marginTop: 24,
            lineHeight: 1.2,
            display: "flex",
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 28,
            marginTop: 20,
            opacity: 0.8,
            lineHeight: 1.4,
            display: "flex",
          }}
        >
          {description}
        </div>
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            gap: 24,
            fontSize: 24,
            opacity: 0.7,
          }}
        >
          <span>{publishedAt}</span>
          {tags.length > 0 ? <span>·</span> : null}
          <div style={{ display: "flex", gap: 12 }}>
            {tags.slice(0, 4).map((t) => (
              <span key={t}>#{t}</span>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
