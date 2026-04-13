import GithubSlugger from "github-slugger";

export interface Heading {
  level: number;
  text: string;
  id: string;
}

export function extractHeadings(content: string): Heading[] {
  const slugger = new GithubSlugger();
  const headings: Heading[] = [];
  let inCode = false;

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trimEnd();
    if (/^```/.test(line)) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    const match = /^(#{2,4})\s+(.+)$/.exec(line);
    if (!match) continue;
    const text = match[2].replace(/`([^`]+)`/g, "$1").trim();
    headings.push({
      level: match[1].length,
      text,
      id: slugger.slug(text),
    });
  }
  return headings;
}
