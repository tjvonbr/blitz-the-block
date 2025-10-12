"use client"

import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import dynamic from "next/dynamic";
import { SearchBoxCore } from "@mapbox/search-js-core";
import type { SearchBoxRetrieveResponse, SearchBoxReverseResponse } from "@mapbox/search-js-core";
import type { FeatureCollection, Point, GeoJsonProperties, Polygon } from "geojson";
type FeaturePropsMinimal = { full_address?: string; address?: string; place_formatted?: string };
type SearchBoxComponentProps = {
  accessToken: string;
  map?: mapboxgl.Map;
  marker?: boolean | mapboxgl.MarkerOptions;
  mapboxgl?: typeof mapboxgl;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onRetrieve?: (res: SearchBoxRetrieveResponse) => void;
};
const SearchBoxComponent = dynamic(() => import("@mapbox/search-js-react").then(m => m.SearchBox as unknown as React.ComponentType<SearchBoxComponentProps>), { ssr: false }) as unknown as React.ComponentType<SearchBoxComponentProps>;

type Marker = {
  id: string;
  title?: string;
  coordinates: [number, number];
  properties?: Record<string, unknown>;
};

type MapboxMapProps = {
  initialCenter?: [number, number];
  initialZoom?: number;
  markers?: Marker[];
  style?: string;
  className?: string;
  alertAddress?: string;
};

