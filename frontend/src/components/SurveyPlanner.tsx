import React from 'react';
import Plot from 'react-plotly.js';
import type { LocationSummary, SurveyRecommendation } from '../types';

interface SurveyPlannerProps {
  recommendations: SurveyRecommendation[];
  locations: LocationSummary[];
  roomWidth: number;
  roomLength: number;
  onSelectPoint: (x: number, y: number) => void;
}

export const SurveyPlanner: React.FC<SurveyPlannerProps> = ({
  recommendations,
  locations,
  roomWidth,
  roomLength,
  onSelectPoint,
}) => {
  return (
    <div className="clean-card">
      <div className="clean-card-header">
        <div>
          <h3 className="clean-card-title">Active Spatial Survey Planner</h3>
          <p className="clean-card-subtitle">
            Information-gain targeting regions with highest interpolation uncertainty
          </p>
        </div>
      </div>

      <div className="two-col" style={{ alignItems: 'start' }}>
        {/* Recommended Locations Table */}
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>
            Recommended Sampling Coordinates
          </div>

          {recommendations.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
              Mesh coverage is uniform across current bounds.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recommendations.map((rec, index) => (
                <div
                  key={index}
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span
                      style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        background: 'rgba(56, 189, 248, 0.1)',
                        color: 'var(--accent-cyan)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '11px',
                      }}
                    >
                      {index + 1}
                    </span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                        Point ({rec.x_m.toFixed(1)}m, {rec.y_m.toFixed(1)}m)
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {rec.reason || 'High variance / sparse mesh gap'}
                      </div>
                    </div>
                  </div>

                  <button
                    className="btn-clean btn-clean-primary"
                    style={{ padding: '4px 10px', fontSize: '11px' }}
                    onClick={() => onSelectPoint(rec.x_m, rec.y_m)}
                  >
                    Select Point
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Spatial Layout with existing points + suggested targets */}
        <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', padding: '14px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
            Survey Mesh Distribution
          </div>
          <div style={{ width: '100%', height: '320px' }}>
            <Plot
              data={[
                // Existing points
                {
                  type: 'scatter',
                  mode: 'markers',
                  x: locations.map((l) => l.x_m),
                  y: locations.map((l) => l.y_m),
                  name: 'Sampled Points',
                  marker: { size: 6, color: '#38bdf8' },
                  hoverinfo: 'text',
                  hovertext: locations.map((l) => `(${l.x_m}m, ${l.y_m}m)`),
                },
                // Recommended points
                {
                  type: 'scatter',
                  mode: 'markers',
                  x: recommendations.map((r) => r.x_m),
                  y: recommendations.map((r) => r.y_m),
                  name: 'Target Candidates',
                  marker: {
                    size: 11,
                    symbol: 'circle-open',
                    color: '#fbbf24',
                    line: { width: 2, color: '#fbbf24' },
                  },
                  hoverinfo: 'text',
                  hovertext: recommendations.map((r, i) => `#${i + 1}: (${r.x_m}m, ${r.y_m}m)`),
                },
              ]}
              layout={{
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'rgba(9, 13, 22, 0.6)',
                autosize: true,
                height: 320,
                margin: { l: 40, r: 15, t: 10, b: 35 },
                xaxis: {
                  title: { text: 'X (m)', font: { color: '#64748b', size: 10 } },
                  range: [0, roomWidth],
                  gridcolor: 'rgba(255, 255, 255, 0.04)',
                  tickfont: { color: '#64748b', size: 9 },
                },
                yaxis: {
                  title: { text: 'Y (m)', font: { color: '#64748b', size: 10 } },
                  range: [0, roomLength],
                  gridcolor: 'rgba(255, 255, 255, 0.04)',
                  tickfont: { color: '#64748b', size: 9 },
                  scaleanchor: 'x',
                  scaleratio: 1,
                },
                legend: { x: 0, y: 1.1, orientation: 'h', font: { color: '#94a3b8', size: 10 } },
              }}
              config={{ responsive: true, displaylogo: false }}
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
