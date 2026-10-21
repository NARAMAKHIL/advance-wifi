import React, { useState } from 'react';
import Plot from 'react-plotly.js';
import type { HeatmapData } from '../types';

interface Heatmap2DProps {
  data: HeatmapData | null;
  loading?: boolean;
  onMethodChange?: (method: string) => void;
  onPointClick?: (x: number, y: number) => void;
  method?: string;
  viewMode?: '2d' | '3d';
  onViewModeChange?: (mode: '2d' | '3d') => void;
}

export const Heatmap2D: React.FC<Heatmap2DProps> = ({
  data,
  loading = false,
  onMethodChange,
  onPointClick,
  method = 'linear',
  viewMode = '2d',
  onViewModeChange,
}) => {
  const [colorScale, setColorScale] = useState<string>('Viridis');
  const [showContours, setShowContours] = useState<boolean>(true);

  // Only show full loader if there is no data at all
  if (loading && !data) {
    return (
      <div className="clean-card" style={{ height: '480px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading spatial model...</span>
      </div>
    );
  }

  const hasGrid = data && data.grid_rssi && data.grid_rssi.length > 0 && data.has_sufficient_data;
  const locations = data?.locations || [];

  const xCoords = data?.grid_x?.[0] || [];
  const yCoords = data?.grid_y?.map((row) => row[0]) || [];

  const plotData: any[] = [];

  if (viewMode === '2d') {
    if (hasGrid) {
      if (showContours) {
        plotData.push({
          type: 'contour',
          x: xCoords,
          y: yCoords,
          z: data.grid_rssi,
          colorscale: colorScale,
          connectgaps: true,
          contours: {
            coloring: 'heatmap',
            showlabels: false,
          },
          colorbar: {
            title: { text: 'dBm', side: 'right', font: { color: '#94a3b8', size: 10 } },
            tickfont: { color: '#94a3b8', size: 10 },
            len: 0.9,
            thickness: 12,
            outlinewidth: 0,
          },
          hovertemplate: 'X: %{x:.1f}m, Y: %{y:.1f}m<br><b>%{z:.1f} dBm</b><extra></extra>',
        });
      } else {
        plotData.push({
          type: 'heatmap',
          x: xCoords,
          y: yCoords,
          z: data.grid_rssi,
          colorscale: colorScale,
          connectgaps: true,
          colorbar: {
            title: { text: 'dBm', side: 'right', font: { color: '#94a3b8', size: 10 } },
            tickfont: { color: '#94a3b8', size: 10 },
            len: 0.9,
            thickness: 12,
            outlinewidth: 0,
          },
          hovertemplate: 'X: %{x:.1f}m, Y: %{y:.1f}m<br><b>%{z:.1f} dBm</b><extra></extra>',
        });
      }
    }

    // Survey points: Clean markers WITHOUT clunky overlapping text labels!
    if (locations.length > 0) {
      plotData.push({
        type: 'scatter',
        mode: 'markers',
        x: locations.map((loc) => loc.x_m),
        y: locations.map((loc) => loc.y_m),
        marker: {
          size: 7,
          color: '#ffffff',
          line: { color: '#0284c7', width: 2 },
        },
        hoverinfo: 'text',
        hovertext: locations.map(
          (loc) =>
            `<b>Point (${loc.x_m}m, ${loc.y_m}m)</b><br>RSSI: ${
              loc.mean_rssi !== null ? `${loc.mean_rssi.toFixed(1)} dBm` : 'N/A'
            }<br>Std: ±${loc.std_rssi !== null ? `${loc.std_rssi.toFixed(1)} dB` : 'N/A'}<br>Samples: ${
              loc.sample_count
            }`
        ),
        name: 'Survey Nodes',
      });
    }

    // Peak AP Marker
    if (locations.length > 0) {
      const highest = [...locations].sort((a, b) => (b.mean_rssi ?? -120) - (a.mean_rssi ?? -120))[0];
      if (highest) {
        plotData.push({
          type: 'scatter',
          mode: 'markers',
          x: [highest.x_m],
          y: [highest.y_m],
          marker: {
            size: 13,
            symbol: 'diamond',
            color: '#fbbf24',
            line: { color: '#ffffff', width: 2 },
          },
          name: 'Peak AP',
          hoverinfo: 'text',
          hovertext: `<b>Access Point (Peak)</b><br>Pos: (${highest.x_m}m, ${highest.y_m}m)<br>RSSI: ${highest.mean_rssi?.toFixed(1)} dBm`,
        });
      }
    }
  } else {
    // 3D Surface View
    if (hasGrid) {
      plotData.push({
        type: 'surface',
        x: xCoords,
        y: yCoords,
        z: data.grid_rssi,
        colorscale: colorScale,
        lighting: { ambient: 0.8, diffuse: 0.8, specular: 0.1 },
        colorbar: {
          title: { text: 'dBm', side: 'right', font: { color: '#94a3b8', size: 10 } },
          tickfont: { color: '#94a3b8', size: 10 },
          len: 0.9,
          thickness: 12,
        },
        hovertemplate: 'X: %{x:.1f}m, Y: %{y:.1f}m<br><b>%{z:.1f} dBm</b><extra></extra>',
      });
    }

    if (locations.length > 0) {
      plotData.push({
        type: 'scatter3d',
        mode: 'markers',
        x: locations.map((l) => l.x_m),
        y: locations.map((l) => l.y_m),
        z: locations.map((l) => l.mean_rssi ?? -90),
        marker: { size: 4, color: '#38bdf8', line: { color: '#fff', width: 1 } },
        name: 'Nodes',
        hoverinfo: 'text',
        hovertext: locations.map((l) => `(${l.x_m}m, ${l.y_m}m): ${l.mean_rssi?.toFixed(1)} dBm`),
      });
    }
  }

  const layout: any = {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'rgba(13, 18, 31, 0.6)',
    autosize: true,
    height: 480,
    margin: { l: 45, r: 20, t: 15, b: 45 },
    xaxis: {
      title: { text: 'Room Width X (m)', font: { color: '#64748b', size: 11 } },
      range: [0, data?.room_width_m || 10],
      gridcolor: 'rgba(255, 255, 255, 0.04)',
      zerolinecolor: 'rgba(255, 255, 255, 0.08)',
      tickfont: { color: '#64748b', size: 10 },
    },
    yaxis: {
      title: { text: 'Room Length Y (m)', font: { color: '#64748b', size: 11 } },
      range: [0, data?.room_length_m || 10],
      gridcolor: 'rgba(255, 255, 255, 0.04)',
      zerolinecolor: 'rgba(255, 255, 255, 0.08)',
      tickfont: { color: '#64748b', size: 10 },
      scaleanchor: 'x',
      scaleratio: 1,
    },
    scene: {
      xaxis: { title: 'X (m)', tickfont: { color: '#64748b', size: 9 }, gridcolor: 'rgba(255,255,255,0.06)' },
      yaxis: { title: 'Y (m)', tickfont: { color: '#64748b', size: 9 }, gridcolor: 'rgba(255,255,255,0.06)' },
      zaxis: { title: 'RSSI (dBm)', tickfont: { color: '#64748b', size: 9 }, gridcolor: 'rgba(255,255,255,0.06)' },
      camera: { eye: { x: 1.4, y: -1.4, z: 1.1 } },
    },
    showlegend: viewMode === '2d',
    legend: { x: 0, y: 1.08, orientation: 'h', font: { color: '#94a3b8', size: 10 } },
  };

  return (
    <div className="clean-card">
      <div className="clean-card-header">
        <div>
          <h3 className="clean-card-title">
            Wi-Fi Signal Spatial Field
          </h3>
          <p className="clean-card-subtitle">
            {locations.length} surveyed points &bull; {hasGrid ? 'continuous interpolated coverage' : 'collecting points'}
          </p>
        </div>

        {/* Clean minimal controls toolbar */}
        <div className="toolbar">
          {onViewModeChange && (
            <div className="btn-group">
              <button
                className={`btn-group-item ${viewMode === '2d' ? 'active' : ''}`}
                onClick={() => onViewModeChange('2d')}
              >
                2D Contour
              </button>
              <button
                className={`btn-group-item ${viewMode === '3d' ? 'active' : ''}`}
                onClick={() => onViewModeChange('3d')}
              >
                3D Mesh
              </button>
            </div>
          )}

          {viewMode === '2d' && (
            <>
              <select
                className="select-clean"
                value={method}
                onChange={(e) => onMethodChange && onMethodChange(e.target.value)}
              >
                <option value="linear">Delaunay Linear</option>
                <option value="nearest">Nearest-Neighbor</option>
              </select>

              <button
                className={`btn-clean ${showContours ? 'btn-clean-primary' : ''}`}
                onClick={() => setShowContours(!showContours)}
                style={{ padding: '4px 9px', fontSize: '11px' }}
              >
                {showContours ? 'Contours' : 'Raw Grid'}
              </button>
            </>
          )}

          <select
            className="select-clean"
            value={colorScale}
            onChange={(e) => setColorScale(e.target.value)}
          >
            <option value="Viridis">Viridis</option>
            <option value="Plasma">Plasma</option>
            <option value="Turbo">Turbo</option>
            <option value="Cividis">Cividis</option>
          </select>
        </div>
      </div>

      <div style={{ width: '100%', height: '480px' }}>
        <Plot
          data={plotData}
          layout={layout}
          config={{ responsive: true, displaylogo: false, modeBarButtonsToRemove: ['lasso2d', 'select2d'] }}
          style={{ width: '100%', height: '100%' }}
          onClick={(evt) => {
            if (onPointClick && evt.points && evt.points.length > 0) {
              const pt = evt.points[0];
              if (pt.x !== undefined && pt.y !== undefined) {
                onPointClick(Number(pt.x), Number(pt.y));
              }
            }
          }}
        />
      </div>
    </div>
  );
};
