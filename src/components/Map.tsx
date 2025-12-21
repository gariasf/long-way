'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Stop, StopType } from '@/lib/types';

// Fix for default marker icons in Leaflet with webpack
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom marker icons by stop type
const markerColors: Record<StopType, string> = {
  base_camp: '#2563eb', // blue
  waypoint: '#16a34a', // green
  stop: '#71717a', // zinc
  transport: '#9333ea', // purple
};

function createIcon(type: StopType, isOptional: boolean): L.DivIcon {
  const color = markerColors[type];
  const opacity = isOptional ? '0.6' : '1';
  const borderStyle = isOptional ? 'dashed' : 'solid';

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 24px;
        height: 24px;
        background-color: ${color};
        opacity: ${opacity};
        border: 2px ${borderStyle} white;
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      "></div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
}

// Component to fit map bounds to stops
function FitBounds({ stops }: { stops: Stop[] }) {
  const map = useMap();

  useEffect(() => {
    if (stops.length === 0) return;

    const bounds = L.latLngBounds(
      stops.map(stop => [stop.latitude, stop.longitude] as [number, number])
    );

    map.fitBounds(bounds, { padding: [50, 50] });
  }, [stops, map]);

  return null;
}

interface MapProps {
  stops: Stop[];
  onStopClick?: (stop: Stop) => void;
}

export function Map({ stops, onStopClick }: MapProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="w-full h-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
        <div className="text-zinc-500">Loading map...</div>
      </div>
    );
  }

  // Default center (Europe) if no stops
  const defaultCenter: [number, number] = [48.8566, 2.3522]; // Paris
  const defaultZoom = 5;

  // Get route coordinates (only non-optional stops for the main route)
  const routeStops = stops.filter(s => !s.is_optional);
  const routeCoords: [number, number][] = routeStops.map(s => [s.latitude, s.longitude]);

  return (
    <MapContainer
      center={stops.length > 0 ? [stops[0].latitude, stops[0].longitude] : defaultCenter}
      zoom={defaultZoom}
      className="w-full h-full"
      style={{ background: '#f4f4f5' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Route line connecting non-optional stops */}
      {routeCoords.length > 1 && (
        <Polyline
          positions={routeCoords}
          color="#3b82f6"
          weight={3}
          opacity={0.7}
        />
      )}

      {/* Stop markers */}
      {stops.map((stop, index) => (
        <Marker
          key={stop.id}
          position={[stop.latitude, stop.longitude]}
          icon={createIcon(stop.type, stop.is_optional)}
          eventHandlers={{
            click: () => onStopClick?.(stop),
          }}
        >
          <Popup>
            <div className="min-w-[150px]">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">
                  {index + 1}
                </span>
                <span className="font-semibold">{stop.name}</span>
              </div>
              {stop.description && (
                <p className="text-sm text-zinc-600 mb-1">{stop.description}</p>
              )}
              <div className="text-xs text-zinc-500">
                <span className="capitalize">{stop.type.replace('_', ' ')}</span>
                {stop.duration_value && stop.duration_unit && (
                  <span> · {stop.duration_value} {stop.duration_unit}</span>
                )}
                {stop.is_optional && <span className="text-amber-600"> · Optional</span>}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Fit bounds when stops change */}
      {stops.length > 0 && <FitBounds stops={stops} />}
    </MapContainer>
  );
}
