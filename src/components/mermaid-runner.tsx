"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

export function MermaidRunner() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const mod = await import("mermaid");
        if (cancelled) return;
        const mermaid = mod.default;

        mermaid.initialize({
          startOnLoad: false,
          theme: resolvedTheme === "dark" ? "dark" : "neutral",
          securityLevel: "loose",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        });

        const nodes = document.querySelectorAll<HTMLElement>("pre.mermaid");
        if (nodes.length === 0) return;

        nodes.forEach((node) => {
          if (node.dataset.original === undefined) {
            node.dataset.original = node.textContent ?? "";
          } else {
            node.textContent = node.dataset.original;
          }
          node.removeAttribute("data-processed");
        });

        await mermaid.run({ nodes: Array.from(nodes) });
      } catch (error) {
        console.error("[MermaidRunner] render failed", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [resolvedTheme]);

  return null;
}
