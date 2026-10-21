/**
 * WiFiSense 3D - Browser Web Serial API Manager
 * ==============================================
 * Connects directly to physical ESP32 hardware via USB in Desktop Chrome / Edge.
 * Allows live RSSI scanning, measurement acquisition, and real-time heatmap updates
 * directly on static web hosting (GitHub Pages) without a local Python server.
 */

import type { RSSIMeasurement, SerialStatus } from '../types';

export type MeasurementCallback = (measurement: RSSIMeasurement) => void;
export type StatusCallback = (status: SerialStatus) => void;
export type LogCallback = (line: string) => void;

class WebSerialManager {
  private port: any = null;
  private reader: any = null;
  private readableStreamClosed: Promise<void> | null = null;
  private keepReading = false;
  private currentBaudRate = 115200;
  private nodeId = '';
  private firmwareVersion = '';
  private currentCoords = { x: 0.0, y: 0.0, z: 1.0 };
  private currentSSID = 'Amrita-2.4G-B244';
  private sampleCounter = 0;

  private measurementListeners: Set<MeasurementCallback> = new Set();
  private statusListeners: Set<StatusCallback> = new Set();
  private logListeners: Set<LogCallback> = new Set();

  public isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  public getStatus(): SerialStatus {
    const isConn = this.port !== null && this.port.readable !== null;
    return {
      connected: isConn,
      port: isConn ? 'USB Serial Device (Web Serial)' : null,
      baud_rate: this.currentBaudRate,
      device_state: isConn ? 'connected' : 'disconnected',
      node_id: this.nodeId || (isConn ? 'ESP32_LIVE' : ''),
      firmware_version: this.firmwareVersion || (isConn ? '1.0.0' : ''),
      last_message_at: isConn ? new Date().toISOString() : null,
    };
  }

  public onMeasurement(cb: MeasurementCallback): () => void {
    this.measurementListeners.add(cb);
    return () => this.measurementListeners.delete(cb);
  }

  public onStatusChange(cb: StatusCallback): () => void {
    this.statusListeners.add(cb);
    return () => this.statusListeners.delete(cb);
  }

  public onLog(cb: LogCallback): () => void {
    this.logListeners.add(cb);
    return () => this.logListeners.delete(cb);
  }

  private notifyStatus(): void {
    const status = this.getStatus();
    this.statusListeners.forEach((cb) => cb(status));
  }

  private log(message: string): void {
    const timestamp = new Date().toLocaleTimeString();
    const formatted = `[${timestamp}] ${message}`;
    this.logListeners.forEach((cb) => cb(formatted));
  }

  public setSurveyConfig(x: number, y: number, z: number, ssid: string): void {
    this.currentCoords = { x, y, z };
    this.currentSSID = ssid;
  }

  public async connect(baudRate = 115200): Promise<SerialStatus> {
    if (!this.isSupported()) {
      throw new Error(
        'Web Serial API is not supported in this browser. Please use desktop Google Chrome, Microsoft Edge, or Opera.'
      );
    }

    try {
      this.currentBaudRate = baudRate;
      this.log('Prompting for USB Serial device...');

      // Request port from user
      const serial = (navigator as any).serial;
      this.port = await serial.requestPort();

      // Open port
      await this.port.open({ baudRate: this.currentBaudRate });
      this.log(`Port opened successfully at ${this.currentBaudRate} baud.`);
      this.notifyStatus();

      // Start read loop
      this.startReading();

      // Send initial probe
      await this.sendCommand('{"command":"PING"}\n');

      return this.getStatus();
    } catch (err: any) {
      this.log(`Connection error: ${err.message || err}`);
      await this.disconnect();
      throw err;
    }
  }

  public async disconnect(): Promise<SerialStatus> {
    this.keepReading = false;

    try {
      if (this.reader) {
        await this.reader.cancel();
      }
      if (this.readableStreamClosed) {
        await this.readableStreamClosed.catch(() => {});
      }
      if (this.port) {
        await this.port.close();
      }
    } catch (err) {
      console.warn('Error during serial close:', err);
    } finally {
      this.port = null;
      this.reader = null;
      this.readableStreamClosed = null;
      this.log('Disconnected from ESP32.');
      this.notifyStatus();
    }

    return this.getStatus();
  }

  public async sendCommand(text: string): Promise<void> {
    if (!this.port || !this.port.writable) {
      throw new Error('Port is not writable or disconnected.');
    }

    try {
      const encoder = new TextEncoder();
      const writer = this.port.writable.getWriter();
      await writer.write(encoder.encode(text));
      writer.releaseLock();
      this.log(`TX -> ${text.trim()}`);
    } catch (err: any) {
      this.log(`TX Error: ${err.message}`);
      throw err;
    }
  }

