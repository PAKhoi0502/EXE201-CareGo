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

const MapFocus = ({ position }) => {
  const map = useMap();

  useEffect(() => {
    if (position) {
      map.setView(position, map.getZoom() || 16);
    }
  }, [map, position]);

  return null;
};

const LiveLocationMap = ({ location, locations = [], height = "360px" }) => {
  const fallback = [10.762622, 106.660172];
  const position = location ? [Number(location.lat), Number(location.lng)] : fallback;
  const path = locations
    .filter((item) => item?.lat !== undefined && item?.lng !== undefined)
    .map((item) => [Number(item.lat), Number(item.lng)]);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200" style={{ height }}>
      <MapContainer center={position} zoom={16} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapFocus position={position} />
        {location ? (
          <Marker position={position} icon={markerIcon}>
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
