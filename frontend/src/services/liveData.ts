import type { AnalyticsSummary, HeatmapData, LocationSummary, RSSIMeasurement } from '../types';

export interface LiveViewData {
  summary: AnalyticsSummary;
  locations: LocationSummary[];
  heatmap: HeatmapData;
}

const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : NaN;
const sampleStd = (values: number[]) => {
  if (values.length < 2) return 0;
  const avg = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1));
};

/** Derive the live dashboard only from valid, actual ESP32 records. */
export function buildLiveView(records: RSSIMeasurement[]): LiveViewData {
  const valid = records.filter((m) => m.collection_source === 'esp32'
    && m.scan_status === 'ok' && typeof m.rssi_dbm === 'number'
    && Number.isFinite(m.rssi_dbm) && m.rssi_dbm !== -999);

  const grouped = new Map<string, RSSIMeasurement[]>();
  for (const measurement of valid) {
    const key = [measurement.x_m, measurement.y_m, measurement.z_m].map((v) => Number(v).toFixed(2)).join('|');
    const group = grouped.get(key) || [];
    group.push(measurement);
    grouped.set(key, group);
  }

  const locations: LocationSummary[] = Array.from(grouped.values()).map((group) => {
    const values = group.map((m) => m.rssi_dbm as number);
    const avg = mean(values);
    const first = group[0];
    const spread = sampleStd(values);
    return {
      x_m: first.x_m, y_m: first.y_m, z_m: first.z_m,
      mean_rssi: avg, std_rssi: spread,
      min_rssi: Math.min(...values), max_rssi: Math.max(...values),
      range_rssi: Math.max(...values) - Math.min(...values),
      sample_count: group.length, valid_count: group.length,
      stability_score: spread, session_id: first.session_id,
    };
  });

  const values = valid.map((m) => m.rssi_dbm as number);
  const summary: AnalyticsSummary = {
    total_samples: records.length,
    valid_samples: valid.length,
    total_locations: locations.length,
    sessions: new Set(records.map((m) => m.session_id)).size,
    overall_mean_rssi: values.length ? mean(values) : null,
    overall_std_rssi: values.length ? sampleStd(values) : null,
    overall_min_rssi: values.length ? Math.min(...values) : null,
    overall_max_rssi: values.length ? Math.max(...values) : null,
    valid_ratio: records.length ? valid.length / records.length : null,
    last_measurement_at: records.length ? records[records.length - 1].timestamp_iso : null,
    collection_source: 'esp32',
  };

  // A valid 2D heatmap requires three non-collinear surveyed positions.
  let has2DGeometry = false;
  if (locations.length >= 3) {
    const a = locations[0];
    outer: for (let i = 1; i < locations.length; i++) {
      for (let j = i + 1; j < locations.length; j++) {
        const b = locations[i], c = locations[j];
        const twiceArea = (b.x_m - a.x_m) * (c.y_m - a.y_m) - (b.y_m - a.y_m) * (c.x_m - a.x_m);
        if (Math.abs(twiceArea) > 1e-6) { has2DGeometry = true; break outer; }
      }
    }
  }

  let grid_x: number[][] = [];
  let grid_y: number[][] = [];
  let grid_rssi: (number | null)[][] = [];
  let roomWidth = 10, roomLength = 10;

  if (has2DGeometry) {
    const mx = locations.map((p) => p.x_m), my = locations.map((p) => p.y_m);
    let xMin = Math.min(...mx), xMax = Math.max(...mx);
    let yMin = Math.min(...my), yMax = Math.max(...my);
    if (xMin === xMax) { xMin -= 0.5; xMax += 0.5; }
    if (yMin === yMax) { yMin -= 0.5; yMax += 0.5; }
    roomWidth = Math.max(1, xMax);
    roomLength = Math.max(1, yMax);
    const n = 35;
    const gx = Array.from({ length: n }, (_, i) => xMin + (xMax - xMin) * i / (n - 1));
    const gy = Array.from({ length: n }, (_, i) => yMin + (yMax - yMin) * i / (n - 1));
    grid_x = gy.map(() => gx.slice());
    grid_y = gy.map((y) => gx.map(() => y));
    grid_rssi = gy.map((y) => gx.map((x) => {
      let weighted = 0, weights = 0;
      for (const p of locations) {
        const d2 = (x - p.x_m) ** 2 + (y - p.y_m) ** 2;
        if (d2 < 1e-10) return p.mean_rssi;
        const weight = 1 / d2;
        weighted += weight * (p.mean_rssi as number);
        weights += weight;
      }
      return weights ? weighted / weights : null;
    }));
  }

  const heatmap: HeatmapData = {
    locations, grid_x, grid_y, grid_rssi,
    interpolation_method: 'inverse_distance_weighting',
    room_width_m: roomWidth, room_length_m: roomLength,
    measured_count: locations.length, has_sufficient_data: has2DGeometry,
    warnings: has2DGeometry
      ? ['Interpolated cells are estimates between measured ESP32 survey points (inverse-distance weighting).']
      : ['Collect valid measurements at three or more non-collinear positions to build a 2D heatmap.'],
  };
  return { summary, locations, heatmap };
}
