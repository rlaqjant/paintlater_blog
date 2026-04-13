"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";

export function GiscusComments() {
  const ref = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();

  const repo = process.env.NEXT_PUBLIC_GISCUS_REPO;
  const repoId = process.env.NEXT_PUBLIC_GISCUS_REPO_ID;
  const category = process.env.NEXT_PUBLIC_GISCUS_CATEGORY ?? "General";
  const categoryId = process.env.NEXT_PUBLIC_GISCUS_CATEGORY_ID;

  useEffect(() => {
    const container = ref.current;
    if (!container || !repo || !repoId || !categoryId) return;

    const script = document.createElement("script");
    script.src = "https://giscus.app/client.js";
    script.setAttribute("data-repo", repo);
    script.setAttribute("data-repo-id", repoId);
    script.setAttribute("data-category", category);
    script.setAttribute("data-category-id", categoryId);
    script.setAttribute("data-mapping", "pathname");
    script.setAttribute("data-strict", "0");
    script.setAttribute("data-reactions-enabled", "1");
    script.setAttribute("data-emit-metadata", "0");
    script.setAttribute("data-input-position", "bottom");
    script.setAttribute(
      "data-theme",
      resolvedTheme === "dark" ? "dark" : "light"
    );
    script.setAttribute("data-lang", "ko");
    script.crossOrigin = "anonymous";
    script.async = true;

    container.innerHTML = "";
    container.appendChild(script);
  }, [repo, repoId, category, categoryId, resolvedTheme]);

  if (!repo || !repoId || !categoryId) return null;

  return <div ref={ref} className="mt-12" />;
}
