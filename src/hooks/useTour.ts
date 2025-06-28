import { useMemo } from 'react';
import haversine from 'haversine-distance';
import targetsFile from '../../content.json';
import { DEMO_USER } from '../constants';

export interface Target {
  name: string;
  desc: string;
  lat: number;
  lon: number;
  tag: string;
}

/* ---------- 1 · Load → coerce → filter ---------- */

const ALL: Target[] = (targetsFile.targets as any[])
  .map((row) => ({
    ...row,
    // make absolutely sure we have *numbers*
    lat: Number(row.lat),
    lon: Number(row.lon),
  }))
  .filter((t) => Number.isFinite(t.lat) && Number.isFinite(t.lon));

/* ---------- 2 · Hook ---------- */

export function useTour(max = 10) {
  return useMemo(() => {
    return ALL
      .map((t) => ({
        ...t,
        distance: haversine(DEMO_USER, { lat: t.lat, lon: t.lon }),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, max);
  }, [max]);
}
