/**
 * WiFiSense 3D - Client-Side Analytics Engine
 * ============================================
 * Provides instant, zero-latency spatial interpolation, location grouping,
 * and CSV generation in the browser for Live ESP32 Web Serial mode.
 */

import type { AnalyticsSummary, HeatmapData, LocationSummary, RSSIMeasurement } from '../types';

export function computeLocationSummaries(measurements: RSSIMeasurement[]): LocationSummary[] {
  const groups = new Map<string, { x: number; y: number; z: number; rssis: number[]; session: string }>();

  for (const m of measurements) {
    if (m.rssi_dbm === null || isNaN(m.rssi_dbm)) continue;
    const key = `${m.x_m.toFixed(2)},${m.y_m.toFixed(2)},${m.z_m.toFixed(2)}`;
    if (!groups.has(key)) {
      groups.set(key, { x: m.x_m, y: m.y_m, z: m.z_m, rssis: [], session: m.session_id });
    }
    groups.get(key)!.rssis.push(m.rssi_dbm);
  }

  const summaries: LocationSummary[] = [];
  for (const [, item] of groups) {
    const vals = item.rssis;
    const n = vals.length;
    const mean = vals.reduce((a, b) => a + b, 0) / n;
    const variance = n > 1 ? vals.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (n - 1) : 0;
    const std = Math.sqrt(variance);
    const min = Math.min(...vals);
    const max = Math.max(...vals);

    summaries.push({
      x_m: item.x,
      y_m: item.y,
      z_m: item.z,
      mean_rssi: Number(mean.toFixed(2)),
      std_rssi: n > 1 ? Number(std.toFixed(2)) : 0,
      min_rssi: min,
      max_rssi: max,
      range_rssi: Number((max - min).toFixed(2)),
      sample_count: n,
      valid_count: n,
      stability_score: Number(Math.max(40, 100 - std * 20).toFixed(1)),
      session_id: item.session,
    });
  }

  return summaries;
}

export function computeAnalyticsSummary(
  measurements: RSSIMeasurement[],
  locations: LocationSummary[]
): AnalyticsSummary {
  const valid = measurements.filter((m) => m.rssi_dbm !== null && !isNaN(m.rssi_dbm));
  const rssiList = valid.map((m) => m.rssi_dbm!);

  if (rssiList.length === 0) {
    return {
      total_samples: 0,
      valid_samples: 0,
      total_locations: 0,
      sessions: 0,
      overall_mean_rssi: null,
      overall_std_rssi: null,
      overall_min_rssi: null,
      overall_max_rssi: null,
      valid_ratio: 0,
      last_measurement_at: null,
      collection_source: 'esp32',
    };
  }

  const mean = rssiList.reduce((a, b) => a + b, 0) / rssiList.length;
  const variance =
    rssiList.length > 1
      ? rssiList.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (rssiList.length - 1)
      : 0;
  const std = Math.sqrt(variance);

  return {
    total_samples: measurements.length,
    valid_samples: valid.length,
    total_locations: locations.length,
    sessions: 1,
    overall_mean_rssi: Number(mean.toFixed(2)),
    overall_std_rssi: Number(std.toFixed(2)),
    overall_min_rssi: Math.min(...rssiList),
    overall_max_rssi: Math.max(...rssiList),
    valid_ratio: Number((valid.length / Math.max(1, measurements.length)).toFixed(2)),
    last_measurement_at: measurements[measurements.length - 1]?.timestamp_iso || new Date().toISOString(),
    collection_source: 'esp32',
  };
}

/**
 * Computes 2D / 3D Inverse Distance Weighting (IDW) interpolation
 * when >= 3 distinct physical survey coordinates exist.
 */
export function computeClientHeatmap(locations: LocationSummary[], resolution = 25): HeatmapData | null {
  if (locations.length === 0) return null;

  const xs = locations.map((l) => l.x_m);
  const ys = locations.map((l) => l.y_m);
  const maxX = Math.max(...xs, 8);
  const maxY = Math.max(...ys, 8);

  const roomWidth = Math.max(8.0, maxX + 1.0);
  const roomLength = Math.max(8.0, maxY + 1.0);

  const stepX = roomWidth / (resolution - 1);
  const stepY = roomLength / (resolution - 1);

  const gridX: number[][] = [];
  const gridY: number[][] = [];
  const gridRssi: (number | null)[][] = [];

  const hasSufficient = locations.length >= 3;

  for (let i = 0; i < resolution; i++) {
    const rowX: number[] = [];
    const rowY: number[] = [];
    const rowR: (number | null)[] = [];
    const cy = Number((i * stepY).toFixed(2));

    for (let j = 0; j < resolution; j++) {
      const cx = Number((j * stepX).toFixed(2));
      rowX.push(cx);
      rowY.push(cy);

      if (!hasSufficient) {
        rowR.push(null);
      } else {
        // IDW interpolation
        let weightedSum = 0;
        let weightSum = 0;
        let exactMatch: number | null = null;

        for (const loc of locations) {
          if (loc.mean_rssi === null) continue;
          const dist = Math.sqrt(Math.pow(cx - loc.x_m, 2) + Math.pow(cy - loc.y_m, 2));
          if (dist < 0.15) {
            exactMatch = loc.mean_rssi;
            break;
          }
          const weight = 1.0 / Math.pow(dist, 2.0);
          weightedSum += weight * loc.mean_rssi;
          weightSum += weight;
        }

        if (exactMatch !== null) {
          rowR.push(Number(exactMatch.toFixed(2)));
        } else if (weightSum > 0) {
          rowR.push(Number((weightedSum / weightSum).toFixed(2)));
        } else {
          rowR.push(null);
        }
      }
    }
    gridX.push(rowX);
    gridY.push(rowY);
    gridRssi.push(rowR);
  }

  const warnings = hasSufficient
    ? []
    : [
        `Live Spatial Heatmap requires measurements at ≥ 3 distinct physical coordinates. Currently collected: ${locations.length}/3 locations. Move your ESP32 to new coordinates and record samples.`,
      ];

  return {
    locations,
    grid_x: gridX,
    grid_y: gridY,
    grid_rssi: gridRssi,
    interpolation_method: 'idw_multiquadric',
    room_width_m: roomWidth,
    room_length_m: roomLength,
    measured_count: locations.length,
    has_sufficient_data: hasSufficient,
    warnings,
  };
}

/**
 * Generates formatted CSV content for export and download.
 */
export function exportMeasurementsToCsv(measurements: RSSIMeasurement[]): string {
  const headers = [
    'Date_Time',
    'Reading',
    'ESP32_Time_ms',
    'SSID',
    'RSSI_dBm',
    'X_m',
    'Y_m',
    'Z_m',
    'Channel',
    'Status',
  ];
  const rows = measurements.map((m, idx) => [
    m.timestamp_iso,
    m.sample_index || idx + 1,
    (m.sample_index || idx + 1) * 5000,
    m.target_ssid,
    m.rssi_dbm !== null ? m.rssi_dbm : '',
    m.x_m,
    m.y_m,
    m.z_m,
    m.channel,
    m.scan_status,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/**
 * Triggers a browser file download of a text/CSV string.
 */
export function downloadCsvFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
