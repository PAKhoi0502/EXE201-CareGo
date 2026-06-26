export const DEFAULT_MAP_CENTER = { lat: 10.762622, lng: 106.660172 };

const VIETMAP_STYLE_CODES = new Set(["tm", "lm", "dm", "hm"]);

export const getVietmapMapKey = () =>
  import.meta.env.VITE_VIETMAP_TILE_API_KEY || import.meta.env.VITE_VIETMAP_API_KEY || "";

export const getVietmapStyleCode = () => {
  const styleCode = String(import.meta.env.VITE_VIETMAP_MAP_STYLE || "tm").trim().toLowerCase();
  return VIETMAP_STYLE_CODES.has(styleCode) ? styleCode : "tm";
};

export const getVietmapStyleUrl = () => {
  const apiKey = getVietmapMapKey();
  if (!apiKey) return "";
  return `https://maps.vietmap.vn/maps/styles/${getVietmapStyleCode()}/style.json?apikey=${encodeURIComponent(apiKey)}`;
};

export const hasVietmapMapKey = () => Boolean(getVietmapMapKey());
