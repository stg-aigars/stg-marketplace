"use client";

import MapLibreGL, { type PopupOptions } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react/ssr";

import { cn } from "@/lib/cn";
import { useMap, useMarkerContext } from "./context";

export type MarkerPopupProps = {
  /** Popup content */
  children: ReactNode;
  /** Additional CSS classes for the popup container */
  className?: string;
  /** Show a close button in the popup (default: false) */
  closeButton?: boolean;
} & Omit<PopupOptions, "className" | "closeButton">;

export function MarkerPopup({
  children,
  className,
  closeButton = false,
  ...popupOptions
}: MarkerPopupProps) {
  const { markerRef, isReady } = useMarkerContext();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<MapLibreGL.Popup | null>(null);
  const [mounted, setMounted] = useState(false);
  const popupOptionsRef = useRef(popupOptions);

  useEffect(() => {
    if (!isReady || !markerRef.current) return;

    const container = document.createElement("div");
    containerRef.current = container;

    const popup = new MapLibreGL.Popup({
      offset: 16,
      ...popupOptions,
      closeButton: false,
    })
      .setMaxWidth("none")
      .setDOMContent(container);

    popupRef.current = popup;
    markerRef.current.setPopup(popup);
    setMounted(true);

    return () => {
      popup.remove();
      popupRef.current = null;
      containerRef.current = null;
      setMounted(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- popup setup should only run when marker is ready, options handled by separate effect
  }, [isReady]);

  useEffect(() => {
    if (!popupRef.current) return;
    const prev = popupOptionsRef.current;

    if (prev.offset !== popupOptions.offset) {
      popupRef.current.setOffset(popupOptions.offset ?? 16);
    }
    if (prev.maxWidth !== popupOptions.maxWidth && popupOptions.maxWidth) {
      popupRef.current.setMaxWidth(popupOptions.maxWidth ?? "none");
    }

    popupOptionsRef.current = popupOptions;
  }, [popupOptions]);

  const handleClose = () => popupRef.current?.remove();

  if (!mounted || !containerRef.current) return null;

  return createPortal(
    <div
      className={cn(
        "relative rounded-md border border-semantic-border-default bg-semantic-bg-elevated p-3 text-semantic-text-primary shadow-md",
        className
      )}
    >
      {closeButton && (
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-1 right-1 z-10 rounded-sm opacity-70 transition-opacity duration-250 ease-out-custom hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-semantic-brand/20"
          aria-label="Close popup"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
      )}
      {children}
    </div>,
    containerRef.current
  );
}

export type MarkerTooltipProps = {
  /** Tooltip content */
  children: ReactNode;
  /** Additional CSS classes for the tooltip container */
  className?: string;
} & Omit<PopupOptions, "className" | "closeButton" | "closeOnClick">;

export function MarkerTooltip({
  children,
  className,
  ...popupOptions
}: MarkerTooltipProps) {
  const { markerRef, markerElementRef, map, isReady } = useMarkerContext();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<MapLibreGL.Popup | null>(null);
  const [mounted, setMounted] = useState(false);
  const popupOptionsRef = useRef(popupOptions);

  useEffect(() => {
    if (!isReady || !markerRef.current || !markerElementRef.current || !map)
      return;

    const container = document.createElement("div");
    containerRef.current = container;

    const popup = new MapLibreGL.Popup({
      offset: 16,
      ...popupOptions,
      closeOnClick: true,
      closeButton: false,
    })
      .setMaxWidth("none")
      .setDOMContent(container);

    popupRef.current = popup;

    const markerElement = markerElementRef.current;
    const marker = markerRef.current;

    const handleMouseEnter = () => {
      popup.setLngLat(marker.getLngLat()).addTo(map);
    };
    const handleMouseLeave = () => popup.remove();

    markerElement.addEventListener("mouseenter", handleMouseEnter);
    markerElement.addEventListener("mouseleave", handleMouseLeave);
    setMounted(true);

    return () => {
      markerElement.removeEventListener("mouseenter", handleMouseEnter);
      markerElement.removeEventListener("mouseleave", handleMouseLeave);
      popup.remove();
      popupRef.current = null;
      containerRef.current = null;
      setMounted(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hover popup setup should only run when marker/map is ready, options handled by separate effect
  }, [isReady, map]);

  useEffect(() => {
    if (!popupRef.current) return;
    const prev = popupOptionsRef.current;

    if (prev.offset !== popupOptions.offset) {
      popupRef.current.setOffset(popupOptions.offset ?? 16);
    }
    if (prev.maxWidth !== popupOptions.maxWidth && popupOptions.maxWidth) {
      popupRef.current.setMaxWidth(popupOptions.maxWidth ?? "none");
    }

    popupOptionsRef.current = popupOptions;
  }, [popupOptions]);

  if (!mounted || !containerRef.current) return null;

  return createPortal(
    <div
      className={cn(
        "rounded-md bg-semantic-text-heading px-2 py-1 text-xs text-semantic-text-inverse shadow-md",
        className
      )}
    >
      {children}
    </div>,
    containerRef.current
  );
}

export type MapPopupProps = {
  /** Longitude coordinate for popup position */
  longitude: number;
  /** Latitude coordinate for popup position */
  latitude: number;
  /** Callback when popup is closed */
  onClose?: () => void;
  /** Popup content */
  children: ReactNode;
  /** Additional CSS classes for the popup container */
  className?: string;
  /** Show a close button in the popup (default: false) */
  closeButton?: boolean;
} & Omit<PopupOptions, "className" | "closeButton">;

export function MapPopup({
  longitude,
  latitude,
  onClose,
  children,
  className,
  closeButton = false,
  ...popupOptions
}: MapPopupProps) {
  const { map } = useMap();
  const popupRef = useRef<MapLibreGL.Popup | null>(null);
  const popupOptionsRef = useRef(popupOptions);

  const container = useMemo(() => document.createElement("div"), []);

  useEffect(() => {
    if (!map) return;

    const popup = new MapLibreGL.Popup({
      offset: 16,
      ...popupOptions,
      closeButton: false,
    })
      .setMaxWidth("none")
      .setDOMContent(container)
      .setLngLat([longitude, latitude])
      .addTo(map);

    const onCloseProp = () => onClose?.();

    popup.on("close", onCloseProp);

    popupRef.current = popup;

    return () => {
      popup.off("close", onCloseProp);
      if (popup.isOpen()) {
        popup.remove();
      }
      popupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- standalone popup setup should only run when map is ready, position/options handled by separate effects
  }, [map]);

  useEffect(() => {
    popupRef.current?.setLngLat([longitude, latitude]);
  }, [longitude, latitude]);

  useEffect(() => {
    if (!popupRef.current) return;
    const prev = popupOptionsRef.current;

    if (prev.offset !== popupOptions.offset) {
      popupRef.current.setOffset(popupOptions.offset ?? 16);
    }
    if (prev.maxWidth !== popupOptions.maxWidth && popupOptions.maxWidth) {
      popupRef.current.setMaxWidth(popupOptions.maxWidth ?? "none");
    }

    popupOptionsRef.current = popupOptions;
  }, [popupOptions]);

  const handleClose = () => {
    popupRef.current?.remove();
    onClose?.();
  };

  return createPortal(
    <div
      className={cn(
        "relative rounded-md border border-semantic-border-default bg-semantic-bg-elevated p-3 text-semantic-text-primary shadow-md",
        className
      )}
    >
      {closeButton && (
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-1 right-1 z-10 rounded-sm opacity-70 transition-opacity duration-250 ease-out-custom hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-semantic-brand/20"
          aria-label="Close popup"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
      )}
      {children}
    </div>,
    container
  );
}
