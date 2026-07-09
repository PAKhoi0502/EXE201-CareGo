import { useEffect, useRef, useState } from "react";
import { api } from "../api/client.js";
import { loadVietmap } from "../utils/loadVietmap.js";
import { DEFAULT_MAP_CENTER, getVietmapStyleUrl, hasVietmapMapKey } from "../utils/mapProvider.js";
import { Button, Input } from "./Ui.jsx";

const getValidLngLat = (point) => {
  const lat = Number(point?.lat);
  const lng = Number(point?.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return [lng, lat];
};

const normalizeLocation = (location) => {
  const lngLat = getValidLngLat(location);
  if (!lngLat) return null;

  return {
    lat: lngLat[1],
    lng: lngLat[0],
    displayName: location.displayName,
    provider: location.provider,
    refId: location.refId,
  };
};

const normalizeSearchText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const getCityIdFromAddress = (value) => {
  const normalized = normalizeSearchText(value);
  const isHoChiMinh =
    normalized.includes("ho chi minh") ||
    normalized.includes("tphcm") ||
    normalized.includes("tp hcm") ||
    normalized.includes("sai gon") ||
    normalized.includes("saigon");

  return isHoChiMinh ? "12" : "";
};

const MAP_PICKED_LABEL = "Vị trí đã chọn trên bản đồ";

const buildMarkerElement = () => {
  const element = document.createElement("div");
  element.className = "carego-map-pin";
  element.setAttribute("aria-hidden", "true");
  return element;
};

const AddressPickerMap = ({ center, location, address, onPick }) => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onPickRef = useRef(onPick);
  const addressRef = useRef(address);
  const initialViewRef = useRef({ center, hasLocation: Boolean(location) });
  const hasMapKey = hasVietmapMapKey();
  const [vietmapgl, setVietmapgl] = useState(null);
  const [mapLoadError, setMapLoadError] = useState("");

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  useEffect(() => {
    addressRef.current = address;
  }, [address]);

  useEffect(() => {
    if (!hasMapKey) return undefined;

    let active = true;
    loadVietmap()
      .then((library) => {
        if (active) setVietmapgl(library);
      })
      .catch(() => {
        if (active) setMapLoadError("Không thể tải bản đồ. Vui lòng thử lại sau.");
      });

    return () => {
      active = false;
    };
  }, [hasMapKey]);

  useEffect(() => {
    if (!containerRef.current || !hasMapKey || !vietmapgl) return undefined;

    const map = new vietmapgl.Map({
      container: containerRef.current,
      style: getVietmapStyleUrl(),
      center: [initialViewRef.current.center.lng, initialViewRef.current.center.lat],
      zoom: initialViewRef.current.hasLocation ? 16 : 12,
      attributionControl: true,
    });

    map.addControl(new vietmapgl.NavigationControl({ showCompass: false }), "top-right");
    map.on("click", (event) => {
      onPickRef.current?.({
        lat: event.lngLat.lat,
        lng: event.lngLat.lng,
        displayName: addressRef.current?.trim() || MAP_PICKED_LABEL,
      });
    });

    mapRef.current = map;

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [hasMapKey, vietmapgl]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    map.easeTo({
      center: [center.lng, center.lat],
      zoom: location ? 16 : 12,
      duration: 450,
    });
  }, [center.lat, center.lng, location]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!location) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    const lngLat = getValidLngLat(location);
    if (!lngLat) return;

    const popupText = location.displayName || address || `${lngLat[1].toFixed(6)}, ${lngLat[0].toFixed(6)}`;

    if (!markerRef.current) {
      markerRef.current = new vietmapgl.Marker({
        element: buildMarkerElement(),
        anchor: "bottom",
        draggable: true,
      })
        .setLngLat(lngLat)
        .addTo(map);

      markerRef.current.on("dragend", () => {
        const nextLngLat = markerRef.current?.getLngLat?.();
        if (!nextLngLat) return;

        onPickRef.current?.({
          lat: nextLngLat.lat,
          lng: nextLngLat.lng,
          displayName: addressRef.current?.trim() || MAP_PICKED_LABEL,
        });
      });
    }

    markerRef.current
      .setLngLat(lngLat)
      .setPopup(new vietmapgl.Popup({ offset: 28 }).setText(popupText));
  }, [address, location, vietmapgl]);

  if (!hasMapKey) {
    return (
      <div className="grid h-full place-items-center bg-slate-50 p-5 text-center text-sm font-semibold text-slate-500">
        Cần cấu hình VITE_VIETMAP_TILE_API_KEY để hiển thị bản đồ Vietmap.
      </div>
    );
  }

  if (mapLoadError) {
    return (
      <div className="grid h-full place-items-center bg-rose-50 p-5 text-center text-sm font-semibold text-rose-600">
        {mapLoadError}
      </div>
    );
  }

  if (!vietmapgl) {
    return (
      <div className="grid h-full place-items-center bg-slate-50 p-5 text-center text-sm font-semibold text-slate-500">
        Đang tải bản đồ...
      </div>
    );
  }

  return <div ref={containerRef} className="carego-vietmap-map h-full w-full" />;
};

