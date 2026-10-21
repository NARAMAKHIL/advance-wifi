import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Heatmap2D } from './components/Heatmap2D';
import { SerialPanel } from './components/SerialPanel';
import { SignalAnalytics } from './components/SignalAnalytics';
import { SurveyPlanner } from './components/SurveyPlanner';
import { DataManagementView } from './components/DataManagementView';
import { api } from './services/api';
import type {
  AnalyticsSummary,
  HeatmapData,
  LocationSummary,
  PortInfo,
  RSSIMeasurement,
  SerialStatus,
  SessionInfo,
  SurveyRecommendation,
  ValidationResult,
} from './types';

type ActiveView = 'map' | 'analytics' | 'survey' | 'devices';

export const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ActiveView>('map');
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // System states
  const [serialStatus, setSerialStatus] = useState<SerialStatus>({
    connected: false,
    port: null,
    baud_rate: 115200,
    device_state: 'disconnected',
    node_id: '',
    firmware_version: '',
    last_message_at: null,
  });
  const [ports, setPorts] = useState<PortInfo[]>([]);

  // Telemetry & analytics data
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [locations, setLocations] = useState<LocationSummary[]>([]);
  const [measurements, setMeasurements] = useState<RSSIMeasurement[]>([]);
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null);
  const [recommendations, setRecommendations] = useState<SurveyRecommendation[]>([]);
  const [validationData, setValidationData] = useState<ValidationResult | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);

  // Selected coordinate for serial acquisition prefill
  const [targetCoords, setTargetCoords] = useState<{ x: number; y: number; z: number } | undefined>();
  const [interpMethod, setInterpMethod] = useState<string>('linear');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Prevent multiple simultaneous data loads
  const isFetchingRef = useRef<boolean>(false);

  // Stable function to load all core analytics without cyclic re-renders
  const loadAllData = useCallback(async (sessionId: string | null = null, method: string = 'linear') => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsSyncing(true);

    try {
      const targetSession = sessionId || undefined;
      const [sum, locs, meas, hm, val, recs, sessList] = await Promise.all([
        api.getAnalyticsSummary(targetSession).catch(() => null),
        api.getLocationSummaries(targetSession).catch(() => []),
        api.getMeasurements(targetSession, 50).catch(() => []),
        api.getHeatmap({ sessionId: targetSession, method, resolution: 30 }).catch(() => null),
        api.getValidation(targetSession).catch(() => null),
        api.getRecommendations({ sessionId: targetSession }).catch(() => []),
        api.getSessions().catch(() => []),
      ]);

      if (sum) setSummary(sum);
      setLocations(locs);
      setMeasurements(meas);
      if (hm) setHeatmapData(hm);
      if (val) setValidationData(val);
      setRecommendations(recs);
      setSessions(sessList);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setIsSyncing(false);
      isFetchingRef.current = false;
    }
  }, []);

  // Fetch Serial Status quietly (never touches heatmap or telemetry)
  const pollSerialStatus = useCallback(async () => {
    try {
      const [status, portList] = await Promise.all([
        api.getSerialStatus().catch(() => null),
        api.getPorts().catch(() => []),
      ]);
      if (status) setSerialStatus(status);
      setPorts(portList);
    } catch {
      // quiet catch
    }
  }, []);

  // Initial load
  useEffect(() => {
    pollSerialStatus();
    loadAllData(activeSessionId, interpMethod);
  }, []); // Run once on mount

  // When session or interpolation method changes, reload cleanly
  useEffect(() => {
    loadAllData(activeSessionId, interpMethod);
  }, [activeSessionId, interpMethod, loadAllData]);

  // Gentle, stable polling for hardware status every 5 seconds (NO flicker!)
  useEffect(() => {
    const timer = setInterval(() => {
      pollSerialStatus();
    }, 5000);
    return () => clearInterval(timer);
  }, [pollSerialStatus]);

  const handlePointSelect = (x: number, y: number) => {
    setTargetCoords({ x, y, z: 1.0 });
  };

  const isSimulation = summary?.collection_source === 'simulation';

  return (
    <>
      {/* ── Top Header Navigation ──────────────────────────────── */}
      <header className="top-header">
        <div className="brand">
          <div className="brand-icon">📶</div>
          <span className="brand-title">WiFiSense 3D</span>
          <span className="brand-badge">RF Analytics</span>
        </div>

        {/* Clean Nav Pills */}
        <nav className="nav-pills">
          <button
            className={`nav-pill ${activeView === 'map' ? 'active' : ''}`}
            onClick={() => setActiveView('map')}
          >
            Coverage Field
          </button>
          <button
            className={`nav-pill ${activeView === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveView('analytics')}
          >
            Signal Intelligence
          </button>
          <button
            className={`nav-pill ${activeView === 'survey' ? 'active' : ''}`}
            onClick={() => setActiveView('survey')}
          >
            Survey Planner
          </button>
          <button
            className={`nav-pill ${activeView === 'devices' ? 'active' : ''}`}
            onClick={() => setActiveView('devices')}
          >
            Devices & Data
          </button>
        </nav>

        {/* Status Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="status-pill">
            <span className={`status-dot ${serialStatus.connected ? 'green' : 'gray'}`} />
            <span>{serialStatus.connected ? serialStatus.node_id || 'ESP32' : 'Hardware Idle'}</span>
          </div>

          <button
            className="btn-clean"
            onClick={() => loadAllData(activeSessionId, interpMethod)}
            disabled={isSyncing}
            title="Synchronize telemetry"
          >
            <span style={{ display: 'inline-block', transform: isSyncing ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}>
              ↻
            </span>
            <span>Sync</span>
          </button>
        </div>
      </header>

      {/* ── Minimalist KPI Metric Strip ────────────────────────── */}
      <div className="metric-strip">
        <div className="metric-item">
          <span className="metric-item-label">Samples:</span>
          <span className="metric-item-value accent">{summary?.total_samples ?? 0}</span>
        </div>

        <div className="metric-item">
          <span className="metric-item-label">Locations:</span>
          <span className="metric-item-value">{summary?.total_locations ?? 0} nodes</span>
        </div>

        <div className="metric-item">
          <span className="metric-item-label">Mean RSSI:</span>
          <span className="metric-item-value emerald">
            {summary?.overall_mean_rssi !== null && summary?.overall_mean_rssi !== undefined
              ? `${summary.overall_mean_rssi.toFixed(1)} dBm`
              : 'N/A'}
          </span>
        </div>

        <div className="metric-item">
          <span className="metric-item-label">Fading σ:</span>
          <span className="metric-item-value amber">
            {summary?.overall_std_rssi !== null && summary?.overall_std_rssi !== undefined
              ? `±${summary.overall_std_rssi.toFixed(1)} dB`
              : 'N/A'}
          </span>
        </div>

        {isSimulation && (
          <div className="metric-item" style={{ marginLeft: 'auto' }}>
            <span className="badge-tag sim">Synthetic Demonstration Data</span>
          </div>
        )}
      </div>

      {/* ── Main Application Content ──────────────────────────── */}
      <main className="main-container">
        {/* VIEW 1: Coverage Map (2D & 3D) */}
        {activeView === 'map' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="main-side-grid">
              <Heatmap2D
                data={heatmapData}
                loading={isSyncing}
                onMethodChange={setInterpMethod}
                method={interpMethod}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                onPointClick={handlePointSelect}
              />

              <SerialPanel
                serialStatus={serialStatus}
                ports={ports}
                onRefreshPorts={pollSerialStatus}
                onRefreshStatus={pollSerialStatus}
                onMeasurementComplete={() => loadAllData(activeSessionId, interpMethod)}
                targetCoords={targetCoords}
              />
            </div>

            {/* Streamlined Recent Telemetry Feed */}
            <div className="clean-card">
              <div className="clean-card-header">
                <div>
                  <h3 className="clean-card-title">Recent Survey Telemetry</h3>
                  <p className="clean-card-subtitle">Timestamped signal captures</p>
                </div>
              </div>

              {measurements.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No telemetry logged. Connect hardware or generate demo dataset.
                </div>
              ) : (
                <table className="clean-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Target SSID</th>
                      <th>Coordinates</th>
                      <th>RSSI</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {measurements.slice(0, 10).map((m, idx) => (
                      <tr key={idx}>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>
                          {new Date(m.timestamp_iso).toLocaleTimeString()}
                        </td>
                        <td>{m.target_ssid || 'Beacon'}</td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>
                          ({m.x_m.toFixed(1)}m, {m.y_m.toFixed(1)}m)
                        </td>
                        <td>
                          <span
                            style={{
                              fontWeight: 600,
                              color:
                                m.rssi_dbm === null
                                  ? '#ef4444'
                                  : m.rssi_dbm >= -55
                                  ? '#34d399'
                                  : m.rssi_dbm >= -70
                                  ? '#38bdf8'
                                  : '#fbbf24',
                            }}
                          >
                            {m.rssi_dbm !== null ? `${m.rssi_dbm} dBm` : 'Failed'}
                          </span>
                        </td>
                        <td>
                          <span className={`badge-tag ${m.scan_status === 'simulated' ? 'sim' : 'real'}`}>
                            {m.scan_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* VIEW 2: Signal Intelligence & Cross-Validation */}
        {activeView === 'analytics' && (
          <SignalAnalytics
            locations={locations}
            validationData={validationData}
          />
        )}

        {/* VIEW 3: Active Survey Planner */}
        {activeView === 'survey' && (
          <SurveyPlanner
            recommendations={recommendations}
            locations={locations}
            roomWidth={heatmapData?.room_width_m || 10}
            roomLength={heatmapData?.room_length_m || 10}
            onSelectPoint={(x, y) => {
              handlePointSelect(x, y);
              setActiveView('map');
            }}
          />
        )}

        {/* VIEW 4: Devices & Sessions */}
        {activeView === 'devices' && (
          <DataManagementView
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelectSession={setActiveSessionId}
            onRefreshData={() => loadAllData(activeSessionId, interpMethod)}
          />
        )}
      </main>
    </>
  );
};

export default App;
