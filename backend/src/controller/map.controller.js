const VIETMAP_BASE_URL = "https://maps.vietmap.vn/api";
const DEFAULT_DISPLAY_TYPE = "5";
const DEFAULT_SEARCH_LIMIT = 5;
const MAX_SEARCH_LIMIT = 8;
const VIETMAP_REQUEST_TIMEOUT_MS = 8000;
const VIETMAP_SEARCH_FILTER_PARAMS = [
  "cityId",
  "districtId",
  "wardId",
  "layers",
  "circle_center",
  "circle_radius",
];

const getVietmapApiKey = () =>
  process.env.VIETMAP_API_KEY ||
  process.env.VIETMAP_SERVICE_API_KEY ||
  process.env.VIETMAP_MAP_API_KEY ||
  process.env.CAREGO_VIETMAP_API_KEY ||
  "";

const normalizeCoordinate = ({ lat, lng }) => {
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);

  if (
    !Number.isFinite(parsedLat) ||
    !Number.isFinite(parsedLng) ||
    parsedLat < -90 ||
    parsedLat > 90 ||
    parsedLng < -180 ||
    parsedLng > 180
  ) {
    return null;
  }

  return { lat: parsedLat, lng: parsedLng };
};

const getSearchFocus = (query) => normalizeCoordinate(query);

const getSearchLimit = (queryLimit) => {
  const parsedLimit = Number(queryLimit);
  if (!Number.isInteger(parsedLimit) || parsedLimit < 1) return DEFAULT_SEARCH_LIMIT;
  return Math.min(parsedLimit, MAX_SEARCH_LIMIT);
};

const fetchVietmapJson = async (path, params) => {
  const url = new URL(`${VIETMAP_BASE_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VIETMAP_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();
    let data = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { message: text };
    }

    if (!response.ok) {
      const error = new Error(data?.message || "Yêu cầu đến Vietmap không thành công.");
      error.statusCode = response.status >= 500 ? 502 : response.status;
      throw error;
    }

    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error("Kết nối đến Vietmap đã quá thời gian chờ.");
      timeoutError.statusCode = 504;
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const pickSearchResults = (results, limit) => {
  if (!Array.isArray(results)) return null;
  return results.filter((item) => item?.ref_id || item?.refId).slice(0, limit);
};

const normalizeVietmapPlace = (place, searchResult) => {
  const coordinate = normalizeCoordinate(place || {});
  if (!coordinate) return null;

  const displayName =
    String(place?.display || "").trim() ||
    String(searchResult?.display || "").trim() ||
    String(searchResult?.address || "").trim() ||
    String(searchResult?.name || "").trim();

  return {
    ...coordinate,
    displayName,
    provider: "vietmap",
    refId: searchResult?.ref_id || searchResult?.refId || "",
  };
};

export const searchMapAddress = async (req, res) => {
  try {
    const apiKey = getVietmapApiKey();
    if (!apiKey) {
      return res.status(503).json({ message: "Khóa API Vietmap chưa được cấu hình." });
    }

    const text = String(req.query.text || req.query.q || "").trim();
    if (text.length < 2) {
      return res.status(400).json({ message: "Địa chỉ tìm kiếm phải có ít nhất 2 ký tự." });
    }

    const focus = getSearchFocus(req.query);
    const searchParams = {
      apikey: apiKey,
      text,
      display_type: req.query.displayType || DEFAULT_DISPLAY_TYPE,
    };

    if (focus) {
      searchParams.focus = `${focus.lat},${focus.lng}`;
    }

    VIETMAP_SEARCH_FILTER_PARAMS.forEach((param) => {
      if (req.query[param]) {
        searchParams[param] = req.query[param];
      }
    });

    const searchResults = await fetchVietmapJson("/search/v4", searchParams);

    const candidateResults = pickSearchResults(searchResults, getSearchLimit(req.query.limit));
    if (!candidateResults?.length) {
      return res.status(404).json({ message: "Không tìm thấy địa chỉ phù hợp." });
    }

    const locations = (
      await Promise.all(
        candidateResults.map(async (searchResult) => {
          const refId = searchResult?.ref_id || searchResult?.refId;
          try {
            const place = await fetchVietmapJson("/place/v4", {
              apikey: apiKey,
              refid: refId,
            });
            return normalizeVietmapPlace(place, searchResult);
          } catch {
            return null;
          }
        }),
      )
    ).filter(Boolean);

    if (!locations.length) {
      return res.status(404).json({ message: "Địa chỉ tìm thấy chưa có tọa độ hợp lệ." });
    }

    return res.status(200).json({ location: locations[0], locations });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      message: statusCode >= 500
        ? "Không thể kết nối Vietmap. Vui lòng thử lại sau."
        : "Không thể tìm địa chỉ phù hợp. Vui lòng kiểm tra lại nội dung tìm kiếm.",
    });
  }
};
