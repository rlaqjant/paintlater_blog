import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = siteConfig.name;

export default function Image() {
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
          justifyContent: "center",
          padding: "80px",
        }}
      >
        <div
          style={{
            fontSize: 28,
            opacity: 0.7,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          Tech Blog
        </div>
        <div
          style={{
            fontSize: 96,
            fontWeight: 800,
            marginTop: 16,
            lineHeight: 1.1,
          }}
        >
          {siteConfig.name}
        </div>
        <div
          style={{
            fontSize: 32,
            marginTop: 32,
            opacity: 0.8,
            maxWidth: 900,
            lineHeight: 1.4,
          }}
        >
          {siteConfig.description}
        </div>
      </div>
    ),
    { ...size }
  );
}
