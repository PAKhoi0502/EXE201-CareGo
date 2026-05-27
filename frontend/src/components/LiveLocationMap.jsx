import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";

const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const personIcon = L.divIcon({
  className: "",
  html: `
    <div style="
      width: 42px;
      height: 42px;
      border-radius: 9999px;
      background: linear-gradient(135deg, #0f766e, #14b8a6);
      border: 3px solid #ffffff;
      box-shadow: 0 14px 30px rgba(15, 118, 110, 0.35);
      display: grid;
      place-items: center;
    ">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" fill="white"/>
        <path d="M4.8 20.2c.8-3.5 3.6-5.4 7.2-5.4s6.4 1.9 7.2 5.4c.1.5-.3.8-.8.8H5.6c-.5 0-.9-.3-.8-.8Z" fill="white"/>
      </svg>
    </div>
  `,
  iconSize: [42, 42],
  iconAnchor: [21, 21],
  popupAnchor: [0, -22],
});

const MapFocus = ({ position }) => {
  const map = useMap();

  useEffect(() => {
    if (position) {
      map.setView(position, map.getZoom() || 16);
    }
  }, [map, position]);

  return null;
};

const LiveLocationMap = ({ location, locations = [], height = "360px", markerVariant = "pin" }) => {
  const fallback = [10.762622, 106.660172];
  const position = location ? [Number(location.lat), Number(location.lng)] : fallback;
  const activeMarkerIcon = markerVariant === "person" ? personIcon : markerIcon;
  const path = locations
    .filter((item) => item?.lat !== undefined && item?.lng !== undefined)
    .map((item) => [Number(item.lat), Number(item.lng)]);

  return (
    <div className="relative z-0 overflow-hidden rounded-lg border border-slate-200" style={{ height }}>
      <MapContainer center={position} zoom={16} scrollWheelZoom className="carego-leaflet-map h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapFocus position={position} />
        {location ? (
          <Marker position={position} icon={activeMarkerIcon}>
            <Popup>
              {Number(location.lat).toFixed(6)}, {Number(location.lng).toFixed(6)}
            </Popup>
          </Marker>
        ) : null}
        {path.length > 1 ? <Polyline positions={path} color="#0f766e" /> : null}
      </MapContainer>
    </div>
  );
};

export default LiveLocationMap;
