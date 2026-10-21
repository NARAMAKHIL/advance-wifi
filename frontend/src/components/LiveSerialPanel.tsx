import React, { useEffect, useRef, useState } from 'react';
import type { RSSIMeasurement, SerialStatus } from '../types';

interface LiveSerialPanelProps {
  targetCoords?: { x: number; y: number; z: number };
  measurements: RSSIMeasurement[];
  onMeasurement: (measurement: RSSIMeasurement) => void;
  onConnectionChange: (status: SerialStatus) => void;
  onClearLiveData: () => void;
}

type WebSerialPort = any;
const BAUD_RATE = 115200;

export const LiveSerialPanel: React.FC<LiveSerialPanelProps> = ({
  targetCoords, measurements, onMeasurement, onConnectionChange, onClearLiveData,
}) => {
  const [connected, setConnected] = useState(false);
  const [firmwareReady, setFirmwareReady] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [measuring, setMeasuring] = useState(false);
  const [ssid, setSsid] = useState('');
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [z, setZ] = useState(1);
  const [count, setCount] = useState(10);
  const [intervalMs, setIntervalMs] = useState(5000);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [networks, setNetworks] = useState<Array<{ ssid: string; rssi: number; channel: number }>>([]);
  const portRef = useRef<WebSerialPort | null>(null);
  const readerRef = useRef<any>(null);
  const readTaskRef = useRef<Promise<void> | null>(null);
  const connectedRef = useRef(false);
  const callbacksRef = useRef({ onMeasurement, onConnectionChange, onClearLiveData });
  const configRef = useRef({ ssid, x, y, z });
  const sessionIdRef = useRef('live_' + Date.now());
  const sampleRef = useRef(0);

  callbacksRef.current = { onMeasurement, onConnectionChange, onClearLiveData };
  configRef.current = { ssid, x, y, z };

  const addLog = (message: string) => {
    const stamp = new Date().toLocaleTimeString();
    setLogs((current) => ['[' + stamp + '] ' + message, ...current].slice(0, 25));
  };

  const publishStatus = (isConnected: boolean, nodeId: string, version = '') => {
    connectedRef.current = isConnected;
    setConnected(isConnected);
    callbacksRef.current.onConnectionChange({
      connected: isConnected,
      port: isConnected ? 'Browser Web Serial' : null,
      baud_rate: BAUD_RATE,
      device_state: isConnected ? 'connected' : 'disconnected',
      node_id: nodeId,
      firmware_version: version,
      last_message_at: isConnected ? new Date().toISOString() : null,
    });
  };

  const saveMeasurement = (rssi: number | null, meta: Record<string, unknown> = {}) => {
    if (rssi !== null && (!Number.isFinite(rssi) || rssi < -120 || rssi > 0)) rssi = null;
    const record: RSSIMeasurement = {
      timestamp_iso: new Date().toISOString(),
      session_id: sessionIdRef.current,
      measurement_id: 'live_' + String(meta.measurement_id ?? sampleRef.current + 1) + '_' + String(meta.sample_index ?? sampleRef.current + 1),
      sample_index: Number(meta.sample_index ?? sampleRef.current + 1),
      node_id: String(meta.node_id ?? 'ESP32'),
      target_ssid: String(meta.target_ssid ?? (configRef.current.ssid || 'Unknown SSID')),
      bssid: String(meta.bssid ?? ''),
      channel: Number(meta.channel ?? 0),
      rssi_dbm: rssi,
      x_m: Number(meta.x_m ?? configRef.current.x),
      y_m: Number(meta.y_m ?? configRef.current.y),
      z_m: Number(meta.z_m ?? configRef.current.z),
      scan_status: rssi !== null ? 'ok' : (String(meta.scan_status ?? 'target_not_found') === 'scan_failed' ? 'scan_failed' : 'target_not_found'),
      collection_source: 'esp32',
    };
    sampleRef.current += 1;
    callbacksRef.current.onMeasurement(record);
    addLog('Sample ' + String(record.sample_index) + ': ' + (rssi === null ? 'target not found' : rssi + ' dBm'));
    publishStatus(true, record.node_id);
  };

  const parseLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (trimmed.startsWith('{')) {
      try {
        const message = JSON.parse(trimmed);
        if (message.type === 'ready') {
          setFirmwareReady(true);
          publishStatus(true, String(message.node_id || 'ESP32'), String(message.version || ''));
          addLog('WiFiSense firmware ready.');
        } else if (message.type === 'pong' || message.type === 'status' || message.type === 'node_set') {
          if (message.node_id) publishStatus(true, String(message.node_id), String(message.version || ''));
          addLog('Device message: ' + message.type);
        } else if (message.type === 'scan_result') {
          setNetworks(Array.isArray(message.networks) ? message.networks.map((net: any) => ({
            ssid: String(net.ssid || '(hidden SSID)'), rssi: Number(net.rssi), channel: Number(net.channel || 0),
          })) : []);
          addLog('Wi-Fi scan complete.');
        } else if (message.type === 'batch_start') {
          setMeasuring(true);
          addLog('Acquisition started.');
        } else if (message.type === 'measurement') {
          saveMeasurement(typeof message.rssi_dbm === 'number' ? message.rssi_dbm : null, message);
        } else if (message.type === 'batch_complete') {
          setMeasuring(false);
          addLog('Batch complete: ' + String(message.valid_samples ?? 0) + '/' + String(message.total_samples ?? 0) + ' valid.');
        } else if (message.type === 'error') {
          const description = String(message.message || message.code || 'Unknown ESP32 error');
          setErrorMsg(description);
          addLog('ESP32 error: ' + description);
        } else if (message.type === 'scan_start') {
          addLog('Wi-Fi scan started.');
        } else {
          addLog('Device message: ' + String(message.type || 'JSON'));
        }
      } catch {
        addLog('Ignored malformed JSON serial line.');
      }
      return;
    }

    // Compatibility with the earlier sketch: Reading,Time_ms,RSSI_dBm
    const parts = trimmed.split(',').map((part) => part.trim());
    if (parts.length >= 2) {
      const raw = parts[parts.length - 1].replace(/ dBm$/i, '');
      const value = Number(raw);
      if (/^-?\d+(\.\d+)?$/.test(raw) && Number.isFinite(value) && value >= -120 && value <= 0) {
        saveMeasurement(value, { sample_index: Number(parts[0]) || sampleRef.current + 1, node_id: 'ESP32 CSV Stream' });
        return;
      }
    }
    if (!/^(Reading|Time_ms|Measurement|RSSI_dBm|ESP32|WiFiSense)/i.test(trimmed)) addLog('Serial: ' + trimmed.slice(0, 100));
  };

  useEffect(() => {
    if (targetCoords) { setX(targetCoords.x); setY(targetCoords.y); setZ(targetCoords.z); }
  }, [targetCoords]);

  useEffect(() => () => {
    const port = portRef.current;
    try { void readerRef.current?.cancel(); } catch { /* ignored during unmount */ }
    try { if (port?.close) void port.close(); } catch { /* ignored during unmount */ }
  }, []);

  const readLoop = async (port: WebSerialPort) => {
    if (!port.readable) throw new Error('The serial port has no readable stream.');
    const reader = port.readable.getReader();
    readerRef.current = reader;
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (true) {
        const result = await reader.read();
        if (result.done) break;
        buffer += decoder.decode(result.value, { stream: true });
        let newline = buffer.indexOf('\n');
        while (newline >= 0) {
          const line = buffer.slice(0, newline).replace(/\r$/, '');
          buffer = buffer.slice(newline + 1);
          parseLine(line);
          newline = buffer.indexOf('\n');
        }
      }
    } catch (error) {
      if (portRef.current === port && connectedRef.current) addLog('Serial read error: ' + (error instanceof Error ? error.message : 'unknown error'));
    } finally {
      try { reader.releaseLock(); } catch { /* already released */ }
      if (readerRef.current === reader) readerRef.current = null;
      if (portRef.current === port) {
        portRef.current = null;
        setFirmwareReady(false);
        setMeasuring(false);
        publishStatus(false, '');
      }
    }
  };

  const connect = async () => {
    const serialApi = (navigator as Navigator & { serial?: any }).serial;
    if (!serialApi) {
      setErrorMsg('Web Serial is unavailable. Use desktop Chrome or Edge over HTTPS, or use the Python CSV logger on your laptop.');
      return;
    }
    setConnecting(true);
    setErrorMsg(null);
    try {
      const port = await serialApi.requestPort();
      await port.open({ baudRate: BAUD_RATE });
      portRef.current = port;
      sessionIdRef.current = 'live_' + Date.now();
      sampleRef.current = 0;
      setFirmwareReady(false);
      setNetworks([]);
      publishStatus(true, 'ESP32 Serial');
      addLog('USB serial port opened at ' + BAUD_RATE + ' baud.');
      readTaskRef.current = readLoop(port);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Could not open serial port. Check the USB cable and close Arduino Serial Monitor.');
      addLog('Connection failed.');
      setConnected(false);
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    const port = portRef.current;
    setConnecting(true);
    try {
      if (readerRef.current) await readerRef.current.cancel();
      if (readTaskRef.current) await readTaskRef.current;
      if (port?.close) await port.close();
    } catch {
      // Best effort if the USB device was unplugged.
    } finally {
      portRef.current = null;
      setFirmwareReady(false);
      setMeasuring(false);
      publishStatus(false, '');
      addLog('ESP32 disconnected.');
      setConnecting(false);
    }
  };

  const sendCommand = async (payload: Record<string, unknown>) => {
    const port = portRef.current;
    if (!port?.writable) throw new Error('Connect the ESP32 first.');
    const writer = port.writable.getWriter();
    try { await writer.write(new TextEncoder().encode(JSON.stringify(payload) + '\n')); }
    finally { writer.releaseLock(); }
  };

  const startMeasurement = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMsg(null);
    if (!connected || !portRef.current) { setErrorMsg('Connect the ESP32 before starting acquisition.'); return; }
    if (!ssid.trim()) { setErrorMsg('Enter the exact target Wi-Fi SSID.'); return; }
    if (!firmwareReady) {
      setErrorMsg('Serial is open, but the WiFiSense firmware did not confirm readiness. Upload firmware/wifisense_esp32/wifisense_esp32.ino for start/stop controls.');
      return;
    }
    try {
      await sendCommand({
        command: 'START', count: Math.min(100, Math.max(1, Number(count) || 10)),
        interval_ms: Math.min(60000, Math.max(1000, Number(intervalMs) || 5000)),
        ssid: ssid.trim(), bssid: '', x_m: Number(x) || 0, y_m: Number(y) || 0, z_m: Number(z) || 1,
      });
      setMeasuring(true);
      addLog('START command sent for position (' + x + ' m, ' + y + ' m).');
    } catch (error) { setErrorMsg(error instanceof Error ? error.message : 'Could not start acquisition.'); }
  };

  const stopMeasurement = async () => {
    try { await sendCommand({ command: 'STOP' }); addLog('STOP command sent.'); }
    catch (error) { setErrorMsg(error instanceof Error ? error.message : 'Could not stop sampling.'); }
  };

  const scanNetworks = async () => {
    try { await sendCommand({ command: 'SCAN' }); addLog('Requested nearby Wi-Fi scan.'); }
    catch (error) { setErrorMsg(error instanceof Error ? error.message : 'Could not scan.'); }
  };

  const downloadCsv = () => {
    const live = measurements.filter((m) => m.collection_source === 'esp32');
    if (!live.length) { setErrorMsg('No live ESP32 measurements to export yet.'); return; }
    const fields = ['timestamp_iso', 'session_id', 'measurement_id', 'sample_index', 'node_id', 'target_ssid', 'bssid', 'channel', 'rssi_dbm', 'x_m', 'y_m', 'z_m', 'scan_status', 'collection_source'];
    const quote = (value: unknown) => '"' + String(value ?? '').replace(/"/g, '""') + '"';
    const csv = [fields.join(',')].concat(live.map((record) => fields.map((field) => quote((record as unknown as Record<string, unknown>)[field])).join(','))).join('\r\n') + '\r\n';
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'wifisense_live_rssi.csv';
    anchor.click();
    URL.revokeObjectURL(url);
    addLog('Exported ' + live.length + ' real sample(s) to CSV.');
  };

  return (
    <section className="clean-card">
      <div className="clean-card-header">
        <div><h3 className="clean-card-title">Hardware Telemetry</h3><p className="clean-card-subtitle">Direct USB serial · 115200 baud</p></div>
        <div className="status-pill"><span className={'status-dot ' + (connected ? 'green' : 'gray')} /><span>{connected ? (firmwareReady ? 'ESP32 Ready' : 'USB Serial Open') : 'ESP32 Disconnected'}</span></div>
      </div>
      <p style={{ fontSize: '12px', lineHeight: 1.5, color: 'var(--text-muted)', marginBottom: '12px' }}>
        Live browser connection requires desktop Chrome or Edge over HTTPS. For scan/start/stop controls, upload the WiFiSense JSON-line firmware. Close Arduino Serial Monitor first.
      </p>
      {errorMsg && <div role="alert" style={{ padding: '8px 10px', background: 'rgba(248, 113, 113, 0.1)', color: 'var(--accent-rose)', borderRadius: 'var(--radius-sm)', fontSize: '11px', marginBottom: '12px' }}>{errorMsg}</div>}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
        {!connected ? <button className="btn-clean btn-clean-primary" onClick={() => void connect()} disabled={connecting}>{connecting ? 'Connecting…' : 'Connect ESP32'}</button> : <button className="btn-clean btn-clean-danger" onClick={() => void disconnect()} disabled={connecting}>Disconnect</button>}
        <button className="btn-clean" onClick={() => void scanNetworks()} disabled={!connected || !firmwareReady}>Scan Wi-Fi</button>
        <button className="btn-clean" onClick={downloadCsv} disabled={!measurements.some((m) => m.collection_source === 'esp32')}>Download live CSV</button>
        <button className="btn-clean" onClick={onClearLiveData} disabled={measurements.length === 0}>Clear live data</button>
      </div>
      <form onSubmit={(event) => void startMeasurement(event)}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px', marginBottom: '10px' }}>
          <div><label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Target Wi-Fi SSID</label><input className="input-clean" style={{ width: '100%' }} value={ssid} onChange={(event) => setSsid(event.target.value)} placeholder="Exact Wi-Fi name" required /></div>
          <div><label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Samples per point</label><input className="input-clean" style={{ width: '100%' }} type="number" min={1} max={100} value={count} onChange={(event) => setCount(Number(event.target.value) || 10)} required /></div>
          <div><label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>X position (m)</label><input className="input-clean" style={{ width: '100%' }} type="number" step="0.1" value={x} onChange={(event) => setX(Number(event.target.value) || 0)} required /></div>
          <div><label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Y position (m)</label><input className="input-clean" style={{ width: '100%' }} type="number" step="0.1" value={y} onChange={(event) => setY(Number(event.target.value) || 0)} required /></div>
          <div><label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Height Z (m)</label><input className="input-clean" style={{ width: '100%' }} type="number" step="0.1" value={z} onChange={(event) => setZ(Number(event.target.value) || 1)} required /></div>
          <div><label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Interval</label><select className="select-clean" style={{ width: '100%' }} value={intervalMs} onChange={(event) => setIntervalMs(Number(event.target.value))}><option value={5000}>5 seconds</option><option value={10000}>10 seconds</option><option value={2000}>2 seconds (test)</option></select></div>
        </div>
        {measuring ? <button type="button" className="btn-clean btn-clean-danger" style={{ width: '100%', justifyContent: 'center' }} onClick={() => void stopMeasurement()}>Stop sampling</button> : <button type="submit" className="btn-clean btn-clean-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={!connected || !firmwareReady}>Acquire point samples</button>}
      </form>
      {networks.length > 0 && <div style={{ marginTop: '12px', fontSize: '11px' }}><strong>Nearby networks</strong><div style={{ maxHeight: '100px', overflowY: 'auto', marginTop: '6px' }}>{networks.map((network, index) => <div key={network.ssid + network.channel + index}>{network.ssid} · {network.rssi} dBm · Ch {network.channel}</div>)}</div></div>}
      <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: '11px', height: '125px', overflowY: 'auto', lineHeight: 1.6, color: 'var(--text-muted)', marginTop: '14px' }}>
        {logs.length === 0 ? <div>Waiting for ESP32 serial activity…</div> : logs.map((line, index) => <div key={index}>{line}</div>)}
      </div>
    </section>
  );
};
