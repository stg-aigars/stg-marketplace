'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { MapPin } from '@phosphor-icons/react/ssr';
import {
  Map,
  MapMarker,
  MarkerContent,
  MapPopup,
  MapControls,
  MapClusterLayer,
} from '@/components/ui/map';
import { useMap } from '@/components/ui/map/context';
import { Button } from '@/components/ui';
import type { TerminalOption, TerminalCountry } from '@/lib/services/unisend/types';

interface TerminalMapProps {
  terminals: TerminalOption[];
  selectedTerminal: TerminalOption | null;
  onSelect: (terminal: TerminalOption) => void;
  country: TerminalCountry;
  className?: string;
}

// Country center coordinates and zoom levels
const COUNTRY_CENTERS: Record<TerminalCountry, { lng: number; lat: number; zoom: number }> = {
  LT: { lng: 23.8813, lat: 55.1694, zoom: 7 },  // Lithuania - Kaunas area
  LV: { lng: 24.1052, lat: 56.9496, zoom: 7 },  // Latvia - Riga area
  EE: { lng: 24.7536, lat: 59.4370, zoom: 7 },  // Estonia - Tallinn area
};

// Convert terminals to GeoJSON for clustering
function terminalsToGeoJSON(terminals: TerminalOption[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: terminals.map((terminal) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [parseFloat(terminal.longitude), parseFloat(terminal.latitude)],
      },
      properties: {
        id: terminal.id,
        name: terminal.name,
        city: terminal.city,
        address: terminal.address,
        postalCode: terminal.postalCode,
      },
    })),
  };
}

// Find terminal by ID from list
function findTerminalById(terminals: TerminalOption[], id: string): TerminalOption | undefined {
  return terminals.find((t) => t.id === id);
}

// Inner component that flies to selected terminal (needs map context)
function FlyToHandler({ selectedTerminal }: { selectedTerminal: TerminalOption | null }) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded || !selectedTerminal) return;
    map.flyTo({
      center: [parseFloat(selectedTerminal.longitude), parseFloat(selectedTerminal.latitude)],
      zoom: 14,
      duration: 1500,
    });
  }, [map, isLoaded, selectedTerminal]);

  return null;
}

export function TerminalMap({
  terminals,
  selectedTerminal,
  onSelect,
  country,
  className,
}: TerminalMapProps) {
  const [popupTerminal, setPopupTerminal] = useState<TerminalOption | null>(null);
  const [userLocation, setUserLocation] = useState<{ lng: number; lat: number } | null>(null);

  // Get center for current country
  const center = COUNTRY_CENTERS[country];

  // Convert terminals to GeoJSON for cluster layer
  const geojsonData = useMemo(() => terminalsToGeoJSON(terminals), [terminals]);

  // Handle point click from cluster layer
  const handlePointClick = useCallback(
    (feature: GeoJSON.Feature<GeoJSON.Point>, _coordinates: [number, number]) => {
      const terminalId = feature.properties?.id;
      if (terminalId) {
        const terminal = findTerminalById(terminals, terminalId);
        if (terminal) {
          setPopupTerminal(terminal);
        }
      }
    },
    [terminals]
  );

  // Handle terminal selection from popup
  const handleSelectFromPopup = useCallback(() => {
    if (popupTerminal) {
      onSelect(popupTerminal);
      setPopupTerminal(null);
    }
  }, [popupTerminal, onSelect]);

  // Handle locate callback
  const handleLocate = useCallback((coords: { longitude: number; latitude: number }) => {
    setUserLocation({ lng: coords.longitude, lat: coords.latitude });
  }, []);

  // Close popup when clicking elsewhere
  const handlePopupClose = useCallback(() => {
    setPopupTerminal(null);
  }, []);

  return (
    <div className={`relative w-full h-[420px] rounded-lg overflow-hidden border border-semantic-border-default ${className || ''}`}>
      <Map
        center={[center.lng, center.lat]}
        zoom={center.zoom}
        minZoom={5}
        maxZoom={18}
      >
        {/* Fly to selected terminal */}
        <FlyToHandler selectedTerminal={selectedTerminal} />

        {/* Cluster layer for all terminals */}
        <MapClusterLayer
          data={geojsonData}
          clusterRadius={60}
          clusterMaxZoom={12}
          clusterColors={['#5E81AC', '#88C0D0', '#8FBCBB']}
          clusterThresholds={[10, 50]}
          pointColor="#5E81AC"
          onPointClick={handlePointClick}
        />

        {/* Selected terminal marker (highlighted) */}
        {selectedTerminal && (
          <MapMarker
            longitude={parseFloat(selectedTerminal.longitude)}
            latitude={parseFloat(selectedTerminal.latitude)}
          >
            <MarkerContent className="z-10">
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-semantic-success border-2 border-white shadow-lg flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-white" />
                </div>
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-semantic-success" />
              </div>
            </MarkerContent>
          </MapMarker>
        )}

        {/* User location marker */}
        {userLocation && (
          <MapMarker longitude={userLocation.lng} latitude={userLocation.lat}>
            <MarkerContent>
              <div className="relative">
                <div className="w-4 h-4 rounded-full bg-semantic-brand border-2 border-white shadow-lg animate-pulse" />
                <div className="absolute inset-0 w-4 h-4 rounded-full bg-semantic-brand/30 animate-ping" />
              </div>
            </MarkerContent>
          </MapMarker>
        )}

        {/* Popup for clicked terminal */}
        {popupTerminal && (
          <MapPopup
            longitude={parseFloat(popupTerminal.longitude)}
            latitude={parseFloat(popupTerminal.latitude)}
            closeButton
            onClose={handlePopupClose}
            className="min-w-[200px] max-w-[280px]"
          >
            <div className="space-y-2">
              <h4 className="font-semibold text-semantic-text-heading text-sm">
                {popupTerminal.name}
              </h4>
              <p className="text-xs text-semantic-text-secondary">
                {popupTerminal.address}, {popupTerminal.postalCode}
              </p>
              <p className="text-xs text-semantic-text-secondary">
                {popupTerminal.city}
              </p>
              <Button
                type="button"
                size="sm"
                onClick={handleSelectFromPopup}
                className="w-full mt-2"
              >
                Select terminal
              </Button>
            </div>
          </MapPopup>
        )}

        {/* Map controls */}
        <MapControls
          position="bottom-right"
          showZoom={true}
          showLocate={true}
          onLocate={handleLocate}
        />
      </Map>

      {/* Terminal count indicator */}
      <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-sm border border-semantic-border-default">
        <span className="text-xs font-medium text-semantic-text-heading">
          {terminals.length} terminals
        </span>
      </div>
    </div>
  );
}

export default TerminalMap;
