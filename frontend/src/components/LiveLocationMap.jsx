import { useEffect, useMemo, useRef, useState } from "react";
import vietmapgl from "@vietmap/vietmap-gl-js/dist/vietmap-gl.js";
import "@vietmap/vietmap-gl-js/dist/vietmap-gl.css";
import { DEFAULT_MAP_CENTER, getVietmapStyleUrl, hasVietmapMapKey } from "../utils/mapProvider.js";

const ROUTE_SOURCE_ID = "carego-live-route";
const ROUTE_LAYER_ID = "carego-live-route-line";

const getValidLngLat = (point) => {
  const lat = Number(point?.lat);
  const lng = Number(point?.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return [lng, lat];
};

const buildPinElement = () => {
  const element = document.createElement("div");
  element.className = "carego-map-pin";
  element.setAttribute("aria-hidden", "true");
  return element;
};

const buildPersonElement = () => {
  const element = document.createElement("div");
  element.className = "carego-map-person";
  element.setAttribute("aria-hidden", "true");
  element.innerHTML = `
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" fill="white"/>
      <path d="M4.8 20.2c.8-3.5 3.6-5.4 7.2-5.4s6.4 1.9 7.2 5.4c.1.5-.3.8-.8.8H5.6c-.5 0-.9-.3-.8-.8Z" fill="white"/>
    </svg>
  `;
  return element;
};

const getPathGeoJson = (path) => {
  if (path.length < 2) {
    return {
      type: "FeatureCollection",
      features: [],
    };
  }

  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: path.map(([lat, lng]) => [lng, lat]),
    },
  };
};

const LiveLocationMap = ({ location, locations = [], height = "360px", markerVariant = "pin" }) => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const hasMapKey = hasVietmapMapKey();
  const position = location
    ? { lat: Number(location.lat), lng: Number(location.lng) }
    : DEFAULT_MAP_CENTER;
  const [initialPosition] = useState(() => position);
  const path = useMemo(
    () =>
      locations
        .filter((item) => item?.lat !== undefined && item?.lng !== undefined)
        .map((item) => [Number(item.lat), Number(item.lng)]),
    [locations],
  );

  useEffect(() => {
    if (!containerRef.current || !hasMapKey) return undefined;

    const map = new vietmapgl.Map({
      container: containerRef.current,
      style: getVietmapStyleUrl(),
      center: [initialPosition.lng, initialPosition.lat],
      zoom: 16,
      attributionControl: true,
    });

    map.addControl(new vietmapgl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => setMapReady(true));
    mapRef.current = map;

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      setMapReady(false);
      map.remove();
      mapRef.current = null;
    };
  }, [hasMapKey, initialPosition.lat, initialPosition.lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    map.easeTo({
      center: [position.lng, position.lat],
      zoom: map.getZoom() || 16,
      duration: 450,
    });
  }, [position.lat, position.lng]);

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

    const popupText = `${lngLat[1].toFixed(6)}, ${lngLat[0].toFixed(6)}`;

    if (!markerRef.current) {
      markerRef.current = new vietmapgl.Marker({
        element: markerVariant === "person" ? buildPersonElement() : buildPinElement(),
        anchor: markerVariant === "person" ? "center" : "bottom",
      })
        .setLngLat(lngLat)
        .addTo(map);
    }

    markerRef.current
      .setLngLat(lngLat)
      .setPopup(new vietmapgl.Popup({ offset: markerVariant === "person" ? 24 : 28 }).setText(popupText));
  }, [location, markerVariant]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    if (!map.getSource(ROUTE_SOURCE_ID)) {
      map.addSource(ROUTE_SOURCE_ID, {
        type: "geojson",
        data: getPathGeoJson(path),
      });
      map.addLayer({
        id: ROUTE_LAYER_ID,
        type: "line",
        source: ROUTE_SOURCE_ID,
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#0f766e",
          "line-width": 4,
          "line-opacity": 0.85,
        },
      });
      return;
    }

    map.getSource(ROUTE_SOURCE_ID)?.setData(getPathGeoJson(path));
  }, [mapReady, path]);

  return (
    <div className="relative z-0 overflow-hidden rounded-lg border border-slate-200" style={{ height }}>
      {hasMapKey ? (
        <div ref={containerRef} className="carego-vietmap-map h-full w-full" />
      ) : (
        <div className="grid h-full place-items-center bg-slate-50 p-5 text-center text-sm font-semibold text-slate-500">
          Cần cấu hình VITE_VIETMAP_TILE_API_KEY để hiển thị bản đồ Vietmap.
        </div>
      )}
    </div>
  );
};

export default LiveLocationMap;
