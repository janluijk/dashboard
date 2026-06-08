'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl, { Map as MlMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { decodePolyline } from '@/lib/strava/polyline';
import { AppNav } from '@/components/AppNav';

const STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const SEGMENTS_SOURCE_ID = 'fav-segments';
const SEGMENTS_LAYER_ID = 'fav-segments-line';
const SEGMENTS_HALO_LAYER_ID = 'fav-segments-halo';
const SEGMENTS_HELD_GLOW_LAYER_ID = 'fav-segments-held-glow';
const SEGMENTS_HELD_LAYER_ID = 'fav-segments-held';
const PINS_SOURCE_ID = 'fav-pins';
const PINS_LAYER_ID = 'fav-pins-circle';
const PINS_HELD_GLOW_LAYER_ID = 'fav-pins-held-glow';
const PINS_HELD_LAYER_ID = 'fav-pins-held';

const COLOR_HELD = '#F2C94C';
const COLOR_CHASE = '#FC5200';
const COLOR_NONE = '#9CA3AF';

function segmentState(s: { isYouTheLegend: boolean; leaderCountOverall: number | null }): 'held' | 'chase' | 'none' {
  if (s.isYouTheLegend) return 'held';
  if (s.leaderCountOverall !== null) return 'chase';
  return 'none';
}

const DEEP: [number, number, number] = [255, 228, 138]; // #FFE48A warm yellow
const MID: [number, number, number] = [255, 240, 180]; // #FFF0B4
const BRIGHT: [number, number, number] = [255, 252, 220]; // #FFFCDC near-white

