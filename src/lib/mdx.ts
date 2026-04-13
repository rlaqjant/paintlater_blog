import rehypePrettyCode, { type Options as PrettyCodeOptions } from "rehype-pretty-code";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeMermaid from "rehype-mermaid";
import remarkGfm from "remark-gfm";
import type { Pluggable } from "unified";

const prettyCodeOptions: PrettyCodeOptions = {
  theme: { dark: "github-dark", light: "github-light" },
  keepBackground: false,
  defaultLang: "plaintext",
};

const mermaidOptions = {
  strategy: "pre-mermaid" as const,
};

export const mdxCompileOptions = {
  mdxOptions: {
    remarkPlugins: [remarkGfm] as Pluggable[],
    rehypePlugins: [
      rehypeSlug,
      [rehypeMermaid, mermaidOptions],
      [rehypePrettyCode, prettyCodeOptions],
      [
        rehypeAutolinkHeadings,
        {
          behavior: "wrap",
          properties: { className: ["heading-anchor"] },
        },
      ],
    ] as Pluggable[],
  },
};
