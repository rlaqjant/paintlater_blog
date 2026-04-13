"use client";

import { useEffect, useState } from "react";
import { recordView } from "@/app/posts/[slug]/actions";

interface ViewCounterProps {
  slug: string;
  initial: number | null;
}

export function ViewCounter({ slug, initial }: ViewCounterProps) {
  const [count, setCount] = useState<number | null>(initial);

  useEffect(() => {
    let cancelled = false;
    recordView(slug).then((value) => {
      if (!cancelled && value !== null) setCount(value);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (count === null) return null;

  return (
    <span aria-label={`조회수 ${count}`}>
      {count.toLocaleString("ko-KR")} views
    </span>
  );
}
