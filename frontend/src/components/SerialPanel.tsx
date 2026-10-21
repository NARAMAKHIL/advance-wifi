import React, { useState, useEffect } from 'react';
import type { PortInfo, SerialStatus, StartMeasurementRequest } from '../types';
import { api } from '../services/api';

interface SerialPanelProps {
  serialStatus: SerialStatus;
  ports: PortInfo[];
  onRefreshPorts: () => void;
  onRefreshStatus: () => void;
  onMeasurementComplete?: () => void;
  targetCoords?: { x: number; y: number; z: number };
}

export const SerialPanel: React.FC<SerialPanelProps> = ({
  serialStatus,
  ports,
  onRefreshPorts,
  onRefreshStatus,
  onMeasurementComplete,
  targetCoords,
}) => {
  const [selectedPort, setSelectedPort] = useState<string>('');
  const [baudRate, setBaudRate] = useState<number>(115200);
  const [connecting, setConnecting] = useState(false);
  const [measuring, setMeasuring] = useState(false);

  // Measurement batch form state
  const [ssid, setSsid] = useState<string>('WiFiSense_AP');
  const [x, setX] = useState<number>(0.0);
  const [y, setY] = useState<number>(0.0);
  const [z, setZ] = useState<number>(1.0);
  const [count, setCount] = useState<number>(10);
  const [intervalMs] = useState<number>(2000);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);

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

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogLines((prev) => [`[${timestamp}] ${msg}`, ...prev.slice(0, 30)]);
  };

  const handleConnect = async () => {
    if (!selectedPort) return;
    setConnecting(true);
    setErrorMsg(null);
    try {
      await api.connectSerial(selectedPort, baudRate);
      addLog(`Connected: ${selectedPort} @ ${baudRate}`);
      onRefreshStatus();
    } catch (err: any) {
      setErrorMsg(err.message || 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setConnecting(true);
    setErrorMsg(null);
    try {
      await api.disconnectSerial();
      addLog('Disconnected.');
      onRefreshStatus();
    } catch (err: any) {
      setErrorMsg(err.message || 'Disconnect failed');
    } finally {
      setConnecting(false);
    }
  };

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
      await api.startMeasurement(req);
      addLog(`Started acquisition at (${x}m, ${y}m)`);
      onRefreshStatus();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to start');
    } finally {
      setMeasuring(false);
    }
  };

  const handleStopMeasurement = async () => {
    try {
      await api.stopMeasurement();
      addLog('Acquisition halted.');
      onRefreshStatus();
      if (onMeasurementComplete) onMeasurementComplete();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  return (
    <div className="clean-card">
      <div className="clean-card-header">
        <div>
          <h3 className="clean-card-title">Hardware Telemetry</h3>
          <p className="clean-card-subtitle">ESP32 link and survey point capture</p>
        </div>

        <div className="status-pill">
          <span className={`status-dot ${serialStatus.connected ? 'green' : 'gray'}`} />
          <span>{serialStatus.connected ? `${serialStatus.node_id || 'ESP32'} Connected` : 'Disconnected'}</span>
        </div>
      </div>

      {errorMsg && (
        <div style={{ padding: '6px 10px', background: 'rgba(248, 113, 113, 0.1)', color: 'var(--accent-rose)', borderRadius: 'var(--radius-sm)', fontSize: '11px', marginBottom: '12px' }}>
          {errorMsg}
        </div>
      )}

      {/* Connection Row */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <select
          className="select-clean"
          style={{ flex: 2 }}
          value={selectedPort}
          onChange={(e) => setSelectedPort(e.target.value)}
          disabled={serialStatus.connected}
        >
          {ports.length === 0 ? (
            <option value="">No serial devices detected</option>
          ) : (
            ports.map((p) => (
              <option key={p.port} value={p.port}>
                {p.port}
              </option>
            ))
          )}
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
            className="btn-clean btn-clean-primary"
            onClick={handleConnect}
            disabled={connecting || !selectedPort}
          >
            Connect
          </button>
        ) : (
          <button
            className="btn-clean btn-clean-danger"
            onClick={handleDisconnect}
            disabled={connecting}
          >
            Disconnect
          </button>
        )}

        <button className="btn-clean" onClick={onRefreshPorts} title="Refresh available ports">
          ↻
        </button>
      </div>

      {/* Point Acquisition Form */}
      <form onSubmit={handleStartMeasurement}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '12px' }}>
          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>SSID</label>
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
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>X (m)</label>
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
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Y (m)</label>
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
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Samples</label>
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

        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          {serialStatus.device_state === 'measuring' ? (
            <button
              type="button"
              className="btn-clean btn-clean-danger"
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={handleStopMeasurement}
            >
              Stop Sampling
            </button>
          ) : (
            <button
              type="submit"
              className="btn-clean btn-clean-primary"
              style={{ flex: 1, justifyContent: 'center' }}
              disabled={!serialStatus.connected || measuring}
            >
              Acquire Point Samples
            </button>
          )}

          <button
            type="button"
            className="btn-clean"
            disabled={!serialStatus.connected}
            onClick={() => api.scanNetworks().then(() => addLog('Scan started'))}
          >
            Scan Channels
          </button>
        </div>
      </form>

      {/* Compact Log Stream */}
      <div
        style={{
          background: 'var(--bg-input)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '8px 10px',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          height: '110px',
          overflowY: 'auto',
          lineHeight: '1.6',
          color: 'var(--text-muted)',
        }}
      >
        {logLines.length === 0 ? (
          <div>Awaiting serial link activity...</div>
        ) : (
          logLines.map((line, i) => <div key={i}>{line}</div>)
        )}
      </div>
    </div>
  );
};
