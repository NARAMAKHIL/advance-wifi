import type {
  AnalyticsSummary,
  HealthResponse,
  HeatmapData,
  LocationSummary,
  PortInfo,
  RSSIMeasurement,
  SerialStatus,
  SessionInfo,
  StartMeasurementRequest,
  SurveyRecommendation,
  ValidationResult,
} from '../types';

import {
  STATIC_HEATMAP,
  STATIC_LOCATIONS,
  STATIC_MEASUREMENTS,
  STATIC_PORTS,
  STATIC_RECOMMENDATIONS,
  STATIC_SERIAL_STATUS,
  STATIC_SESSIONS,
  STATIC_SUMMARY,
  STATIC_VALIDATION,
} from '../data/staticDemoData';

const BASE_URL = '/api';

async function fetchJson<T>(url: string, options?: RequestInit, fallback?: T): Promise<T> {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      if (fallback !== undefined) return fallback;
      let errorDetail = res.statusText;
      try {
        const errorJson = await res.json();
        errorDetail = errorJson.detail || errorDetail;
      } catch {
        // ignore
      }
      throw new Error(errorDetail);
    }
    return await res.json();
  } catch (err) {
    if (fallback !== undefined) {
      console.warn(`[WiFiSense] Using static offline data for: ${url}`);
      return fallback;
    }
    throw err;
  }
}

