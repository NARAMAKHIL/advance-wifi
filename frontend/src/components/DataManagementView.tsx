import React, { useState } from 'react';
import type { SessionInfo } from '../types';
import { api } from '../services/api';

interface DataManagementViewProps {
  sessions: SessionInfo[];
  activeSessionId: string | null;
  onSelectSession: (id: string | null) => void;
  onRefreshData: () => void;
}

export const DataManagementView: React.FC<DataManagementViewProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onRefreshData,
}) => {
  const [generatingDemo, setGeneratingDemo] = useState(false);
  const [demoMessage, setDemoMessage] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  // Demo generator parameters
  const [roomWidth, setRoomWidth] = useState(8.0);
  const [roomLength, setRoomLength] = useState(6.0);
  const [gridSpacing, setGridSpacing] = useState(1.0);
  const [samplesPerPoint, setSamplesPerPoint] = useState(10);

  const handleGenerateDemo = async () => {
    setGeneratingDemo(true);
    setDemoMessage(null);
    try {
      const res = await api.generateSimulation({
        roomWidth,
        roomLength,
        gridSpacing,
        samplesPerPoint,
      });
      setDemoMessage(`Generated ${res.data_points} points (${res.locations} locations)`);
      onRefreshData();
      if (res.session_id) onSelectSession(res.session_id);
    } catch (err: any) {
      setDemoMessage(`Error: ${err.message}`);
    } finally {
      setGeneratingDemo(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMessage(null);
    try {
      const res = await api.importCsv(file);
      setImportMessage(`Imported ${res.rows_imported} rows from ${res.filename}`);
      onRefreshData();
    } catch (err: any) {
      setImportMessage(`Import error: ${err.message}`);
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!window.confirm(`Delete session "${sessionId}"?`)) return;
    try {
      await api.deleteSession(sessionId);
      if (activeSessionId === sessionId) onSelectSession(null);
      onRefreshData();
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="two-col">
        {/* Synthetic Demo Generator */}
        <div className="clean-card">
          <div className="clean-card-header">
            <div>
              <h3 className="clean-card-title">Synthetic Demonstration Survey</h3>
              <p className="clean-card-subtitle">Physics-based simulation for testing without hardware</p>
            </div>
          </div>

          {demoMessage && (
            <div style={{ padding: '6px 10px', background: 'rgba(52, 211, 153, 0.1)', color: '#34d399', borderRadius: 'var(--radius-sm)', fontSize: '11px', marginBottom: '12px' }}>
              {demoMessage}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '14px' }}>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Width (m)</label>
              <input
                type="number"
                className="input-clean"
                style={{ width: '100%' }}
                value={roomWidth}
                onChange={(e) => setRoomWidth(parseFloat(e.target.value) || 8)}
              />
            </div>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Length (m)</label>
              <input
                type="number"
                className="input-clean"
                style={{ width: '100%' }}
                value={roomLength}
                onChange={(e) => setRoomLength(parseFloat(e.target.value) || 6)}
              />
            </div>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Spacing (m)</label>
              <input
                type="number"
                step="0.5"
                className="input-clean"
                style={{ width: '100%' }}
                value={gridSpacing}
                onChange={(e) => setGridSpacing(parseFloat(e.target.value) || 1)}
              />
            </div>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Samples</label>
              <input
                type="number"
                className="input-clean"
                style={{ width: '100%' }}
                value={samplesPerPoint}
                onChange={(e) => setSamplesPerPoint(parseInt(e.target.value) || 10)}
              />
            </div>
          </div>

          <button
            className="btn-clean btn-clean-primary"
            onClick={handleGenerateDemo}
            disabled={generatingDemo}
          >
            {generatingDemo ? 'Generating...' : 'Generate Synthetic Survey'}
          </button>
        </div>

        {/* Dataset I/O */}
        <div className="clean-card">
          <div className="clean-card-header">
            <div>
              <h3 className="clean-card-title">Dataset Transfer</h3>
              <p className="clean-card-subtitle">Export or import CSV measurements</p>
            </div>
          </div>

          {importMessage && (
            <div style={{ padding: '6px 10px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', borderRadius: 'var(--radius-sm)', fontSize: '11px', marginBottom: '12px' }}>
              {importMessage}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
            <a
              href={api.getExportUrl(activeSessionId || undefined)}
              download="wifisense_export.csv"
              className="btn-clean"
            >
              Export CSV {activeSessionId ? `(${activeSessionId})` : '(All)'}
            </a>

            <label className="btn-clean" style={{ cursor: 'pointer' }}>
              <span>{importing ? 'Importing...' : 'Import External CSV'}</span>
              <input type="file" accept=".csv" onChange={handleFileUpload} style={{ display: 'none' }} disabled={importing} />
            </label>
          </div>
        </div>
      </div>

      {/* Recorded Sessions Table */}
      <div className="clean-card">
        <div className="clean-card-header">
          <div>
            <h3 className="clean-card-title">Recorded Survey Sessions</h3>
            <p className="clean-card-subtitle">Filter or review collected sessions</p>
          </div>

          <button
            className={`btn-clean ${activeSessionId === null ? 'btn-clean-primary' : ''}`}
            onClick={() => onSelectSession(null)}
          >
            All Combined
          </button>
        </div>

        {sessions.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No recorded sessions available.
          </div>
        ) : (
          <table className="clean-table">
            <thead>
              <tr>
                <th>Session ID</th>
                <th>Target SSID</th>
                <th>Source</th>
                <th>Locations</th>
                <th>Samples</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((sess) => {
                const isSelected = activeSessionId === sess.session_id;
                return (
                  <tr
                    key={sess.session_id}
                    style={{ background: isSelected ? 'rgba(56, 189, 248, 0.08)' : undefined }}
                  >
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: isSelected ? 'var(--accent-cyan)' : 'inherit' }}>
                      {sess.session_id}
                    </td>
                    <td>{sess.target_ssid || 'Default'}</td>
                    <td>
                      <span className={`badge-tag ${sess.collection_source === 'simulation' ? 'sim' : 'real'}`}>
                        {sess.collection_source}
                      </span>
                    </td>
                    <td>{sess.total_locations} pts</td>
                    <td>{sess.total_measurements}</td>
                    <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {new Date(sess.created_at).toLocaleDateString()} {new Date(sess.created_at).toLocaleTimeString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className={`btn-clean ${isSelected ? 'btn-clean-primary' : ''}`}
                          style={{ padding: '3px 8px', fontSize: '11px' }}
                          onClick={() => onSelectSession(sess.session_id)}
                        >
                          {isSelected ? 'Active' : 'Select'}
                        </button>
                        <button
                          className="btn-clean btn-clean-danger"
                          style={{ padding: '3px 8px', fontSize: '11px' }}
                          onClick={() => handleDeleteSession(sess.session_id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
