"use client";

/**
 * MapBase — MapLibre GL JS wrapper
 *
 * Used by: BinarySortRenderer, LocationGuessRenderer, SuburbChallengeRenderer.
 *
 * Features:
 * - Dark/light tile switching via CSS variable (--map-tile-style)
 * - Lazy-loaded: MapLibre bundle only loads when a map game is played
 * - Keyboard-accessible pan/zoom (MapLibre built-in)
 * - Respects prefers-reduced-motion (disables fly animations)
 * - Exposes ref so parent renderers can add sources/layers imperatively
 */

import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { captureGameError } from "@/lib/sentry";
import type { Map as MapLibreMap, LngLatLike } from "maplibre-gl";

export interface MapBaseHandle {
  getMap: () => MapLibreMap | null;
  flyTo: (center: LngLatLike, zoom: number) => void;
  flashMarker: (center: LngLatLike, durationMs?: number) => void;
}

interface MapBaseProps {
  center: [number, number]; // [lng, lat]
  zoom: number;
  className?: string;
  onReady?: (map: MapLibreMap) => void;
  interactive?: boolean;
  "aria-label"?: string;
}

const LIGHT_STYLE =
  "https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json";
const DARK_STYLE =
  "https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json";

export const MapBase = forwardRef<MapBaseHandle, MapBaseProps>(
  (
    {
      center,
      zoom,
      className = "",
      onReady,
      interactive = true,
      "aria-label": ariaLabel = "Interactive map",
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<MapLibreMap | null>(null);
    const { resolvedTheme } = useTheme();
    const prefersReducedMotion =
      typeof window !== "undefined"
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false;

    useImperativeHandle(ref, () => ({
      getMap: () => mapRef.current,

      flyTo: (target: LngLatLike, targetZoom: number) => {
        if (!mapRef.current) return;
        if (prefersReducedMotion) {
          mapRef.current.jumpTo({ center: target, zoom: targetZoom });
        } else {
          mapRef.current.flyTo({ center: target, zoom: targetZoom, duration: 800 });
        }
      },

      flashMarker: (target: LngLatLike, durationMs = 1500) => {
        const map = mapRef.current;
        if (!map) return;

        const markerId = "hint-flash-marker";
        const sourceId = "hint-flash-source";

        const [lng, lat] = Array.isArray(target)
          ? (target as [number, number])
          : [(target as { lng: number }).lng ?? 0, (target as { lat: number }).lat ?? 0];

        if (map.getLayer(markerId)) map.removeLayer(markerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);

        map.addSource(sourceId, {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: { type: "Point", coordinates: [lng, lat] },
            properties: {},
          },
        });

        map.addLayer({
          id: markerId,
          type: "circle",
          source: sourceId,
          paint: {
            "circle-radius": 16,
            "circle-color": "#00558C",
            "circle-opacity": 0.7,
            "circle-stroke-width": 3,
            "circle-stroke-color": "#fff",
          },
        });

        setTimeout(() => {
          if (map.getLayer(markerId)) map.removeLayer(markerId);
          if (map.getSource(sourceId)) map.removeSource(sourceId);
        }, durationMs);
      },
    }));

    useEffect(() => {
      if (!containerRef.current || mapRef.current) return;

      let map: MapLibreMap;

      // Lazy-load MapLibre to keep app shell small
      import("maplibre-gl")
        .then(({ Map }) => {
          map = new Map({
            container: containerRef.current!,
            style: resolvedTheme === "dark" ? DARK_STYLE : LIGHT_STYLE,
            center,
            zoom,
            interactive,
            attributionControl: false,
          });

          map.on("load", () => {
            mapRef.current = map;
            onReady?.(map);
          });

          map.on("error", (e) => {
            captureGameError(e.error, { extra: { context: "maplibre_error" } });
          });
        })
        .catch((err) => {
          captureGameError(err, { extra: { context: "maplibre_load_failed" } });
        });

      return () => {
        map?.remove();
        mapRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Switch tile style on theme change
    useEffect(() => {
      if (!mapRef.current) return;
      mapRef.current.setStyle(resolvedTheme === "dark" ? DARK_STYLE : LIGHT_STYLE);
    }, [resolvedTheme]);

    return (
      <div
        ref={containerRef}
        className={className}
        role="application"
        aria-label={ariaLabel}
        tabIndex={0}
        style={{ outline: "none" }}
      />
    );
  }
);

MapBase.displayName = "MapBase";