function lerp(a: [number, number, number], b: [number, number, number], t: number): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bb = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bb})`;
}

function brightnessToColor(b: number): string {
  const c = Math.max(0, Math.min(1, b));
  if (c < 0.5) return lerp(DEEP, MID, c / 0.5);
  return lerp(MID, BRIGHT, (c - 0.5) / 0.5);
}

const SHIMMER_SAMPLES = 28;
const SHIMMER_SHARPNESS = 80;

function buildShimmerGradient(phase: number): maplibregl.ExpressionSpecification {
  const cycle = phase % 1;
  const peak = cycle;
  const intensity = Math.sin(cycle * Math.PI);
  const stops: (number | string)[] = [];
  for (let i = 0; i <= SHIMMER_SAMPLES; i++) {
    const x = i / SHIMMER_SAMPLES;
    const d = Math.abs(x - peak);
    const brightness = intensity * Math.exp(-d * d * SHIMMER_SHARPNESS);
    stops.push(x, brightnessToColor(brightness));
  }
  return [
    'interpolate',
    ['linear'],
    ['line-progress'],
    ...stops,
  ] as maplibregl.ExpressionSpecification;
}

function fitToSegment(map: MlMap, s: { polyline: string }) {
  const coords = decodePolyline(s.polyline);
  if (coords.length === 0) return;
  const lats = coords.map((c) => c[0]);
  const lngs = coords.map((c) => c[1]);
  map.fitBounds(
    [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ],
    { padding: 80, maxZoom: 16, duration: 600 }
  );
}

export type FavoriteSegment = {
  id: number;
  name: string;
  polyline: string;
  startLat: number;
  startLng: number;
  distanceM: number;
  avgGrade: number;
  localLegendEnabled: boolean;
  leaderCountOverall: number | null;
  athleteRecent90d: number | null;
  isYouTheLegend: boolean;
  detailsFetchedAt: string | null;
  effortsFetchedAt: string | null;
  favorite: boolean;
};

function formatKm(meters: number): string {
  return `${(meters / 1000).toFixed(2)} km`;
}

function formatRefreshedAgo(iso: string | null): string | null {
  if (!iso) return null;
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 0) return 'just now';
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

export function FavoritesView({ items: initialItems }: { items: FavoriteSegment[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const shimmerRafRef = useRef<number | null>(null);
  const heldLayersRef = useRef<Set<number>>(new Set());
  const heldPhaseRef = useRef<Map<number, number>>(new Map());
  const [items, setItems] = useState<FavoriteSegment[]>(initialItems);
  const itemsRef = useRef<FavoriteSegment[]>(initialItems);
  itemsRef.current = items;
  const [stillFavorite, setStillFavorite] = useState<Set<number>>(
    () => new Set(initialItems.map((i) => i.id))
  );
  const stillFavoriteRef = useRef<Set<number>>(stillFavorite);
  stillFavoriteRef.current = stillFavorite;
  const [refreshingIds, setRefreshingIds] = useState<Set<number>>(() => new Set());
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'favorites'>('all');
  const filterRef = useRef<'all' | 'favorites'>(filter);
  filterRef.current = filter;
  const [sortBy, setSortBy] = useState<'distance_to_claim' | 'attempts_to_claim' | 'segment_distance'>(
    'distance_to_claim'
  );

  useEffect(() => {
    const container = containerRef.current;
    const hasContainer = !!container;
    if (!hasContainer) {
      return;
    }
    const hasItems = items.length > 0;
    const center: [number, number] = hasItems
      ? [items[0].startLng, items[0].startLat]
      : [4.9041, 52.3676];

    const map = new maplibregl.Map({
      container,
      style: STYLE_URL,
      center,
      zoom: hasItems ? 12 : 6,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      map.addSource(SEGMENTS_SOURCE_ID, {
        type: 'geojson',
        lineMetrics: true,
        data: {
          type: 'FeatureCollection',
          features: items.map((s) => ({
            type: 'Feature',
            id: s.id,
            properties: { id: s.id, state: segmentState(s) },
            geometry: {
              type: 'LineString',
              coordinates: decodePolyline(s.polyline).map(([lat, lng]) => [lng, lat]),
            },
          })),
        },
      });
      const colorByState: maplibregl.ExpressionSpecification = [
        'match',
        ['get', 'state'],
        'held',
        COLOR_HELD,
        'chase',
        COLOR_CHASE,
        COLOR_NONE,
      ];
      map.addLayer({
        id: SEGMENTS_HALO_LAYER_ID,
        source: SEGMENTS_SOURCE_ID,
        type: 'line',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#1f2937',
          'line-width': 12,
          'line-opacity': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            0.35,
            0,
          ],
        },
      });
      map.addLayer({
        id: SEGMENTS_LAYER_ID,
        source: SEGMENTS_SOURCE_ID,
        type: 'line',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': colorByState,
          'line-width': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            7,
            4,
          ],
          'line-opacity': 0.95,
        },
      });
      map.on('mouseenter', SEGMENTS_LAYER_ID, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', SEGMENTS_LAYER_ID, () => {
        map.getCanvas().style.cursor = '';
      });
      map.on('click', SEGMENTS_LAYER_ID, (e) => {
        const f = e.features?.[0];
        const fid = f?.id;
        if (fid === undefined) return;
        setSelectedId(Number(fid));
      });

      map.addLayer({
        id: SEGMENTS_HELD_GLOW_LAYER_ID,
        source: SEGMENTS_SOURCE_ID,
        type: 'line',
        filter: ['==', ['get', 'state'], 'held'],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#E8C766',
          'line-width': 18,
          'line-blur': 8,
          'line-opacity': 0.45,
        },
      });
      syncHeldLayers();
      map.addSource(PINS_SOURCE_ID, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: items.map((s) => ({
            type: 'Feature',
            id: s.id,
            properties: { id: s.id, state: segmentState(s) },
            geometry: { type: 'Point', coordinates: [s.startLng, s.startLat] },
          })),
        },
      });
      map.addLayer({
        id: PINS_LAYER_ID,
        source: PINS_SOURCE_ID,
        type: 'circle',
        paint: {
          'circle-radius': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            10,
            6,
          ],
          'circle-color': colorByState,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      });
      map.addLayer({
        id: PINS_HELD_GLOW_LAYER_ID,
        source: PINS_SOURCE_ID,
        type: 'circle',
        filter: ['==', ['get', 'state'], 'held'],
        paint: {
          'circle-radius': 20,
          'circle-color': '#FFD24A',
          'circle-blur': 1,
          'circle-opacity': 0.6,
        },
      });
      map.addLayer({
        id: PINS_HELD_LAYER_ID,
        source: PINS_SOURCE_ID,
        type: 'circle',
        filter: ['==', ['get', 'state'], 'held'],
        paint: {
          'circle-radius': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            12,
            8,
          ],
          'circle-color': '#FFE48A',
          'circle-stroke-color': '#B8860B',
          'circle-stroke-width': 2,
        },
      });

      if (hasItems) {
        const coords = items.flatMap((s) =>
          decodePolyline(s.polyline).map(([lat, lng]) => [lng, lat] as [number, number])
        );
        const lats = coords.map((c) => c[1]);
        const lngs = coords.map((c) => c[0]);
        map.fitBounds(
          [
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)],
          ],
          { padding: 40, maxZoom: 14, duration: 0 }
        );
      }

      const PERIOD_MS = 3500;
      function shimmer(now: number) {
        const base = now / PERIOD_MS;
        for (const id of heldLayersRef.current) {
          const layerId = `fav-seg-held-${id}`;
          if (!map.getLayer(layerId)) continue;
          const offset = heldPhaseRef.current.get(id) ?? 0;
          const phase = (base + offset) % 1;
          map.setPaintProperty(layerId, 'line-gradient', buildShimmerGradient(phase));
        }
        shimmerRafRef.current = requestAnimationFrame(shimmer);
      }
      shimmerRafRef.current = requestAnimationFrame(shimmer);
    });

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(container);

    return () => {
      if (shimmerRafRef.current !== null) cancelAnimationFrame(shimmerRafRef.current);
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!map.getSource(SEGMENTS_SOURCE_ID)) return;
    const visibleIds = items
      .filter((s) => stillFavorite.has(s.id) && (filter === 'all' || s.favorite))
      .map((s) => s.id);
    for (const id of visibleIds) {
      map.setFeatureState(
        { source: SEGMENTS_SOURCE_ID, id },
        { selected: id === selectedId }
      );
      map.setFeatureState(
        { source: PINS_SOURCE_ID, id },
        { selected: id === selectedId }
      );
    }
    if (selectedId !== null) {
      const target = itemsRef.current.find((i) => i.id === selectedId);
      if (target) fitToSegment(map, target);
      const row = document.getElementById(`fav-row-${selectedId}`);
      row?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, items, stillFavorite, filter]);

  useEffect(() => {
    syncHeldLayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, stillFavorite, filter]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const segSource = map.getSource(SEGMENTS_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    const pinSource = map.getSource(PINS_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (!segSource || !pinSource) return;
    const shown = items.filter((s) => stillFavorite.has(s.id) && (filter === 'all' || s.favorite));
    segSource.setData({
      type: 'FeatureCollection',
      features: shown.map((s) => ({
        type: 'Feature',
        id: s.id,
        properties: { id: s.id, state: segmentState(s) },
        geometry: {
          type: 'LineString',
          coordinates: decodePolyline(s.polyline).map(([lat, lng]) => [lng, lat]),
        },
      })),
    });
    pinSource.setData({
      type: 'FeatureCollection',
      features: shown.map((s) => ({
        type: 'Feature',
        id: s.id,
        properties: { id: s.id, state: segmentState(s) },
        geometry: { type: 'Point', coordinates: [s.startLng, s.startLat] },
      })),
    });
  }, [items, stillFavorite, filter]);

  function focusSegment(s: FavoriteSegment) {
    setSelectedId(s.id);
  }

  async function refreshAll() {
    const REFRESH_BATCH = 25;
    function staleness(s: FavoriteSegment): number {
      const at = s.effortsFetchedAt ?? s.detailsFetchedAt;
      return at ? new Date(at).getTime() : -Infinity;
    }
    const queue = [...visible].sort((a, b) => staleness(a) - staleness(b)).slice(0, REFRESH_BATCH);
    for (const s of queue) {
      await refreshSegment(s.id);
    }
  }

  async function refreshSegment(segmentId: number) {
    setRefreshingIds((prev) => new Set(prev).add(segmentId));
    setRefreshError(null);
    const res = await fetch(`/api/segments/${segmentId}/refresh`, { method: 'POST' }).catch(
      () => null
    );
    const isOk = !!res && res.ok;
    if (!isOk) {
      const body = res ? await res.text().catch(() => '') : '';
      setRefreshError(`Refresh failed${body ? `: ${body}` : ''}`);
    } else {
      const data = (await res!.json()) as {
        leaderCountOverall: number | null;
        athleteRecent90d: number | null;
        isYouTheLegend: boolean;
      };
      const nowIso = new Date().toISOString();
      setItems((prev) =>
        prev.map((i) =>
          i.id === segmentId
            ? {
                ...i,
                leaderCountOverall: data.leaderCountOverall,
                athleteRecent90d: data.athleteRecent90d,
                isYouTheLegend: data.isYouTheLegend,
                detailsFetchedAt: nowIso,
                effortsFetchedAt: nowIso,
              }
            : i
        )
      );
    }
    setRefreshingIds((prev) => {
      const next = new Set(prev);
      next.delete(segmentId);
      return next;
    });
  }

  async function removeFromSelection(segmentId: number) {
    const prev = stillFavorite;
    const next = new Set(prev);
    next.delete(segmentId);
    setStillFavorite(next);
    const res = await fetch(`/api/favorites/${segmentId}`, { method: 'DELETE' }).catch(() => null);
    const isOk = !!res && res.ok;
    if (!isOk) {
      setStillFavorite(prev);
    }
  }

  async function toggleFavorite(segmentId: number) {
    const target = itemsRef.current.find((i) => i.id === segmentId);
    if (!target) return;
    const nextValue = !target.favorite;
    setItems((prev) => prev.map((i) => (i.id === segmentId ? { ...i, favorite: nextValue } : i)));
    const res = await fetch(`/api/favorites/${segmentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ favorite: nextValue }),
    }).catch(() => null);
    const isOk = !!res && res.ok;
    if (!isOk) {
      setItems((prev) => prev.map((i) => (i.id === segmentId ? { ...i, favorite: !nextValue } : i)));
    }
  }

  function syncHeldLayers() {
    const map = mapRef.current;
    if (!map) return;
    if (!map.getSource(SEGMENTS_SOURCE_ID)) return;
    const target = new Set(
      itemsRef.current
        .filter(
          (i) =>
            i.isYouTheLegend &&
            stillFavoriteRef.current.has(i.id) &&
            (filterRef.current === 'all' || i.favorite)
        )
        .map((i) => i.id)
    );
    for (const id of Array.from(heldLayersRef.current)) {
      if (!target.has(id)) {
        const lid = `fav-seg-held-${id}`;
        if (map.getLayer(lid)) map.removeLayer(lid);
        heldLayersRef.current.delete(id);
        heldPhaseRef.current.delete(id);
      }
    }
    for (const id of target) {
      if (heldLayersRef.current.has(id)) continue;
      const lid = `fav-seg-held-${id}`;
      const beforeId = map.getLayer(PINS_HELD_GLOW_LAYER_ID)
        ? PINS_HELD_GLOW_LAYER_ID
        : map.getLayer(PINS_LAYER_ID)
        ? PINS_LAYER_ID
        : undefined;
      map.addLayer(
        {
          id: lid,
          source: SEGMENTS_SOURCE_ID,
          type: 'line',
          filter: ['==', ['get', 'id'], id],
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-width': [
              'case',
              ['boolean', ['feature-state', 'selected'], false],
              10,
              7,
            ],
            'line-gradient': buildShimmerGradient(Math.random()),
          },
        },
        beforeId
      );
      map.on('mouseenter', lid, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', lid, () => {
        map.getCanvas().style.cursor = '';
      });
      map.on('click', lid, (e) => {
        const f = e.features?.[0];
        const fid = f?.id;
        if (fid === undefined) return;
        setSelectedId(Number(fid));
      });
      heldLayersRef.current.add(id);
      heldPhaseRef.current.set(id, Math.random());
    }
  }

  function remainingFor(s: FavoriteSegment): number | null {
    if (s.leaderCountOverall === null) return null;
    return Math.max(0, s.leaderCountOverall + 1 - (s.athleteRecent90d ?? 0));
  }

  function sortKey(s: FavoriteSegment): [number, number] {
    if (s.isYouTheLegend) return [0, 0];
    const remaining = remainingFor(s);
    const hasData = remaining !== null;
    const bucket = hasData ? 1 : 2;
    let value = 0;
    if (sortBy === 'segment_distance') {
      value = s.distanceM;
    } else if (hasData && sortBy === 'attempts_to_claim') {
      value = remaining!;
    } else if (hasData && sortBy === 'distance_to_claim') {
      value = remaining! * s.distanceM;
    }
    return [bucket, value];
  }

  const selectedCount = items.filter((i) => stillFavorite.has(i.id)).length;
  const favoriteCount = items.filter((i) => stillFavorite.has(i.id) && i.favorite).length;
  const visible = items
    .filter((i) => stillFavorite.has(i.id) && (filter === 'all' || i.favorite))
    .sort((a, b) => {
      const [aBucket, aValue] = sortKey(a);
      const [bBucket, bValue] = sortKey(b);
      if (aBucket !== bBucket) return aBucket - bBucket;
      return aValue - bValue;
    });

  return (
    <div className="flex flex-col" style={{ height: '100vh' }}>
      <AppNav />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <div className="relative md:flex-1" style={{ minHeight: '50vh' }}>
        <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      </div>
      <aside className="flex-1 overflow-y-auto border-t border-[var(--card-border)] bg-[var(--card)] md:max-w-sm md:border-l md:border-t-0">
        <div className="flex flex-col gap-2 border-b border-[var(--card-border)] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">
              {filter === 'favorites'
                ? `${favoriteCount} favorite${favoriteCount === 1 ? '' : 's'}`
                : `${selectedCount} selected`}
            </div>
            {visible.length > 0 && (
              <button
                type="button"
                onClick={() => void refreshAll()}
                disabled={refreshingIds.size > 0}
                title="Refresh 25 oldest"
                className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm disabled:opacity-60"
              >
                {refreshingIds.size > 0 ? `Refreshing ${refreshingIds.size}…` : 'Refresh'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 rounded-md border border-[var(--card-border)] p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={
                filter === 'all'
                  ? 'flex-1 rounded bg-[var(--accent)] px-2 py-1 font-semibold text-white'
                  : 'flex-1 rounded px-2 py-1 text-[var(--muted)] hover:text-white'
              }
            >
              All ({selectedCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('favorites')}
              className={
                filter === 'favorites'
                  ? 'flex-1 rounded bg-[var(--accent)] px-2 py-1 font-semibold text-white'
                  : 'flex-1 rounded px-2 py-1 text-[var(--muted)] hover:text-white'
              }
            >
              ★ Favorites ({favoriteCount})
            </button>
          </div>
          <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
            Sort by
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="rounded border border-[var(--card-border)] bg-[var(--card)] px-2 py-1 text-xs text-[var(--foreground)]"
            >
              <option value="distance_to_claim">Distance to claim</option>
              <option value="attempts_to_claim">Attempts to claim</option>
              <option value="segment_distance">Segment distance</option>
            </select>
          </label>
        </div>
        {refreshError && (
          <div className="border-b border-red-900 bg-red-950/40 px-4 py-2 text-xs text-red-300">
            {refreshError}
          </div>
        )}
        {visible.length === 0 ? (
          filter === 'favorites' ? (
            <div className="p-4 text-sm text-[var(--muted)]">
              No favorites yet. Tap the ☆ on a selected segment to mark it as a favorite.
            </div>
          ) : (
            <div className="p-4 text-sm text-[var(--muted)]">
              No segments selected yet. Add segments from the{' '}
              <a className="text-[var(--accent)] underline" href="/buurtheld/explore">
                Explore
              </a>{' '}
              page.
            </div>
          )
        ) : (
          <ul>
            {visible.map((s) => {
              const isRefreshing = refreshingIds.has(s.id);
              const wasRefreshed = !!s.detailsFetchedAt || !!s.effortsFetchedAt;
              const hasLeader = s.leaderCountOverall !== null;
              const athleteCount = s.athleteRecent90d ?? 0;
              const isYouTheLegend = s.isYouTheLegend;
              const remainingAttempts = isYouTheLegend
                ? 0
                : hasLeader
                ? Math.max(0, (s.leaderCountOverall ?? 0) + 1 - athleteCount)
                : null;
              const remainingDistanceM = remainingAttempts !== null
                ? remainingAttempts * s.distanceM
                : null;
              const isSelected = s.id === selectedId;
              const baseClass = isYouTheLegend
                ? 'relative flex items-start gap-3 border-b border-[var(--accent)]/40 bg-gradient-to-r from-[var(--accent)]/15 via-[var(--accent)]/[0.07] to-transparent px-4 py-3 hover:from-[var(--accent)]/20'
                : 'flex items-start gap-3 border-b border-[var(--card-border)] px-4 py-3 hover:bg-[var(--card-border)]/40';
              const rowClass = isSelected
                ? `${baseClass} ring-2 ring-inset ring-[var(--accent)]`
                : baseClass;
              return (
                <li key={s.id} id={`fav-row-${s.id}`} className={rowClass}>
                  {isYouTheLegend && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src="/laurel.png"
                      alt="Local Legend"
                      title="Local Legend"
                      className="pointer-events-none absolute right-2 top-2 h-8 w-8"
                    />
                  )}
                  <button
                    type="button"
                    aria-label={s.favorite ? 'Remove from favorites' : 'Mark as favorite'}
                    title={s.favorite ? 'Favorite' : 'Mark as favorite'}
                    onClick={() => void toggleFavorite(s.id)}
                    className={
                      s.favorite
                        ? 'text-2xl leading-none text-[var(--accent)]'
                        : 'text-2xl leading-none text-[var(--muted)] hover:text-[var(--accent)]'
                    }
                  >
                    {s.favorite ? '★' : '☆'}
                  </button>
                  <div className="relative min-w-0 flex-1">
                    <div
                      className="cursor-pointer truncate font-medium"
                      onClick={() => focusSegment(s)}
                    >
                      {s.name}
                    </div>
                    <div className="mt-0.5 text-xs text-[var(--muted)]">{formatKm(s.distanceM)}</div>
                    {wasRefreshed ? (
                      isYouTheLegend ? (
                        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                          <div className="text-[var(--muted)]">Your efforts (90d)</div>
                          <div className="text-right font-medium">{athleteCount}</div>
                        </div>
                      ) : (
                        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                          <div className="text-[var(--muted)]">Leader (90d)</div>
                          <div className="text-right font-medium">
                            {hasLeader ? s.leaderCountOverall : '—'}
                          </div>
                          <div className="text-[var(--muted)]">You (90d)</div>
                          <div className="text-right font-medium">{athleteCount}</div>
                          {hasLeader ? (
                            <>
                              <div className="text-[var(--muted)]">Attempts to claim</div>
                              <div className="text-right font-semibold text-[var(--accent)]">
                                {remainingAttempts}
                              </div>
                              <div className="text-[var(--muted)]">Distance to claim</div>
                              <div className="text-right font-semibold text-[var(--accent)]">
                                {formatKm(remainingDistanceM ?? 0)}
                              </div>
                            </>
                          ) : (
                            <div className="col-span-2 mt-1 text-xs italic text-[var(--muted)]/70">
                              Local Legend not active for this segment.
                            </div>
                          )}
                        </div>
                      )
                    ) : (
                      <div className="mt-2 text-xs italic text-[var(--muted)]/70">
                        No stats yet — press Refresh.
                      </div>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void refreshSegment(s.id)}
                        disabled={isRefreshing}
                        className="rounded border border-[var(--card-border)] px-2 py-1 text-xs hover:bg-[var(--card-border)] disabled:opacity-60"
                      >
                        {isRefreshing ? 'Refreshing…' : 'Refresh'}
                      </button>
                      {formatRefreshedAgo(s.effortsFetchedAt ?? s.detailsFetchedAt) && (
                        <span
                          className="text-xs text-[var(--muted)]"
                          title={(s.effortsFetchedAt ?? s.detailsFetchedAt) ?? ''}
                        >
                          Refreshed {formatRefreshedAgo(s.effortsFetchedAt ?? s.detailsFetchedAt)}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => void removeFromSelection(s.id)}
                        title="Remove from selection"
                        className="ml-auto rounded border border-[var(--card-border)] px-2 py-1 text-xs text-[var(--muted)] hover:border-red-900 hover:text-red-300"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </aside>
      </div>
    </div>
  );
}
