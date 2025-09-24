export interface PaginationInput {
  page: number;
  limit: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

export function paginateArray<T>(
  items: T[],
  { page, limit }: PaginationInput,
): PaginatedResult<T> {
  const safePage = page > 0 ? page : 1;
  const safeLimit = limit > 0 ? limit : 10;
  const start = (safePage - 1) * safeLimit;
  const end = start + safeLimit;
  const slice = items.slice(start, end);

  return {
    data: slice,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: items.length,
    },
  };
}
