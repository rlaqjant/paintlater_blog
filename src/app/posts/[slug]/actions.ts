"use server";

import { incrementViewCount } from "@/lib/views";

export async function recordView(slug: string) {
  return incrementViewCount(slug);
}
