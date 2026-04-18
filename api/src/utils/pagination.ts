/**
 * Build pagination metadata for API responses.
 * 
 * @param total - Total number of records
 * @param page - Current page number
 * @param limit - Records per page
 * @returns Pagination metadata object
 */
export const buildPaginationMeta = (
  total: number,
  page: number,
  limit: number
) => {
  const totalPages = Math.ceil(total / limit);
  
  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};
