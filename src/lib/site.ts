export const siteConfig = {
  name: "PaintLater Blog",
  description:
    "PaintLater 서비스를 개발하며 겪은 기술적 문제 해결 과정을 공유하는 기술 블로그",
  url:
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000",
  author: {
    name: "rlaqjant",
    github: "https://github.com/rlaqjant",
  },
  repos: {
    web: "https://github.com/rlaqjant/miniature-backlog-web",
    api: "https://github.com/rlaqjant/miniature-backlog-api",
  },
  pageSize: 10,
};
