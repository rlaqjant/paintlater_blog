"use client";

import { useEffect, useState } from "react";
import type { Heading } from "@/lib/toc";

export function TableOfContents({ headings }: { headings: Heading[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 }
    );

    const elements: Element[] = [];
    headings.forEach((h) => {
      const el = document.getElementById(h.id);
      if (el) {
        observer.observe(el);
        elements.push(el);
      }
    });

    return () => {
      elements.forEach((el) => observer.unobserve(el));
      observer.disconnect();
    };
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <nav aria-label="목차" className="text-sm">
      <div className="mb-3 font-semibold text-foreground">목차</div>
      <ul className="space-y-2 border-l border-border">
        {headings.map((h) => {
          const isActive = activeId === h.id;
          return (
            <li
              key={h.id}
              style={{ paddingLeft: `${(h.level - 2) * 12}px` }}
            >
              <a
                href={`#${h.id}`}
                className={`block -ml-px border-l pl-3 py-0.5 transition-colors ${
                  isActive
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {h.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
