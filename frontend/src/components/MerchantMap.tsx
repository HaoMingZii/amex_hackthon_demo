import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { api } from '../api'

const BOUNDS: Record<string, [[number, number], [number, number]]> = {
  'CN->SG': [[1.22, 103.62], [1.47, 104.05]],
  'SG->JP': [[33.4, 129.8], [43.2, 141.6]],
}

type Point = {
  merchant_id: string
  name: string
  category: string
  lat: number
  lng: number
  score: number
  y_high_potential: number
}

type Hotspot = { name: string; lat: number; lng: number }

type Props = {
  corridor?: string
  activeId: string | null
  onSelect: (id: string) => void
}

export default function MerchantMap({ corridor, activeId, onSelect }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const [points, setPoints] = useState<Point[]>([])
  const [hotspots, setHotspots] = useState<Hotspot[]>([])

  useEffect(() => {
    if (!ref.current || mapRef.current) return
    const map = L.map(ref.current, { zoomControl: true })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map)
    map.setView([1.29, 103.85], 11)
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    api.map(corridor).then((d) => {
      if (cancelled) return
      setPoints(d.points.slice(0, 800))
      const hs = Array.isArray(d.hotspots)
        ? d.hotspots
        : corridor
          ? (d.hotspots as Record<string, Hotspot[]>)[corridor] || []
          : Object.values(d.hotspots as Record<string, Hotspot[]>).flat()
      setHotspots(hs)
    })
    return () => {
      cancelled = true
    }
  }, [corridor])

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()
    points.forEach((p) => {
      const color = p.y_high_potential ? '#006fcf' : '#7a8799'
      const r = 4 + (p.score || 0) * 8
      const m = L.circleMarker([p.lat, p.lng], {
        radius: r,
        color: p.merchant_id === activeId ? '#c4a35a' : color,
        weight: p.merchant_id === activeId ? 3 : 1,
        fillOpacity: 0.55,
        fillColor: color,
      })
      m.bindTooltip(`${p.name}<br/>${p.category} · ${p.score?.toFixed(2)}`)
      m.on('click', () => onSelect(p.merchant_id))
      m.addTo(layer)
    })
    hotspots.forEach((h) => {
      L.circle([h.lat, h.lng], {
        radius: 2000,
        color: '#c4a35a',
        weight: 1,
        fillOpacity: 0.08,
      }).bindTooltip(h.name).addTo(layer)
    })
    const b = corridor ? BOUNDS[corridor] : undefined
    if (b) map.fitBounds(b, { padding: [20, 20] })
    else if (points.length) {
      map.fitBounds(points.map((p) => [p.lat, p.lng]) as [number, number][], { padding: [20, 20], maxZoom: 11 })
    }
  }, [points, hotspots, activeId, corridor, onSelect])

  return <div ref={ref} className="h-full min-h-[420px] w-full" />
}
