import { useEffect, useMemo } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import clsx from 'clsx'
import { MousePointerClick } from 'lucide-react'

const pin = L.divIcon({
  className: 'tripzy-pin',
  iconSize: [34, 34],
  iconAnchor: [17, 34],
  html: `<div style="position:relative;width:34px;height:34px;">
    <div style="position:absolute;inset:0;background:#e5603b;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
      border:2.5px solid #fff;box-shadow:0 4px 10px rgba(15,23,42,.3);"></div>
    <div style="position:absolute;left:12px;top:10px;width:10px;height:10px;border-radius:50%;background:#fff;"></div>
  </div>`,
})

function ClickToPlace({ onChange }) {
  useMapEvents({ click: (event) => onChange({ lat: event.latlng.lat, lng: event.latlng.lng }) })
  return null
}

/** Re-centres when the chosen location changes from outside (e.g. a search result). */
function FollowValue({ value }) {
  const map = useMap()
  const key = value ? `${value.lat.toFixed(5)},${value.lng.toFixed(5)}` : ''
  useEffect(() => {
    // No animation: the dialog may close mid-flight, and Leaflet errors if it's unmounted while animating.
    if (value) map.setView([value.lat, value.lng], Math.max(map.getZoom(), 15), { animate: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- follow only when the position changes
  }, [map, key])
  return null
}

/**
 * Small map for choosing a place's exact location: click to drop the pin,
 * drag it to adjust. `value` = { lat, lng } | null, `center` = where to start.
 */
export function LocationPicker({ value, onChange, center, className, invalid = false }) {
  const start = useMemo(() => (value ? [value.lat, value.lng] : center ? [center.lat, center.lng] : [20, 0]), [value, center])
  const zoom = value ? 15 : center ? 12 : 2

  return (
    <div className={clsx('relative overflow-hidden rounded-2xl ring-1', invalid ? 'ring-red-400' : 'ring-sand-200', className)}>
      <MapContainer center={start} zoom={zoom} scrollWheelZoom className="size-full min-h-56" attributionControl>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickToPlace onChange={onChange} />
        <FollowValue value={value} />
        {value && (
          <Marker
            position={[value.lat, value.lng]}
            icon={pin}
            draggable
            eventHandlers={{
              dragend: (event) => {
                const { lat, lng } = event.target.getLatLng()
                onChange({ lat, lng })
              },
            }}
          />
        )}
      </MapContainer>
      {!value && (
        <p className="pointer-events-none absolute inset-x-0 top-3 z-[400] mx-auto flex w-fit items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow">
          <MousePointerClick className="size-3.5 text-coral-500" /> Click the map to drop a pin
        </p>
      )}
    </div>
  )
}
