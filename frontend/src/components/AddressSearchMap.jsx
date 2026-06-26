import { useEffect, useRef, useState } from "react";
import vietmapgl from "@vietmap/vietmap-gl-js/dist/vietmap-gl";
import "@vietmap/vietmap-gl-js/dist/vietmap-gl.css";
import { api } from "../api/client.js";
import { DEFAULT_MAP_CENTER, getVietmapStyleUrl, hasVietmapMapKey } from "../utils/mapProvider.js";
import { Button, Input } from "./Ui.jsx";

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
  const initialViewRef = useRef({ center, hasLocation: Boolean(location) });
  const hasMapKey = hasVietmapMapKey();

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  useEffect(() => {
    if (!containerRef.current || !hasMapKey) return undefined;

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
        displayName: MAP_PICKED_LABEL,
      });
    });

    mapRef.current = map;

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [hasMapKey]);

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

    const popupText =
      location.displayName || address || `${Number(location.lat).toFixed(6)}, ${Number(location.lng).toFixed(6)}`;

    if (!markerRef.current) {
      markerRef.current = new vietmapgl.Marker({ element: buildMarkerElement(), anchor: "bottom" }).addTo(map);
    }

    markerRef.current
      .setLngLat([Number(location.lng), Number(location.lat)])
      .setPopup(new vietmapgl.Popup({ offset: 28 }).setText(popupText));
  }, [address, location]);

  if (!hasMapKey) {
    return (
      <div className="grid h-full place-items-center bg-slate-50 p-5 text-center text-sm font-semibold text-slate-500">
        Cần cấu hình VITE_VIETMAP_TILE_API_KEY để hiển thị bản đồ Vietmap.
      </div>
    );
  }

  return <div ref={containerRef} className="carego-vietmap-map h-full w-full" />;
};

const AddressSearchMap = ({ address, location, onAddressChange, onLocationChange }) => {
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const center = location ? { lat: Number(location.lat), lng: Number(location.lng) } : DEFAULT_MAP_CENTER;
  const trimmedAddress = address?.trim() || "";
  const hasMapPickedLabel = trimmedAddress === MAP_PICKED_LABEL;
  const isMapPickReady = Boolean(location) && hasMapPickedLabel;
  const searchButtonLabel = isMapPickReady ? "Đã chọn trên bản đồ" : searching ? "Đang tìm..." : "Tìm trên bản đồ";

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
    try {
      const params = new URLSearchParams({
        text: trimmedAddress,
        lat: String(center.lat),
        lng: String(center.lng),
      });
      const result = await api.get(`/maps/search?${params}`);
      const nextLocation = result.location;

      if (!nextLocation?.lat || !nextLocation?.lng) {
        setError("Không tìm thấy địa chỉ có tọa độ hợp lệ. Vui lòng thử lại.");
        return;
      }

      onLocationChange({
        lat: Number(nextLocation.lat),
        lng: Number(nextLocation.lng),
        displayName: nextLocation.displayName,
        provider: nextLocation.provider,
        refId: nextLocation.refId,
      });
      onAddressChange(nextLocation.displayName || trimmedAddress);
    } catch (err) {
      setError(err.message || "Không thể tìm địa chỉ. Vui lòng thử lại sau.");
    } finally {
      setSearching(false);
    }
  };

  const handleAddressInputChange = (event) => {
    setError("");
    onAddressChange(event.target.value);
    if (location) {
      onLocationChange(null);
    }
  };

  const handleMapPick = (addressLocation) => {
    setError("");
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
      <div className="relative z-0 h-80 overflow-hidden rounded-lg border border-slate-200">
        <AddressPickerMap center={center} location={location} address={address} onPick={handleMapPick} />
      </div>
      {location ? (
        <p className="text-sm text-slate-500">
          Đã ghim: {Number(location.lat).toFixed(6)}, {Number(location.lng).toFixed(6)}
          {isMapPickReady ? ". Nhập địa chỉ nếu muốn tìm vị trí khác." : null}
        </p>
      ) : (
        <p className="text-sm text-slate-500">Bạn có thể tìm địa chỉ hoặc bấm trực tiếp trên bản đồ để ghim vị trí</p>
      )}
    </div>
  );
};

export default AddressSearchMap;
