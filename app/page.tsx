'use client'

import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { SearchBox } from "@mapbox/search-js-react";
import type { SearchBoxRetrieveResponse } from "@mapbox/search-js-core/dist/searchbox/SearchBoxCore";
import type { FeatureCollection, Point, GeoJsonProperties } from "geojson";
const SearchBoxComponent = SearchBox as unknown as React.ComponentType<{
  accessToken: string;
  map?: mapboxgl.Map;
  marker?: boolean | mapboxgl.MarkerOptions;
  mapboxgl?: typeof mapboxgl;
  placeholder?: string;
  onRetrieve?: (res: SearchBoxRetrieveResponse) => void;
}>;

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
};

export default function MapboxMap({
  initialCenter = [-112.0740, 33.4484],
  initialZoom = 11,
  markers = [],
  style = "mapbox://styles/mapbox/streets-v11",
  className = "w-screen h-screen",
}: MapboxMapProps) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);

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

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setMapInstance(null);
      }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          marker={true}
          mapboxgl={mapboxgl}
          placeholder="Search places"
          onRetrieve={(res: SearchBoxRetrieveResponse) => {
            const feature = res.features?.[0];
            const coords = (feature?.geometry as unknown as { coordinates?: [number, number] } | undefined)?.coordinates;
            if (coords && mapRef.current) {
              mapRef.current.flyTo({ center: coords, zoom: Math.max(mapRef.current.getZoom(), 14) });
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