const AddressSearchMap = ({ address, location, onAddressChange, onLocationChange }) => {
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const center = location ? { lat: Number(location.lat), lng: Number(location.lng) } : DEFAULT_MAP_CENTER;
  const trimmedAddress = address?.trim() || "";
  const hasMapPickedLabel = trimmedAddress === MAP_PICKED_LABEL;
  const isMapPickReady = Boolean(location) && hasMapPickedLabel;
  const searchButtonLabel = isMapPickReady ? "Đã chọn trên bản đồ" : searching ? "Đang tìm..." : "Tìm trên bản đồ";

  const selectLocation = (nextLocation) => {
    setSuggestions([]);
    setError("");
    onLocationChange(nextLocation);
    onAddressChange(nextLocation.displayName || trimmedAddress);
  };

  const searchAddress = async () => {
    if (hasMapPickedLabel) {
      setError(location ? "" : "Vui lòng nhập địa chỉ cụ thể để tìm kiếm.");
      return;
    }

    if (!trimmedAddress) {
      setError("Vui lòng nhập địa chỉ để tìm kiếm.");
      return;
    }

    setSearching(true);
    setError("");
    setSuggestions([]);
    try {
      const params = new URLSearchParams({
        text: trimmedAddress,
        limit: "5",
      });
      const cityId = getCityIdFromAddress(trimmedAddress);
      const focus = getValidLngLat(location);

      if (cityId) {
        params.set("cityId", cityId);
      }

      if (focus) {
        params.set("lng", String(focus[0]));
        params.set("lat", String(focus[1]));
      }

      const result = await api.get(`/maps/search?${params}`);
      const locations = (Array.isArray(result.locations) ? result.locations : [result.location])
        .map(normalizeLocation)
        .filter(Boolean);

      if (!locations.length) {
        setError("Không tìm thấy địa chỉ có tọa độ hợp lệ. Vui lòng thử lại.");
        return;
      }

      if (locations.length === 1) {
        selectLocation(locations[0]);
        return;
      }

      setSuggestions(locations);
    } catch (err) {
      setError(err.message || "Không thể tìm địa chỉ. Vui lòng thử lại sau.");
    } finally {
      setSearching(false);
    }
  };

  const handleAddressInputChange = (event) => {
    setError("");
    setSuggestions([]);
    onAddressChange(event.target.value);
    if (location) {
      onLocationChange(null);
    }
  };

  const handleMapPick = (addressLocation) => {
    setError("");
    setSuggestions([]);
    onLocationChange(addressLocation);
    if (!address?.trim()) {
      onAddressChange(addressLocation.displayName || MAP_PICKED_LABEL);
    }
  };

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <Input label="Địa chỉ thực hiện" value={address} onChange={handleAddressInputChange} required />
        <div className="flex items-end">
          <Button type="button" className="w-full md:w-auto" onClick={searchAddress} disabled={searching || isMapPickReady}>
            {searchButtonLabel}
          </Button>
        </div>
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {suggestions.length ? (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <p className="px-3 pt-3 text-sm font-semibold text-slate-700">Chọn địa chỉ phù hợp</p>
          <div className="divide-y divide-slate-100">
            {suggestions.map((item, index) => (
              <button
                type="button"
                key={`${item.refId || `${item.lat}-${item.lng}`}-${index}`}
                className="block w-full px-3 py-3 text-left text-sm transition hover:bg-teal-50 focus:bg-teal-50 focus:outline-none"
                onClick={() => selectLocation(item)}
              >
                <span className="block font-semibold text-slate-800">{item.displayName || `Kết quả ${index + 1}`}</span>
                <span className="mt-1 block text-xs text-slate-500">
                  {item.lat.toFixed(6)}, {item.lng.toFixed(6)}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="relative z-0 h-80 overflow-hidden rounded-lg border border-slate-200">
        <AddressPickerMap center={center} location={location} address={address} onPick={handleMapPick} />
      </div>
      {location ? (
        <p className="text-sm text-slate-500">
          Đã ghim: {Number(location.lat).toFixed(6)}, {Number(location.lng).toFixed(6)}
          {isMapPickReady
            ? ". Nhập địa chỉ nếu muốn tìm vị trí khác."
            : ". Nếu vị trí chưa đúng, kéo ghim hoặc bấm vào vị trí đúng trên bản đồ."}
        </p>
      ) : (
        <p className="text-sm text-slate-500">Bạn có thể tìm địa chỉ hoặc bấm trực tiếp trên bản đồ để ghim vị trí</p>
      )}
    </div>
  );
};

export default AddressSearchMap;
