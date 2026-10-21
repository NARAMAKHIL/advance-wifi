import React, { useState } from 'react';
import Plot from 'react-plotly.js';
import { Box, Eye, Palette } from 'lucide-react';
import type { HeatmapData } from '../types';

interface Heatmap3DProps {
  data: HeatmapData | null;
  loading?: boolean;
}

export const Heatmap3D: React.FC<Heatmap3DProps> = ({ data, loading = false }) => {
  const [colorScale, setColorScale] = useState<string>('Plasma');
  const [showWireframe, setShowWireframe] = useState<boolean>(false);

  if (loading) {
    return (
      <div className="card" style={{ minHeight: '520px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }} />
          <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
            Rendering 3D Signal Mesh...
          </div>
        </div>
      </div>
    );
  }

  const hasGrid = data && data.grid_rssi && data.grid_rssi.length > 0 && data.has_sufficient_data;
  const locations = data?.locations || [];

  const xCoords = data?.grid_x?.[0] || [];
  const yCoords = data?.grid_y?.map((row) => row[0]) || [];

  const plotData: any[] = [];

  if (hasGrid) {
    plotData.push({
      type: 'surface',
      x: xCoords,
      y: yCoords,
      z: data.grid_rssi,
      colorscale: colorScale,
      contours: {
        z: {
          show: true,
          usecolormap: true,
          highlightcolor: '#06b6d4',
          project: { z: false },
        },
      },
      lighting: {
        ambient: 0.7,
        diffuse: 0.8,
        specular: 0.2,
      },
      showscale: true,
      colorbar: {
        title: { text: 'RSSI (dBm)', side: 'right', font: { color: '#94a3b8', size: 11 } },
        tickfont: { color: '#94a3b8', size: 10 },
        len: 0.8,
        thickness: 16,
      },
      hidesurface: showWireframe,
      hoverinfo: 'x+y+z',
      hovertemplate: '<b>X:</b> %{x:.2f} m<br><b>Y:</b> %{y:.2f} m<br><b>RSSI:</b> %{z:.1f} dBm<extra></extra>',
    });
  }

  // 3D scatter survey points
  if (locations.length > 0) {
    plotData.push({
      type: 'scatter3d',
      mode: 'markers',
      x: locations.map((loc) => loc.x_m),
      y: locations.map((loc) => loc.y_m),
      z: locations.map((loc) => loc.mean_rssi ?? -90),
      marker: {
        size: 5,
        color: '#ffffff',
        line: { color: '#06b6d4', width: 2 },
      },
      name: 'Sample Points',
      hoverinfo: 'text',
      hovertext: locations.map(
        (loc) =>
          `Point (${loc.x_m}m, ${loc.y_m}m)<br>Mean: ${
            loc.mean_rssi !== null ? `${loc.mean_rssi.toFixed(1)} dBm` : 'N/A'
          }`
      ),
    });
  }

  const layout: any = {
    paper_bgcolor: 'transparent',
    autosize: true,
    height: 520,
    margin: { l: 0, r: 0, t: 20, b: 20 },
    scene: {
      xaxis: {
        title: { text: 'X (m)', font: { color: '#94a3b8', size: 11 } },
        gridcolor: 'rgba(255, 255, 255, 0.08)',
        backgroundcolor: 'rgba(10, 14, 23, 0.8)',
        showbackground: true,
        tickfont: { color: '#94a3b8', size: 10 },
      },
      yaxis: {
        title: { text: 'Y (m)', font: { color: '#94a3b8', size: 11 } },
        gridcolor: 'rgba(255, 255, 255, 0.08)',
        backgroundcolor: 'rgba(10, 14, 23, 0.8)',
        showbackground: true,
        tickfont: { color: '#94a3b8', size: 10 },
      },
      zaxis: {
        title: { text: 'RSSI (dBm)', font: { color: '#94a3b8', size: 11 } },
        gridcolor: 'rgba(255, 255, 255, 0.08)',
        backgroundcolor: 'rgba(10, 14, 23, 0.8)',
        showbackground: true,
        tickfont: { color: '#94a3b8', size: 10 },
      },
      camera: {
        eye: { x: 1.5, y: -1.5, z: 1.2 },
      },
    },
    legend: {
      font: { color: '#94a3b8', size: 11 },
      x: 0,
      y: 0.95,
    },
  };

  return (
    <div className="card">
      <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Box size={18} className="text-violet" />
            3D Wi-Fi Signal Surface Elevation
          </h3>
          <p className="card-subtitle">
            Perspective representation of wireless signal decay and gradient distribution
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Palette size={14} className="text-tertiary" />
            <select
              className="form-select"
              style={{ width: 'auto', padding: '4px 8px', fontSize: 'var(--text-xs)' }}
              value={colorScale}
              onChange={(e) => setColorScale(e.target.value)}
            >
              <option value="Plasma">Plasma (Vibrant)</option>
              <option value="Viridis">Viridis</option>
              <option value="Turbo">Turbo</option>
              <option value="Jet">Jet</option>
              <option value="Hot">Thermal Hot</option>
            </select>
          </div>

          <button
            className={`btn btn-sm ${showWireframe ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setShowWireframe(!showWireframe)}
          >
            <Eye size={12} /> {showWireframe ? 'Contour Isolines' : 'Surface Solid'}
          </button>
        </div>
      </div>

      {!hasGrid ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Box size={32} />
          </div>
          <h3>Insufficient Mesh Data</h3>
          <p>
            3D continuous surface reconstruction requires at least 3 non-collinear survey coordinates.
          </p>
        </div>
      ) : (
        <div style={{ width: '100%', minHeight: '520px' }}>
          <Plot
            data={plotData}
            layout={layout}
            config={{ responsive: true, displaylogo: false }}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      )}
    </div>
  );
};
