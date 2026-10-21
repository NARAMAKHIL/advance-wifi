import React, { useState, useEffect } from 'react';
import type { PortInfo, RSSIMeasurement, SerialStatus, StartMeasurementRequest } from '../types';
import { api } from '../services/api';
import { webSerial } from '../services/webSerial';
import { downloadCsvFile, exportMeasurementsToCsv } from '../services/clientAnalytics';

interface SerialPanelProps {
  serialStatus: SerialStatus;
  ports: PortInfo[];
  onRefreshPorts: () => void;
  onRefreshStatus: () => void;
  onMeasurementComplete?: () => void;
  targetCoords?: { x: number; y: number; z: number };
  currentMeasurements?: RSSIMeasurement[];
  onLiveMeasurement?: (m: RSSIMeasurement) => void;
}

export const SerialPanel: React.FC<SerialPanelProps> = ({
  serialStatus,
  ports,
  onRefreshPorts,
  onRefreshStatus,
  onMeasurementComplete,
  targetCoords,
  currentMeasurements = [],
  onLiveMeasurement,
}) => {
  const [selectedPort, setSelectedPort] = useState<string>('');
  const [baudRate, setBaudRate] = useState<number>(115200);
  const [connecting, setConnecting] = useState(false);
  const [measuring, setMeasuring] = useState(false);

  // Form parameters
  const [ssid, setSsid] = useState<string>('Amrita-2.4G-B244');
  const [x, setX] = useState<number>(0.0);
  const [y, setY] = useState<number>(0.0);
  const [z, setZ] = useState<number>(1.0);
  const [count, setCount] = useState<number>(10);
  const [intervalMs] = useState<number>(5000);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [isWebSerialConnected, setIsWebSerialConnected] = useState<boolean>(false);

  const hasWebSerial = webSerial.isSupported();

  useEffect(() => {
    if (ports.length > 0 && !selectedPort) {
      setSelectedPort(ports[0].port);
    }
  }, [ports, selectedPort]);

  useEffect(() => {
    if (targetCoords) {
      setX(targetCoords.x);
      setY(targetCoords.y);
      setZ(targetCoords.z);
    }
  }, [targetCoords]);

  // Hook up web serial logs and measurements
  useEffect(() => {
    const unsubLog = webSerial.onLog((msg) => {
      setLogLines((prev) => [msg, ...prev.slice(0, 40)]);
    });

    const unsubMeas = webSerial.onMeasurement((m) => {
      if (onLiveMeasurement) onLiveMeasurement(m);
    });

    const unsubStatus = webSerial.onStatusChange((s) => {
      setIsWebSerialConnected(s.connected);
      onRefreshStatus();
    });

    return () => {
      unsubLog();
      unsubMeas();
      unsubStatus();
    };
  }, [onLiveMeasurement, onRefreshStatus]);

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogLines((prev) => [`[${timestamp}] ${msg}`, ...prev.slice(0, 40)]);
  };

  // Browser Web Serial Connect
  const handleWebSerialConnect = async () => {
    setConnecting(true);
    setErrorMsg(null);
    try {
      await webSerial.connect(baudRate);
      addLog(`Browser Web Serial connected at ${baudRate} baud.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Web Serial connection failed');
      addLog(`Connection error: ${err.message || err}`);
    } finally {
      setConnecting(false);
    }
  };

  const handleWebSerialDisconnect = async () => {
    setConnecting(true);
    try {
      await webSerial.disconnect();
      addLog('Web Serial disconnected.');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setConnecting(false);
    }
  };

  // Backend Serial Connect (Fallback if backend server is running)
  const handleBackendConnect = async () => {
    if (!selectedPort) return;
    setConnecting(true);
    setErrorMsg(null);
    try {
      await api.connectSerial(selectedPort, baudRate);
      addLog(`Connected via backend: ${selectedPort} @ ${baudRate}`);
      onRefreshStatus();
    } catch (err: any) {
      setErrorMsg(err.message || 'Backend serial connection failed');
    } finally {
      setConnecting(false);
    }
  };

  const handleBackendDisconnect = async () => {
    setConnecting(true);
    setErrorMsg(null);
    try {
      await api.disconnectSerial();
      addLog('Backend serial disconnected.');
      onRefreshStatus();
    } catch (err: any) {
      setErrorMsg(err.message || 'Disconnect failed');
    } finally {
      setConnecting(false);
    }
  };

  // Trigger measurement acquisition
  const handleStartMeasurement = async (e: React.FormEvent) => {
    e.preventDefault();
    setMeasuring(true);
    setErrorMsg(null);

    const req: StartMeasurementRequest = {
      target_ssid: ssid,
      x_m: Number(x),
      y_m: Number(y),
      z_m: Number(z),
      count: Number(count),
      interval_ms: Number(intervalMs),
    };

    try {
      if (isWebSerialConnected) {
        await webSerial.startMeasurement(req);
        addLog(`Started acquisition at (${x}m, ${y}m) for ${count} samples...`);
        if (onMeasurementComplete) onMeasurementComplete();
      } else {
        await api.startMeasurement(req);
        addLog(`Started backend acquisition at (${x}m, ${y}m)`);
        onRefreshStatus();
        if (onMeasurementComplete) onMeasurementComplete();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to start measurement');
    } finally {
      setMeasuring(false);
    }
  };

  const isConnected = isWebSerialConnected || serialStatus.connected;

  const handleExportCsv = () => {
    if (currentMeasurements.length === 0) {
      setErrorMsg('No measurements to export. Record or load data first.');
      return;
    }
    const csv = exportMeasurementsToCsv(currentMeasurements);
    downloadCsvFile(csv, `wifisense_measurements_${Date.now()}.csv`);
    addLog(`Exported ${currentMeasurements.length} measurements to CSV.`);
  };

  return (
    <div className="clean-card">
      <div className="clean-card-header">
        <div>
          <h3 className="clean-card-title">Hardware Telemetry</h3>
          <p className="clean-card-subtitle">Live ESP32 USB serial acquisition</p>
        </div>

        <div className="status-pill">
          <span className={`status-dot ${isConnected ? 'green' : 'gray'}`} />
          <span>
            {isWebSerialConnected
              ? 'ESP32 (Web Serial)'
              : serialStatus.connected
              ? `${serialStatus.node_id || 'ESP32'} (Backend)`
              : 'Hardware Idle'}
          </span>
        </div>
      </div>

      {errorMsg && (
        <div
          style={{
            padding: '6px 10px',
            background: 'rgba(248, 113, 113, 0.15)',
            border: '1px solid rgba(248, 113, 113, 0.3)',
            color: '#f87171',
            borderRadius: '6px',
            fontSize: '11px',
            marginBottom: '12px',
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* Primary Connection: Web Serial (Direct USB in Chrome/Edge) */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(51, 65, 85, 0.8)',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '14px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8' }}>
            ⚡ BROWSER DIRECT USB SERIAL (CHROME / EDGE)
          </span>
          <span style={{ fontSize: '10px', color: '#94a3b8' }}>115200 baud</span>
        </div>

        {hasWebSerial ? (
          <div style={{ display: 'flex', gap: '8px' }}>
            {!isWebSerialConnected ? (
              <button
                type="button"
                className="btn-clean btn-clean-primary"
                style={{ flex: 1, padding: '8px 12px', fontWeight: 700 }}
                onClick={handleWebSerialConnect}
                disabled={connecting}
              >
                {connecting ? 'Connecting...' : '🔌 Connect ESP32 (Web Serial)'}
              </button>
            ) : (
              <button
                type="button"
                className="btn-clean btn-clean-danger"
                style={{ flex: 1, padding: '8px 12px', fontWeight: 700 }}
                onClick={handleWebSerialDisconnect}
                disabled={connecting}
              >
                Disconnect ESP32
              </button>
            )}
          </div>
        ) : (
          <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>
            Web Serial is supported on desktop Google Chrome and Microsoft Edge. For Firefox or Safari, please use the
            Python CSV logger script (<code>python scripts/esp32_csv_logger.py</code>).
          </p>
        )}
      </div>

      {/* Alternative Backend Port Row */}
      {ports.length > 0 && !isWebSerialConnected && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <select
            className="select-clean"
            style={{ flex: 2 }}
            value={selectedPort}
            onChange={(e) => setSelectedPort(e.target.value)}
            disabled={serialStatus.connected}
          >
            {ports.map((p) => (
              <option key={p.port} value={p.port}>
                {p.port}
              </option>
            ))}
          </select>

          <select
            className="select-clean"
            style={{ flex: 1 }}
            value={baudRate}
            onChange={(e) => setBaudRate(Number(e.target.value))}
            disabled={serialStatus.connected}
          >
            <option value={115200}>115200</option>
            <option value={9600}>9600</option>
            <option value={921600}>921600</option>
          </select>

          {!serialStatus.connected ? (
            <button
              type="button"
              className="btn-clean"
              onClick={handleBackendConnect}
              disabled={connecting || !selectedPort}
            >
              Backend Connect
            </button>
          ) : (
            <button
              type="button"
              className="btn-clean btn-clean-danger"
              onClick={handleBackendDisconnect}
              disabled={connecting}
            >
              Disconnect
            </button>
          )}

          <button type="button" className="btn-clean" onClick={onRefreshPorts} title="Refresh local ports">
            ↻
          </button>
        </div>
      )}

      {/* Point Acquisition Form */}
      <form onSubmit={handleStartMeasurement}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '12px' }}>
          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
              SSID
            </label>
            <input
              type="text"
              className="input-clean"
              style={{ width: '100%' }}
              value={ssid}
              onChange={(e) => setSsid(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
              X (m)
            </label>
            <input
              type="number"
              step="0.1"
              className="input-clean"
              style={{ width: '100%' }}
              value={x}
              onChange={(e) => setX(parseFloat(e.target.value) || 0)}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
              Y (m)
            </label>
            <input
              type="number"
              step="0.1"
              className="input-clean"
              style={{ width: '100%' }}
              value={y}
              onChange={(e) => setY(parseFloat(e.target.value) || 0)}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
              Samples
            </label>
            <input
              type="number"
              className="input-clean"
              style={{ width: '100%' }}
              value={count}
              min="1"
              max="50"
              onChange={(e) => setCount(parseInt(e.target.value) || 10)}
              required
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="submit"
            className="btn-clean btn-clean-primary"
            style={{ flex: 1, padding: '8px 12px' }}
            disabled={measuring || !isConnected}
          >
            {measuring ? 'Acquiring...' : '▶ Acquire Point Batch'}
          </button>

          <button
            type="button"
            className="btn-clean"
            onClick={handleExportCsv}
            disabled={currentMeasurements.length === 0}
            title="Download CSV dataset for MATLAB or Excel"
          >
            💾 Export CSV
          </button>
        </div>
      </form>

      {/* Live Serial Terminal Stream */}
      <div style={{ marginTop: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Live Serial Console (115200 baud)
          </span>
          <button
            type="button"
            className="btn-clean"
            style={{ fontSize: '10px', padding: '2px 6px' }}
            onClick={() => setLogLines([])}
          >
            Clear
          </button>
        </div>

        <div
          style={{
            background: 'var(--surface-sunken)',
            padding: '8px',
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            height: '110px',
            overflowY: 'auto',
            color: 'var(--text-secondary)',
            display: 'flex',
            flexDirection: 'column-reverse',
          }}
        >
          {logLines.length === 0 ? (
            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
              {isConnected
                ? 'Listening for incoming ESP32 RSSI serial frames...'
                : 'Connect ESP32 via Web Serial to stream live serial telemetry.'}
            </span>
          ) : (
            logLines.map((l, i) => <div key={i}>{l}</div>)
          )}
        </div>
      </div>
    </div>
  );
};
