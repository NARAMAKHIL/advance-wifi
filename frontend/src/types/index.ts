export type ScanStatus = 'ok' | 'target_not_found' | 'scan_failed' | 'simulated';
export type CollectionSource = 'esp32' | 'simulation' | 'imported';
export type DeviceState = 'disconnected' | 'connected' | 'scanning' | 'measuring' | 'error';

export interface RSSIMeasurement {
  timestamp_iso: string;
  session_id: string;
  measurement_id: string;
  sample_index: number;
  node_id: string;
  target_ssid: string;
  bssid: string;
  channel: number;
  rssi_dbm: number | null;
  x_m: number;
  y_m: number;
  z_m: number;
  scan_status: ScanStatus;
  collection_source: CollectionSource;
}

export interface LocationSummary {
  x_m: number;
  y_m: number;
  z_m: number;
  mean_rssi: number | null;
  std_rssi: number | null;
  min_rssi: number | null;
  max_rssi: number | null;
  range_rssi: number | null;
  sample_count: number;
  valid_count: number;
  stability_score: number | null;
  session_id: string;
}

export interface SessionInfo {
  session_id: string;
  experiment_name: string;
  room_name: string;
  room_width_m: number;
  room_length_m: number;
  room_height_m: number | null;
  target_ssid: string;
  target_bssid: string;
  node_id: string;
  samples_per_batch: number;
  interval_ms: number;
  created_at: string;
  total_measurements: number;
  total_locations: number;
  collection_source: CollectionSource;
}

export interface SerialConfig {
  port: string;
  baud_rate: number;
}

export interface SerialStatus {
  connected: boolean;
  port: string | null;
  baud_rate: number;
  device_state: DeviceState;
  node_id: string;
  firmware_version: string;
  last_message_at: string | null;
}

export interface PortInfo {
  port: string;
  description: string;
  hardware_id: string;
}

export interface StartMeasurementRequest {
  target_ssid: string;
  target_bssid?: string;
  x_m: number;
  y_m: number;
  z_m: number;
  count: number;
  interval_ms: number;
  session_id?: string;
  experiment_name?: string;
  room_name?: string;
  room_width_m?: number;
  room_length_m?: number;
}

export interface HealthResponse {
  status: string;
  version: string;
  uptime_seconds: number;
  serial_connected: boolean;
  data_points: number;
}

export interface AnalyticsSummary {
  total_samples: number;
  valid_samples: number;
  total_locations: number;
  sessions: number;
  overall_mean_rssi: number | null;
  overall_std_rssi: number | null;
  overall_min_rssi: number | null;
  overall_max_rssi: number | null;
  valid_ratio: number | null;
  last_measurement_at: string | null;
  collection_source: string;
}

export interface HeatmapData {
  locations: LocationSummary[];
  grid_x: number[][];
  grid_y: number[][];
  grid_rssi: (number | null)[][];
  interpolation_method: string;
  room_width_m: number;
  room_length_m: number;
  measured_count: number;
  has_sufficient_data: boolean;
  warnings: string[];
}

export interface SurveyRecommendation {
  x_m: number;
  y_m: number;
  reason: string;
  priority: number;
}

export interface MethodValidationResult {
  rmse: number;
  mae: number;
  r2: number;
  valid_points: number;
}

export interface ValidationResult {
  status?: string;
  message?: string;
  locations_available?: number;
  methods?: Record<string, MethodValidationResult>;
  best_method?: string;
  sample_size?: number;
}

export interface SerialEvent {
  event: string;
  type?: string;
  timestamp?: string;
  data?: any;
  _index?: number;
}
