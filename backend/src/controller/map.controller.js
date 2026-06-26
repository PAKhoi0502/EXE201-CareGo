const VIETMAP_BASE_URL = "https://maps.vietmap.vn/api";
const DEFAULT_FOCUS = { lat: 10.762622, lng: 106.660172 };
const DEFAULT_DISPLAY_TYPE = "5";
const VIETMAP_REQUEST_TIMEOUT_MS = 8000;

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

const getSearchFocus = (query) => normalizeCoordinate(query) || DEFAULT_FOCUS;

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
      const error = new Error(data?.message || "Vietmap request failed");
      error.statusCode = response.status >= 500 ? 502 : response.status;
      throw error;
    }

    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error("Vietmap request timed out");
      timeoutError.statusCode = 504;
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const pickSearchResult = (results) => {
  if (!Array.isArray(results)) return null;
  return results.find((item) => item?.ref_id || item?.refId) || null;
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
      return res.status(503).json({ message: "Vietmap API key is not configured" });
    }

    const text = String(req.query.text || req.query.q || "").trim();
    if (text.length < 2) {
      return res.status(400).json({ message: "address text must contain at least 2 characters" });
    }

    const focus = getSearchFocus(req.query);
    const searchResults = await fetchVietmapJson("/search/v4", {
      apikey: apiKey,
      text,
      focus: `${focus.lat},${focus.lng}`,
      display_type: req.query.displayType || DEFAULT_DISPLAY_TYPE,
    });

    const searchResult = pickSearchResult(searchResults);
    const refId = searchResult?.ref_id || searchResult?.refId;
    if (!refId) {
      return res.status(404).json({ message: "Không tìm thấy địa chỉ phù hợp." });
    }

    const place = await fetchVietmapJson("/place/v4", {
      apikey: apiKey,
      refid: refId,
    });
    const location = normalizeVietmapPlace(place, searchResult);

    if (!location) {
      return res.status(404).json({ message: "Địa chỉ tìm thấy chưa có tọa độ hợp lệ." });
    }

    return res.status(200).json({ location });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      message: statusCode >= 500 ? "Không thể kết nối Vietmap. Vui lòng thử lại sau." : error.message,
    });
  }
};
