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

const ClickPicker = ({ onPick }) => {
  useMapEvents({
    click(event) {
      onPick({
        lat: event.latlng.lat,
        lng: event.latlng.lng,
        displayName: "Vi tri da chon tren ban do",
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

  const searchAddress = async () => {
    if (!address?.trim()) {
      setError("Vui long nhap dia chi truoc khi tim");
      return;
    }

    setSearching(true);
    setError("");
    try {
      const params = new URLSearchParams({
        q: address,
        format: "json",
        limit: "1",
        countrycodes: "vn",
      });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
      const results = await response.json();

      if (!results.length) {
        setError("Khong tim thay dia chi nay");
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
      setError(err.message || "Khong the tim dia chi");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <Input
          label="Dia chi thuc hien"
          value={address}
          onChange={(event) => onAddressChange(event.target.value)}
        />
        <div className="flex items-end">
          <Button type="button" className="w-full md:w-auto" onClick={searchAddress} disabled={searching}>
            {searching ? "Dang tim..." : "Tim tren ban do"}
          </Button>
        </div>
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <div className="h-80 overflow-hidden rounded-lg border border-slate-200">
        <MapContainer key={`${center[0]}-${center[1]}`} center={center} zoom={location ? 16 : 12} className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickPicker onPick={onLocationChange} />
          {location ? (
            <Marker position={[Number(location.lat), Number(location.lng)]} icon={markerIcon}>
              <Popup>{location.displayName || address}</Popup>
            </Marker>
          ) : null}
        </MapContainer>
      </div>
      {location ? (
        <p className="text-sm text-slate-500">
          Da ghim: {Number(location.lat).toFixed(6)}, {Number(location.lng).toFixed(6)}
        </p>
      ) : (
        <p className="text-sm text-slate-500">Ban co the tim dia chi hoac bam truc tiep tren ban do de ghim vi tri.</p>
      )}
    </div>
  );
};

export default AddressSearchMap;
