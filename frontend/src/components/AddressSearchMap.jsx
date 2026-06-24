import { useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Button, Input } from "./Ui.jsx";

const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const MAP_PICKED_LABEL = "Vị trí đã chọn trên bản đồ";

const ClickPicker = ({ onPick }) => {
  useMapEvents({
    click(event) {
      onPick({
        lat: event.latlng.lat,
        lng: event.latlng.lng,
        displayName: MAP_PICKED_LABEL,
      });
    },
  });

  return null;
};

const AddressSearchMap = ({ address, location, onAddressChange, onLocationChange }) => {
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const defaultCenter = [10.762622, 106.660172];
  const center = location ? [Number(location.lat), Number(location.lng)] : defaultCenter;
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
        q: trimmedAddress,
        format: "json",
        limit: "1",
        countrycodes: "vn",
      });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
      const results = await response.json();

      if (!results.length) {
        setError("Không tìm thấy địa chỉ. Vui lòng thử lại.");
        return;
      }

      const result = results[0];
      onLocationChange({
        lat: Number(result.lat),
        lng: Number(result.lon),
        displayName: result.display_name,
      });
      onAddressChange(result.display_name);
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
        <Input
          label="Địa chỉ thực hiện"
          value={address}
          onChange={handleAddressInputChange}
          required
        />
        <div className="flex items-end">
          <Button type="button" className="w-full md:w-auto" onClick={searchAddress} disabled={searching || isMapPickReady}>
            {searchButtonLabel}
          </Button>
        </div>
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <div className="relative z-0 h-80 overflow-hidden rounded-lg border border-slate-200">
        <MapContainer
          key={`${center[0]}-${center[1]}`}
          center={center}
          zoom={location ? 16 : 12}
          className="carego-leaflet-map h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickPicker onPick={handleMapPick} />
          {location ? (
            <Marker position={[Number(location.lat), Number(location.lng)]} icon={markerIcon}>
              <Popup>{location.displayName || address}</Popup>
            </Marker>
          ) : null}
        </MapContainer>
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
