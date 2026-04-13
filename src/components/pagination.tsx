import Link from "next/link";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  basePath: string;
}

export function Pagination({
  currentPage,
  totalPages,
  basePath,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const prevPage = currentPage - 1;
  const nextPage = currentPage + 1;

  const makeHref = (page: number) =>
    page === 1 ? basePath : `${basePath}?page=${page}`;

  return (
    <nav
      aria-label="페이지 네비게이션"
      className="mt-12 flex items-center justify-between text-sm"
    >
      {prevPage >= 1 ? (
        <Link
          href={makeHref(prevPage)}
          className="rounded-md border border-border px-3 py-1.5 hover:bg-accent"
        >
          ← 이전
        </Link>
      ) : (
        <span />
      )}
      <span className="text-muted-foreground">
        {currentPage} / {totalPages}
      </span>
      {nextPage <= totalPages ? (
        <Link
          href={makeHref(nextPage)}
          className="rounded-md border border-border px-3 py-1.5 hover:bg-accent"
        >
          다음 →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
