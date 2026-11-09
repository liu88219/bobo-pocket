import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { ResolvedSpot, CategoryDef } from '../types/pocket';
import { useCategories } from './CategoryContext';

const TAIPEI_CENTER: [number, number] = [25.04, 121.53];

function markerIcon(spot: ResolvedSpot, meta: CategoryDef): L.DivIcon {
  const status = spot.mark?.status || 'none';
  const cls = status === 'visited' ? 'bp-marker visited' : status === 'want' ? 'bp-marker want' : 'bp-marker';
  return L.divIcon({
    className: 'bp-marker-wrap',
    html: `<div class="${cls}">${meta.emoji}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -16],
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c);
}

export const MapView: React.FC<{
  spots: ResolvedSpot[];
  onSelect?: (spot: ResolvedSpot) => void;
  className?: string;
  focus?: { lat: number; lng: number; zoom?: number } | null;
  draggablePin?: { lat: number; lng: number; onMove: (lat: number, lng: number) => void } | null;
  myLocation?: { lat: number; lng: number } | null;
}> = ({ spots, onSelect, className = 'h-[60vh]', focus = null, draggablePin = null, myLocation = null }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const pinRef = useRef<L.Marker | null>(null);
  const meRef = useRef<L.Marker | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const { meta: categoryMetaOf } = useCategories();

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: TAIPEI_CENTER,
      zoom: 12,
      zoomControl: true,
      attributionControl: true,
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      className: 'bp-cream-tiles',
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 50);
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      pinRef.current = null;
      meRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const bounds: L.LatLngExpression[] = [];
    for (const s of spots) {
      if (typeof s.lat !== 'number' || typeof s.lng !== 'number') continue;
      const meta = categoryMetaOf(s.category);
      const m = L.marker([s.lat, s.lng], { icon: markerIcon(s, meta) });
      const sub = [s.district, s.mrt].filter(Boolean).join('・');
      m.bindPopup(
        `<div style="min-width:160px"><div style="font-weight:900;font-size:14px;margin-bottom:2px">${escapeHtml(s.name)}</div>` +
          `<div style="color:#8A7E70;font-weight:700">${meta.emoji} ${meta.label}${sub ? ' · ' + escapeHtml(sub) : ''}</div>` +
          (onSelectRef.current
            ? `<button data-spot="${escapeHtml(s.id)}" style="margin-top:8px;background:#F2CA62;border:1px solid #E6BC52;border-radius:12px;padding:6px 12px;font-weight:900;color:#3F2E0C">查看卡片 →</button>`
            : '') +
          `</div>`
      );
      m.on('popupopen', (ev) => {
        const el = (ev as L.PopupEvent).popup.getElement();
        const btn = el?.querySelector('button[data-spot]') as HTMLButtonElement | null;
        if (btn) btn.onclick = () => onSelectRef.current?.(s);
      });
      m.addTo(layer);
      bounds.push([s.lat, s.lng]);
    }
    if (myLocation) {
      if (!meRef.current) {
        meRef.current = L.marker([myLocation.lat, myLocation.lng], {
          icon: L.divIcon({ className: 'bp-marker-wrap', html: '<div class="bp-me-dot"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }),
          interactive: false,
          zIndexOffset: 500,
        }).addTo(map);
      } else {
        meRef.current.setLatLng([myLocation.lat, myLocation.lng]);
      }
      bounds.push([myLocation.lat, myLocation.lng]);
    } else if (meRef.current) {
      meRef.current.remove();
      meRef.current = null;
    }
    if (focus) {
      map.setView([focus.lat, focus.lng], focus.zoom || 15);
    } else if (bounds.length > 1) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [36, 36], maxZoom: 15 });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 15);
    }
    setTimeout(() => map.invalidateSize(), 80);
  }, [spots, focus, myLocation, categoryMetaOf]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!draggablePin) {
      if (pinRef.current) {
        pinRef.current.remove();
        pinRef.current = null;
      }
      return;
    }
    const icon = L.divIcon({
      className: 'bp-marker-wrap',
      html: '<div class="bp-marker" style="border-color:#C83D33">📍</div>',
      iconSize: [36, 36],
      iconAnchor: [18, 34],
    });
    if (!pinRef.current) {
      const marker = L.marker([draggablePin.lat, draggablePin.lng], { icon, draggable: true }).addTo(map);
      marker.on('dragend', () => {
        const p = marker.getLatLng();
        draggablePin.onMove(Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6)));
      });
      pinRef.current = marker;
      map.setView([draggablePin.lat, draggablePin.lng], 16);
    } else {
      pinRef.current.setLatLng([draggablePin.lat, draggablePin.lng]);
    }
    const onClick = (e: L.LeafletMouseEvent) => {
      draggablePin.onMove(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
    };
    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
    };
  }, [draggablePin]);

  return <div ref={containerRef} className={`w-full ${className} rounded-[1.5rem] border border-[#DDD7C9] overflow-hidden shadow-card`} />;
};
