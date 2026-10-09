import { useEffect, useMemo } from 'react'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import clsx from 'clsx'

function pinIcon({ color, label, active }) {
  const size = active ? 38 : 32
  return L.divIcon({
    className: 'tripzy-pin',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size + 4],
    html: `
      <div style="position:relative;width:${size}px;height:${size}px;">
        <div style="position:absolute;inset:0;background:${color};border-radius:50% 50% 50% 0;transform:rotate(-45deg);
          border:2.5px solid #fff;box-shadow:0 4px 10px rgba(15,23,42,.28);"></div>
        <span style="position:absolute;inset:0;display:grid;place-items:center;padding-bottom:3px;color:#fff;
          font:700 ${active ? 13 : 12}px 'Plus Jakarta Sans',sans-serif;">${label ?? ''}</span>
      </div>`,
  })
}

function FitBounds({ points, padding = 40 }) {
  const map = useMap()
  const key = points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join('|')
  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 14, { animate: true })
      return
    }
    map.fitBounds(
      points.map((p) => [p.lat, p.lng]),
      { padding: [padding, padding], maxZoom: 15, animate: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refit only when the set of coordinates changes
  }, [map, key, padding])
  return null
}

/** Re-measures the map when its container is resized (tabs, toggles). */
function AutoResize() {
  const map = useMap()
  useEffect(() => {
    const container = map.getContainer()
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(container)
    return () => observer.disconnect()
  }, [map])
  return null
}

/**
 * points: [{ id, lat, lng, color, label, title, subtitle }]
 * route: optional ordered [{ lat, lng }] drawn as a dashed line.
 */
export function TripMap({ points, route, center, selectedId, onSelect, className }) {
  const initialCenter = useMemo(() => {
    if (center) return [center.lat, center.lng]
    if (points[0]) return [points[0].lat, points[0].lng]
    return [20.5937, 78.9629]
  }, [center, points])

  return (
    <div className={clsx('overflow-hidden rounded-2xl ring-1 ring-sand-200', className)}>
      <MapContainer center={initialCenter} zoom={points.length ? 12 : 4} scrollWheelZoom className="size-full min-h-64" attributionControl>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} />
        <AutoResize />
        {route && route.length > 1 && (
          <Polyline positions={route.map((p) => [p.lat, p.lng])} pathOptions={{ color: '#1d5967', weight: 3, dashArray: '6 8', opacity: 0.8 }} />
        )}
        {points.map((p) => (
          <Marker
            key={p.id}
            position={[p.lat, p.lng]}
            icon={pinIcon({ color: p.color, label: p.label, active: p.id === selectedId })}
            zIndexOffset={p.id === selectedId ? 1000 : 0}
            eventHandlers={{ click: () => onSelect?.(p.id) }}
          >
            <Popup>
              <p style={{ margin: 0, fontWeight: 700 }}>{p.title}</p>
              {p.subtitle && <p style={{ margin: '2px 0 0', color: '#64748b' }}>{p.subtitle}</p>}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