export const api = {
  // System Health
  async getHealth(): Promise<HealthResponse> {
    const fallback: HealthResponse = {
      status: 'ok',
      version: '1.0.0 (Static Dashboard)',
      uptime_seconds: 3600,
      serial_connected: true,
      data_points: STATIC_MEASUREMENTS.length,
    };
    return fetchJson<HealthResponse>(`${BASE_URL}/health`, undefined, fallback);
  },

  // Serial Management
  async getPorts(): Promise<PortInfo[]> {
    return fetchJson<PortInfo[]>(`${BASE_URL}/ports`, undefined, STATIC_PORTS);
  },

  async getSerialStatus(): Promise<SerialStatus> {
    return fetchJson<SerialStatus>(`${BASE_URL}/serial/status`, undefined, STATIC_SERIAL_STATUS);
  },

  async connectSerial(port: string, baud_rate: number = 115200): Promise<SerialStatus> {
    const fallback: SerialStatus = {
      ...STATIC_SERIAL_STATUS,
      connected: true,
      port,
      baud_rate,
      device_state: 'connected',
    };
    return fetchJson<SerialStatus>(
      `${BASE_URL}/serial/connect`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ port, baud_rate }),
      },
      fallback
    );
  },

  async disconnectSerial(): Promise<SerialStatus> {
    const fallback: SerialStatus = {
      ...STATIC_SERIAL_STATUS,
      connected: false,
      port: null,
      device_state: 'disconnected',
    };
    return fetchJson<SerialStatus>(
      `${BASE_URL}/serial/disconnect`,
      { method: 'POST' },
      fallback
    );
  },

  async scanNetworks(): Promise<{ status: string }> {
    return fetchJson<{ status: string }>(
      `${BASE_URL}/serial/scan`,
      { method: 'POST' },
      { status: 'scan_complete (simulated on GitHub Pages)' }
    );
  },

  // Measurements
  async startMeasurement(request: StartMeasurementRequest): Promise<{
    status: string;
    session_id: string;
    measurement_id: string;
  }> {
    const fallback = {
      status: 'started',
      session_id: request.session_id || 'session_amrita_b244',
      measurement_id: `meas_${Date.now()}`,
    };
    return fetchJson(
      `${BASE_URL}/measurements/start`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      },
      fallback
    );
  },

  async stopMeasurement(): Promise<{ status: string }> {
    return fetchJson<{ status: string }>(
      `${BASE_URL}/measurements/stop`,
      { method: 'POST' },
      { status: 'stopped' }
    );
  },

  async getMeasurements(sessionId?: string, limit: number = 500): Promise<RSSIMeasurement[]> {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (sessionId) params.append('session_id', sessionId);
    
    // Filter static fallback if sessionId is provided
    let fallback = STATIC_MEASUREMENTS;
    if (sessionId) {
      const filtered = STATIC_MEASUREMENTS.filter((m) => m.session_id === sessionId);
      if (filtered.length > 0) fallback = filtered;
    }
    return fetchJson<RSSIMeasurement[]>(
      `${BASE_URL}/measurements?${params.toString()}`,
      undefined,
      fallback.slice(0, limit)
    );
  },

  // Sessions
  async getSessions(): Promise<SessionInfo[]> {
    return fetchJson<SessionInfo[]>(`${BASE_URL}/sessions`, undefined, STATIC_SESSIONS);
  },

  async deleteSession(sessionId: string): Promise<{ status: string; rows_removed: number }> {
    return fetchJson(
      `${BASE_URL}/data/session/${encodeURIComponent(sessionId)}`,
      { method: 'DELETE' },
      { status: 'success', rows_removed: 16 }
    );
  },

  // Analytics
  async getAnalyticsSummary(sessionId?: string): Promise<AnalyticsSummary> {
    const params = new URLSearchParams();
    if (sessionId) params.append('session_id', sessionId);
    const query = params.toString() ? `?${params.toString()}` : '';
    return fetchJson<AnalyticsSummary>(
      `${BASE_URL}/analytics/summary${query}`,
      undefined,
      STATIC_SUMMARY
    );
  },

  async getLocationSummaries(sessionId?: string): Promise<LocationSummary[]> {
    const params = new URLSearchParams();
    if (sessionId) params.append('session_id', sessionId);
    const query = params.toString() ? `?${params.toString()}` : '';
    let fallback = STATIC_LOCATIONS;
    if (sessionId) {
      const filtered = STATIC_LOCATIONS.filter((l) => l.session_id === sessionId);
      if (filtered.length > 0) fallback = filtered;
    }
    return fetchJson<LocationSummary[]>(
      `${BASE_URL}/analytics/locations${query}`,
      undefined,
      fallback
    );
  },

  async getHeatmap(options?: {
    sessionId?: string;
    roomWidth?: number;
    roomLength?: number;
    method?: string;
    resolution?: number;
  }): Promise<HeatmapData> {
    const params = new URLSearchParams();
    if (options?.sessionId) params.append('session_id', options.sessionId);
    if (options?.roomWidth) params.append('room_width', options.roomWidth.toString());
    if (options?.roomLength) params.append('room_length', options.roomLength.toString());
    if (options?.method) params.append('method', options.method);
    if (options?.resolution) params.append('resolution', options.resolution.toString());
    return fetchJson<HeatmapData>(
      `${BASE_URL}/analytics/heatmap?${params.toString()}`,
      undefined,
      STATIC_HEATMAP
    );
  },

  async getRecommendations(options?: {
    sessionId?: string;
    roomWidth?: number;
    roomLength?: number;
    gridSpacing?: number;
    maxResults?: number;
  }): Promise<SurveyRecommendation[]> {
    const params = new URLSearchParams();
    if (options?.sessionId) params.append('session_id', options.sessionId);
    if (options?.roomWidth) params.append('room_width', options.roomWidth.toString());
    if (options?.roomLength) params.append('room_length', options.roomLength.toString());
    if (options?.gridSpacing) params.append('grid_spacing', options.gridSpacing.toString());
    if (options?.maxResults) params.append('max_results', options.maxResults.toString());
    return fetchJson<SurveyRecommendation[]>(
      `${BASE_URL}/analytics/recommendations?${params.toString()}`,
      undefined,
      STATIC_RECOMMENDATIONS
    );
  },

  async getValidation(sessionId?: string, roomWidth: number = 10, roomLength: number = 10): Promise<ValidationResult> {
    const params = new URLSearchParams({
      room_width: roomWidth.toString(),
      room_length: roomLength.toString(),
    });
    if (sessionId) params.append('session_id', sessionId);
    return fetchJson<ValidationResult>(
      `${BASE_URL}/analytics/validation?${params.toString()}`,
      undefined,
      STATIC_VALIDATION
    );
  },

  // Simulation
  async generateSimulation(params?: {
    roomWidth?: number;
    roomLength?: number;
    gridSpacing?: number;
    samplesPerPoint?: number;
  }): Promise<{
    status: string;
    data_points: number;
    locations: number;
    session_id: string;
    warning: string;
  }> {
    const q = new URLSearchParams();
    if (params?.roomWidth) q.append('room_width', params.roomWidth.toString());
    if (params?.roomLength) q.append('room_length', params.roomLength.toString());
    if (params?.gridSpacing) q.append('grid_spacing', params.gridSpacing.toString());
    if (params?.samplesPerPoint) q.append('samples_per_point', params.samplesPerPoint.toString());
    return fetchJson(
      `${BASE_URL}/simulation/generate?${q.toString()}`,
      { method: 'POST' },
      {
        status: 'simulated',
        data_points: 160,
        locations: 16,
        session_id: 'session_simulation_demo',
        warning: 'Demonstration simulation generated offline on static client',
      }
    );
  },

  // Export / Import
  getExportUrl(sessionId?: string): string {
    return sessionId ? `${BASE_URL}/data/export?session_id=${encodeURIComponent(sessionId)}` : `${BASE_URL}/data/export`;
  },

  async importCsv(file: File): Promise<{ status: string; rows_imported: number; filename: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return fetchJson(
      `${BASE_URL}/data/import`,
      { method: 'POST', body: formData },
      { status: 'imported', rows_imported: 16, filename: file.name }
    );
  },
};
