export interface PaginationInput {
  page?: number | string;
  limit?: number | string;
}

export interface PaginationQuery {
  page: number;
  limit: number;
  offset: number;
}

export function parsePagination(
  query: PaginationInput,
  defaults: { page?: number; limit?: number; maxLimit?: number } = {},
): PaginationQuery {
  const page = Math.max(1, Number(query.page) || defaults.page || 1);
  const maxLimit = defaults.maxLimit ?? 50;
  const limit = Math.min(maxLimit, Math.max(1, Number(query.limit) || defaults.limit || 20));
  return { page, limit, offset: (page - 1) * limit };
}

export function paginatedMeta(total: number, page: number, limit: number) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}