  public async startMeasurement(options: {
    target_ssid: string;
    x_m: number;
    y_m: number;
    z_m: number;
    count: number;
    interval_ms: number;
  }): Promise<void> {
    this.setSurveyConfig(options.x_m, options.y_m, options.z_m, options.target_ssid);
    this.sampleCounter = 0;

    // Send START command in JSON Lines protocol
    const cmd = JSON.stringify({
      command: 'START',
      ssid: options.target_ssid,
      count: options.count,
      interval_ms: options.interval_ms,
      x_m: options.x_m,
      y_m: options.y_m,
      z_m: options.z_m,
    });

    await this.sendCommand(`${cmd}\n`);
    this.log(`Started measurement batch (${options.count} samples @ (${options.x_m}, ${options.y_m}))`);
  }

  private async startReading(): Promise<void> {
    if (!this.port || !this.port.readable) return;

    this.keepReading = true;

    try {
      const textDecoder = new TextDecoderStream();
      this.readableStreamClosed = this.port.readable.pipeTo(textDecoder.writable);
      this.reader = textDecoder.readable.getReader();

      let buffer = '';

      while (this.keepReading) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) {
          buffer += value;
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || ''; // Keep incomplete trailing fragment in buffer

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed) {
              this.handleIncomingLine(trimmed);
            }
          }
        }
      }
    } catch (err: any) {
      if (this.keepReading) {
        this.log(`Serial read stream error: ${err.message}`);
      }
    } finally {
      if (this.reader) {
        try {
          this.reader.releaseLock();
        } catch {
          // ignore
        }
      }
      this.notifyStatus();
    }
  }

  private handleIncomingLine(line: string): void {
    this.log(`RX <- ${line}`);

    // Try parsing as JSON protocol first (WiFiSense firmware)
    if (line.startsWith('{') && line.endsWith('}')) {
      try {
        const data = JSON.parse(line);
        if (data.type === 'ready') {
          this.nodeId = data.node_id || 'ESP32_01';
          this.firmwareVersion = data.version || '1.0.0';
          this.notifyStatus();
        } else if (data.type === 'measurement') {
          this.sampleCounter++;
          const meas: RSSIMeasurement = {
            timestamp_iso: new Date().toISOString(),
            session_id: 'live_webserial_session',
            measurement_id: `live_meas_${Date.now()}_${this.sampleCounter}`,
            sample_index: data.sample_index || this.sampleCounter,
            node_id: data.node_id || this.nodeId || 'ESP32_LIVE',
            target_ssid: data.ssid || this.currentSSID,
            bssid: data.bssid || '00:00:00:00:00:00',
            channel: data.channel || 6,
            rssi_dbm: Number(data.rssi),
            x_m: data.x_m !== undefined ? Number(data.x_m) : this.currentCoords.x,
            y_m: data.y_m !== undefined ? Number(data.y_m) : this.currentCoords.y,
            z_m: data.z_m !== undefined ? Number(data.z_m) : this.currentCoords.z,
            scan_status: 'ok',
            collection_source: 'esp32',
          };
          this.dispatchMeasurement(meas);
        }
        return;
      } catch {
        // Not valid JSON, fall through to CSV/raw parsing
      }
    }

    // Try parsing comma-separated raw telemetry
    // Format A: Date_Time,Reading,ESP32_Time,SSID,RSSI_dBm (e.g. "2026-09-29 21:40:22,1,4914,Amrita-2.4G-B244,-54 dBm")
    // Format B: Reading,Time_ms,RSSI_dBm (e.g. "1,1250,-54")
    const parts = line.split(',');
    if (parts.length >= 3) {
      let readingIdx = 1;
      let ssid = this.currentSSID;
      let rawRssi = '';

      if (parts.length >= 5) {
        // Date_Time,Reading,ESP32_Time,SSID,RSSI_dBm
        readingIdx = parseInt(parts[1].trim(), 10) || ++this.sampleCounter;
        ssid = parts[3].trim() || this.currentSSID;
        rawRssi = parts[4].trim();
      } else if (parts.length === 3) {
        // Reading,Time_ms,RSSI_dBm
        readingIdx = parseInt(parts[0].trim(), 10) || ++this.sampleCounter;
        rawRssi = parts[2].trim();
      }

      // Clean RSSI
      const cleanNum = parseFloat(rawRssi.replace(/[^0-9.-]/g, ''));
      if (!isNaN(cleanNum) && cleanNum !== -999) {
        this.sampleCounter = readingIdx;
        const meas: RSSIMeasurement = {
          timestamp_iso: new Date().toISOString(),
          session_id: 'live_webserial_session',
          measurement_id: `live_meas_${Date.now()}_${readingIdx}`,
          sample_index: readingIdx,
          node_id: this.nodeId || 'ESP32_LIVE',
          target_ssid: ssid,
          bssid: 'A4:CF:12:89:B2:44',
          channel: 6,
          rssi_dbm: cleanNum,
          x_m: this.currentCoords.x,
          y_m: this.currentCoords.y,
          z_m: this.currentCoords.z,
          scan_status: 'ok',
          collection_source: 'esp32',
        };
        this.dispatchMeasurement(meas);
      }
    }
  }

  private dispatchMeasurement(meas: RSSIMeasurement): void {
    this.measurementListeners.forEach((cb) => cb(meas));
  }
}

export const webSerial = new WebSerialManager();