export default function MapScreen({
  initialCenter = [-112.0740, 33.4484],
  initialZoom = 11,
  markers = [],
  style = "mapbox://styles/mapbox/streets-v11",
  className = "w-screen h-screen",
  alertAddress,
}: MapboxMapProps) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);
  const markersRef = useRef<Array<{ id: number; marker: mapboxgl.Marker; circleSourceId: string; circleFillLayerId: string; circleOutlineLayerId: string }>>([]);
  const markerIdCounterRef = useRef<number>(0);
  const [searchValue, setSearchValue] = useState<string>("");
  const searchCoreRef = useRef<SearchBoxCore | null>(null);

  const accessToken = 'pk.eyJ1IjoidGp2b25iciIsImEiOiJjbHg1N3hqemUxaTl3MmpvcnN4MWxwbWNpIn0.hipBsL0nFRpwDHgiSoiEmA'

  useEffect(() => {
    if (!accessToken) {
      console.error("Mapbox access token is required. Provide accessToken prop or set REACT_APP_MAPBOX_ACCESS_TOKEN.");
      return;
    }

    mapboxgl.accessToken = accessToken;

    if (mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current as HTMLElement,
      style,
      center: initialCenter as mapboxgl.LngLatLike,
      zoom: initialZoom,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.addControl(new mapboxgl.ScaleControl({ maxWidth: 100, unit: "imperial" }));
    map.addControl(new mapboxgl.FullscreenControl());
    map.addControl(new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true,
    }));

    map.on("load", () => {
      map.addSource("markers", {
        type: "geojson",
        data: makeGeoJSON(markers),
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });

      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "markers",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": ["step", ["get", "point_count"], "#51bbd6", 10, "#f1f075", 30, "#f28cb1"],
          "circle-radius": ["step", ["get", "point_count"], 15, 10, 20, 30, 25],
        },
      });

      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "markers",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
          "text-size": 12,
        },
      });

      map.addLayer({
        id: "unclustered-point",
        type: "circle",
        source: "markers",
        filter: ["!has", "point_count"],
        paint: {
          "circle-color": "#11b4da",
          "circle-radius": 8,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#fff",
        },
      });

      map.on("click", "clusters", (e: mapboxgl.MapLayerMouseEvent) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
        if (!features.length) return;
        const clusterId = (features[0].properties as { cluster_id: number }).cluster_id;
        const src = map.getSource("markers") as mapboxgl.GeoJSONSource;
        src.getClusterExpansionZoom(clusterId, (error, zoom) => {
          if (error) return;
          const coords = (features[0].geometry as unknown as { coordinates: [number, number] }).coordinates;
          map.easeTo({ center: coords, zoom: zoom ?? map.getZoom() });
        });
      });

      map.on("click", "unclustered-point", (e: mapboxgl.MapLayerMouseEvent) => {
        const f = e.features?.[0];
        if (!f) return;
        const coords = (f.geometry as unknown as { coordinates: [number, number] }).coordinates.slice() as [number, number];
        const { title, id } = (f.properties as { title?: string; id?: string }) || {};

        while (Math.abs(e.lngLat.lng - coords[0]) > 180) {
          coords[0] += e.lngLat.lng > coords[0] ? 360 : -360;
        }

        new mapboxgl.Popup().setLngLat(coords).setHTML(`<strong>${escapeHtml(title || "Marker")}</strong><div>ID: ${escapeHtml(id || "-")}</div>`).addTo(map);
      });

      map.on("mouseenter", "clusters", () => map.getCanvas().style.cursor = "pointer");
      map.on("mouseleave", "clusters", () => map.getCanvas().style.cursor = "");
      map.on("mouseenter", "unclustered-point", () => map.getCanvas().style.cursor = "pointer");
      map.on("mouseleave", "unclustered-point", () => map.getCanvas().style.cursor = "");
    });

    mapRef.current = map;
    setMapInstance(map);
    searchCoreRef.current = new SearchBoxCore({ accessToken });
    // Allow clicking on the map to drop additional pins with 1-mile radius
    map.on('click', (e: mapboxgl.MapMouseEvent) => {
      addMarkerWithCircle([e.lngLat.lng, e.lngLat.lat]);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setMapInstance(null);
        markersRef.current = [];
        searchCoreRef.current = null;
      }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addMarkerWithCircleAt(map: mapboxgl.Map, lngLat: [number, number], ctx: {
    markersRef: React.MutableRefObject<Array<{ id: number; marker: mapboxgl.Marker; circleSourceId: string; circleFillLayerId: string; circleOutlineLayerId: string }>>;
    markerIdCounterRef: React.MutableRefObject<number>;
    searchCoreRef: React.MutableRefObject<SearchBoxCore | null>;
    setSearchValue: (v: string) => void;
    alertAddress?: string;
  }) {
    const id = ++ctx.markerIdCounterRef.current;
    const circleSourceId = `radius-source-${id}`;
    const circleFillId = `radius-fill-${id}`;
    const circleOutlineId = `radius-outline-${id}`;
    const marker = new mapboxgl.Marker({ draggable: true }).setLngLat(lngLat).addTo(map);
  
    // initial circle
    const circle = makeCircle(lngLat, 1609.34);
    map.addSource(circleSourceId, { type: 'geojson', data: circle });
    map.addLayer({ id: circleFillId, type: 'fill', source: circleSourceId, paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.15 } });
    map.addLayer({ id: circleOutlineId, type: 'line', source: circleSourceId, paint: { 'line-color': '#3b82f6', 'line-width': 2 } });
  
    const record = { id, marker, circleSourceId, circleFillLayerId: circleFillId, circleOutlineLayerId: circleOutlineId };
    ctx.markersRef.current.push(record);
  
    marker.on('dragstart', () => {
      map.dragPan.disable();
      const el = marker.getElement();
      if (el) el.style.cursor = 'grabbing';
    });
    marker.on('dragend', async () => {
      map.dragPan.enable();
      const el = marker.getElement();
      if (el) el.style.cursor = 'grab';
      const p = marker.getLngLat();
      const src = map.getSource(circleSourceId) as mapboxgl.GeoJSONSource | undefined;
      if (src) src.setData(makeCircle([p.lng, p.lat], 1609.34));
  
      try {
        const core = ctx.searchCoreRef.current;
        if (!core) return;
        const resp: SearchBoxReverseResponse = await core.reverse({ lng: p.lng, lat: p.lat });
        const f = resp.features?.[0];
        const props = f?.properties as FeaturePropsMinimal | undefined;
        const addr = props?.full_address || props?.address || props?.place_formatted || '';
        ctx.setSearchValue(addr);
        if (ctx.alertAddress && addr && addr.toLowerCase() === ctx.alertAddress.toLowerCase()) {
          window.alert(`Selected address matched: ${addr}`);
        }
      } catch (e) {
        console.error('Reverse geocode failed', e);
      }
    });
  }

  // Component-scoped helper: add marker + circle with current refs
  function addMarkerWithCircle(lngLat: [number, number]) {
    const map = mapRef.current;
    if (!map) return;
    addMarkerWithCircleAt(map, lngLat, {
      markersRef,
      markerIdCounterRef,
      searchCoreRef,
      setSearchValue,
      alertAddress,
    });
  }

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!map.isStyleLoaded()) {
      const timer = setTimeout(() => {
        const source = map.getSource("markers");
        if (source && (source as mapboxgl.GeoJSONSource).setData) (source as mapboxgl.GeoJSONSource).setData(makeGeoJSON(markers));
      }, 500);
      return () => clearTimeout(timer);
    }

    const source = map.getSource("markers");
    if (source && (source as mapboxgl.GeoJSONSource).setData) (source as mapboxgl.GeoJSONSource).setData(makeGeoJSON(markers));
  }, [markers]);

  return (
    <div className={`${className} relative`}>
      <div className="absolute z-10 top-4 left-1/2 -translate-x-1/2 w-full max-w-xl px-4">
        <SearchBoxComponent
          accessToken={accessToken}
          map={mapInstance ?? undefined}
          marker={false}
          mapboxgl={mapboxgl}
          placeholder="Search places"
          value={searchValue}
          onChange={(v: string) => setSearchValue(v)}
          onRetrieve={(res: SearchBoxRetrieveResponse) => {
            const feature = res.features?.[0];
            const props = feature?.properties as FeaturePropsMinimal | undefined;
            const coords = (feature?.geometry as unknown as { coordinates?: [number, number] } | undefined)?.coordinates;
            if (coords && mapRef.current) {
              mapRef.current.flyTo({ center: coords, zoom: Math.max(mapRef.current.getZoom(), 14) });
              addMarkerWithCircle(coords);
            }
            const selectedAddress = props?.full_address || props?.address || props?.place_formatted;
            if (alertAddress && selectedAddress && selectedAddress.toLowerCase() === alertAddress.toLowerCase()) {
              window.alert(`Selected address matched: ${selectedAddress}`);
            }
            if (coords && mapRef.current) {
              // also add a marker + circle for the retrieved result
              addMarkerWithCircle(coords);
            }
          }}
        />
      </div>
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
}

