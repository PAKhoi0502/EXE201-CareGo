const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

const parsePositiveInteger = (value, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const parsePagination = (
  query = {},
  { defaultLimit = DEFAULT_LIMIT, maxLimit = MAX_LIMIT } = {},
) => {
  const page = parsePositiveInteger(query.page, DEFAULT_PAGE);
  const limit = parsePositiveInteger(query.limit, defaultLimit);

  if (!page) {
    return { error: "Số trang phải là số nguyên dương." };
  }
  if (!limit || limit > maxLimit) {
    return { error: `Số bản ghi mỗi trang phải từ 1 đến ${maxLimit}.` };
  }

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

export const buildPagination = ({ page, limit }, total) => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});
