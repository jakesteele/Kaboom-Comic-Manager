export interface PaginationResult {
  offset: number;
  limit: number;
  currentPage: number;
  totalPages: number;
  totalItems: number;
}

export function paginate(page: number, pageSize: number, totalItems: number): PaginationResult {
  const currentPage = Math.max(1, page);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  return {
    offset: (currentPage - 1) * pageSize,
    limit: pageSize,
    currentPage,
    totalPages,
    totalItems,
  };
}
