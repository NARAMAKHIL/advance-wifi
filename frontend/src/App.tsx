import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Heatmap2D } from './components/Heatmap2D';
import { LiveSerialPanel } from './components/LiveSerialPanel';
import { SignalAnalytics } from './components/SignalAnalytics';
import { SurveyPlanner } from './components/SurveyPlanner';
import { DataManagementView } from './components/DataManagementView';
import { api } from './services/api';
import { buildLiveView } from './services/liveData';
import type {
  AnalyticsSummary,
  HeatmapData,
  LocationSummary,
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

  // Data Source Mode: explicit separation of demo vs live hardware
  const [dataSource, setDataSource] = useState<'demo' | 'live'>('demo');
  const [liveMeasurements, setLiveMeasurements] = useState<RSSIMeasurement[]>([]);

  // Hardware serial state
  const [serialStatus, setSerialStatus] = useState<SerialStatus>({
    connected: false,
    port: null,
    baud_rate: 115200,
    device_state: 'disconnected',
    node_id: '',
    firmware_version: '',
    last_message_at: null,
  });

  // Telemetry & analytics data (Demo / Static)
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

  const isFetchingRef = useRef<boolean>(false);

  // Load demo data
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
      console.error('Error loading demo data:', err);
    } finally {
      setIsSyncing(false);
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    loadAllData(activeSessionId, interpMethod);
  }, []);

  useEffect(() => {
    if (dataSource === 'demo') {
      loadAllData(activeSessionId, interpMethod);
    }
  }, [activeSessionId, interpMethod, loadAllData, dataSource]);

  const handlePointSelect = (x: number, y: number) => {
    setTargetCoords({ x, y, z: 1.0 });
  };

  // Derive views: strictly isolate demo from live hardware
  const liveView = useMemo(() => buildLiveView(liveMeasurements), [liveMeasurements]);
  const visibleSummary = dataSource === 'demo' ? summary : liveView.summary;
  const visibleLocations = dataSource === 'demo' ? locations : liveView.locations;
  const visibleMeasurements = dataSource === 'demo' ? measurements : liveMeasurements;
  const visibleHeatmapData = dataSource === 'demo' ? heatmapData : liveView.heatmap;
  const visibleRecommendations = dataSource === 'demo' ? recommendations : [];
  const visibleValidationData = dataSource === 'demo' ? validationData : null;
  const visibleSessions = dataSource === 'demo' ? sessions : [];
  const isSimulation = dataSource === 'demo';

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
            type="button"
            className={`nav-pill ${activeView === 'map' ? 'active' : ''}`}
            onClick={() => setActiveView('map')}
          >
            Coverage Field
          </button>
          <button
            type="button"
            className={`nav-pill ${activeView === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveView('analytics')}
          >
            Signal Intelligence
          </button>
          <button
            type="button"
            className={`nav-pill ${activeView === 'survey' ? 'active' : ''}`}
            onClick={() => setActiveView('survey')}
          >
            Survey Planner
          </button>
          <button
            type="button"
            className={`nav-pill ${activeView === 'devices' ? 'active' : ''}`}
            onClick={() => setActiveView('devices')}
          >
            Devices & Data
          </button>
        </nav>

        {/* Hardware Status & Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="status-pill">
            <span className={`status-dot ${serialStatus.connected ? 'green' : 'gray'}`} />
            <span>
              {serialStatus.connected
                ? serialStatus.node_id || 'ESP32 Live'
                : dataSource === 'demo'
                ? 'Demo Mode'
                : 'ESP32 Disconnected'}
            </span>
          </div>

          <button
            type="button"
            className="btn-clean"
            onClick={() => {
              if (dataSource === 'demo') void loadAllData(activeSessionId, interpMethod);
            }}
            disabled={isSyncing || dataSource === 'live'}
            title={dataSource === 'demo' ? 'Refresh demo dataset' : 'Live mode uses only serial data'}
          >
            <span
              style={{
                display: 'inline-block',
                transform: isSyncing ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.3s',
              }}
            >
              ↻
            </span>
            <span>Sync</span>
          </button>
        </div>
      </header>

      {/* ── Data Source Mode Toggle Strip ────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          flexWrap: 'wrap',
          background: 'var(--surface-sunken)',
        }}
      >
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
          Data source:
        </span>
        <button
          type="button"
          className={'btn-clean ' + (dataSource === 'demo' ? 'btn-clean-primary' : '')}
          aria-pressed={dataSource === 'demo'}
          onClick={() => setDataSource('demo')}
        >
          📁 Demo Data
        </button>
        <button
          type="button"
          className={'btn-clean ' + (dataSource === 'live' ? 'btn-clean-primary' : '')}
          aria-pressed={dataSource === 'live'}
          onClick={() => setDataSource('live')}
        >
          🔌 Live ESP32
        </button>
        <span style={{ fontSize: '11px', color: dataSource === 'demo' ? '#d97706' : '#0f9f6e', fontWeight: 600 }}>
          {dataSource === 'demo'
            ? 'DEMO / SIMULATED DATA · not live hardware readings'
            : serialStatus.connected
            ? 'LIVE HARDWARE MODE · only physical serial readings are shown'
            : 'LIVE HARDWARE MODE · ESP32 disconnected; connect via Web Serial below'}
        </span>
      </div>

      {/* ── Minimalist KPI Metric Strip ────────────────────────── */}
      <div className="metric-strip">
        <div className="metric-item">
          <span className="metric-item-label">Samples:</span>
          <span className="metric-item-value accent">{visibleSummary?.total_samples ?? 0}</span>
        </div>

        <div className="metric-item">
          <span className="metric-item-label">Locations:</span>
          <span className="metric-item-value">{visibleSummary?.total_locations ?? 0} nodes</span>
        </div>

        <div className="metric-item">
          <span className="metric-item-label">Mean RSSI:</span>
          <span className="metric-item-value emerald">
            {visibleSummary?.overall_mean_rssi !== null && visibleSummary?.overall_mean_rssi !== undefined
              ? `${visibleSummary.overall_mean_rssi.toFixed(1)} dBm`
              : 'N/A'}
          </span>
        </div>

        <div className="metric-item">
          <span className="metric-item-label">Fading σ:</span>
          <span className="metric-item-value amber">
            {visibleSummary?.overall_std_rssi !== null && visibleSummary?.overall_std_rssi !== undefined
              ? `±${visibleSummary.overall_std_rssi.toFixed(1)} dB`
              : 'N/A'}
          </span>
        </div>

        {isSimulation && (
          <div className="metric-item" style={{ marginLeft: 'auto' }}>
            <span className="badge-tag sim">DEMO DATA · NOT LIVE</span>
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
                data={visibleHeatmapData}
                loading={isSyncing}
                onMethodChange={setInterpMethod}
                method={interpMethod}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                onPointClick={handlePointSelect}
              />

              <LiveSerialPanel
                measurements={liveMeasurements}
                targetCoords={targetCoords}
                onMeasurement={(measurement) => {
                  setDataSource('live');
                  setLiveMeasurements((current) => [...current, measurement].slice(-2000));
                }}
                onConnectionChange={(status) => {
                  setSerialStatus(status);
                  if (status.connected) setDataSource('live');
                }}
                onClearLiveData={() => setLiveMeasurements([])}
              />
            </div>

            {/* Streamlined Recent Telemetry Feed */}
            <div className="clean-card">
              <div className="clean-card-header">
                <div>
                  <h3 className="clean-card-title">
                    {dataSource === 'live' ? 'Live Hardware Telemetry' : 'Demo Telemetry Log'}
                  </h3>
                  <p className="clean-card-subtitle">
                    {dataSource === 'live'
                      ? 'Real-time readings streamed directly from physical ESP32'
                      : 'Saved sample benchmark records'}
                  </p>
                </div>
              </div>

              {visibleMeasurements.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No measurements for this data source yet. Connect the ESP32 and acquire samples, or switch to Demo Data for an explicitly simulated example.
                </div>
              ) : (
                <table className="clean-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Sample</th>
                      <th>SSID</th>
                      <th>Position (X, Y)</th>
                      <th>RSSI</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleMeasurements.slice(0, 10).map((m, idx) => (
                      <tr key={m.measurement_id || idx}>
                        <td style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                          {new Date(m.timestamp_iso).toLocaleTimeString()}
                        </td>
                        <td>#{m.sample_index}</td>
                        <td style={{ fontWeight: 600 }}>{m.target_ssid}</td>
                        <td>
                          ({m.x_m}m, {m.y_m}m)
                        </td>
                        <td>
                          <span
                            style={{
                              fontWeight: 700,
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
          <SignalAnalytics locations={visibleLocations} validationData={visibleValidationData} />
        )}

        {/* VIEW 3: Active Survey Planner */}
        {activeView === 'survey' && (
          <SurveyPlanner
            recommendations={visibleRecommendations}
            locations={visibleLocations}
            roomWidth={visibleHeatmapData?.room_width_m || 8}
            roomLength={visibleHeatmapData?.room_length_m || 8}
            onSelectPoint={(x, y) => {
              handlePointSelect(x, y);
              setActiveView('map');
            }}
          />
        )}

        {/* VIEW 4: Devices & Sessions */}
        {activeView === 'devices' && (
          <DataManagementView
            sessions={visibleSessions}
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