function makeGeoJSON(items: Marker[]): FeatureCollection<Point, GeoJsonProperties> {
  return {
    type: "FeatureCollection",
    features: (items || []).map((m) => ({
      type: "Feature",
      properties: {
        id: m.id,
        title: m.title || m.id,
        ...(m.properties || {}),
      },
      geometry: {
        type: "Point",
        coordinates: [Number(m.coordinates[0]), Number(m.coordinates[1])],
      },
    })),
  } as FeatureCollection<Point, GeoJsonProperties>;
}

function escapeHtml(str?: string | number | null) {
  if (str == null) return "";
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  };
  return String(str).replace(/[&<>"]+/g, (s) => map[s] || s);
}

// Approximate a circle polygon using 64 sides
function makeCircle(center: [number, number], radiusMeters: number, steps = 64): FeatureCollection<Polygon> {
  const [lng, lat] = center;
  const coordinates: [number, number][] = [];
  const earthRadius = 6371008.8; // meters
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  const angularDistance = radiusMeters / earthRadius;

  for (let i = 0; i <= steps; i++) {
    const bearing = (i * 360 / steps) * Math.PI / 180;
    const lat2 = Math.asin(
      Math.sin(latRad) * Math.cos(angularDistance) +
      Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearing)
    );
    const lng2 = lngRad + Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latRad),
      Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(lat2)
    );
    coordinates.push([(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI]);
  }

  const polygon: FeatureCollection<Polygon> = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [coordinates],
        },
      },
    ],
  };
  return polygon;
}
