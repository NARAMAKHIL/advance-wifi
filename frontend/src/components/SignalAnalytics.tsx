import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';
import type { LocationSummary, ValidationResult } from '../types';

interface SignalAnalyticsProps {
  locations: LocationSummary[];
  validationData?: ValidationResult | null;
}

export const SignalAnalytics: React.FC<SignalAnalyticsProps> = ({
  locations,
  validationData,
}) => {
  // Compute Path Loss fit
  const { fittedN, p0, distancePoints, modelDistances, modelRssi, freeSpaceRssi } = useMemo(() => {
    const strongestLoc = locations.length > 0
      ? [...locations].sort((a, b) => (b.mean_rssi ?? -120) - (a.mean_rssi ?? -120))[0]
      : null;

    const apX = strongestLoc ? strongestLoc.x_m : 0.0;
    const apY = strongestLoc ? strongestLoc.y_m : 0.0;

    const distPts = locations
      .filter((loc) => loc.mean_rssi !== null)
      .map((loc) => ({
        dist: Math.max(0.5, Math.hypot(loc.x_m - apX, loc.y_m - apY)),
        rssi: loc.mean_rssi as number,
        std: loc.std_rssi || 1.0,
        label: `(${loc.x_m}m, ${loc.y_m}m)`,
      }))
      .sort((a, b) => a.dist - b.dist);

    let n = 2.5;
    let pZero = -40;

    if (distPts.length >= 2) {
      const logD = distPts.map((p) => Math.log10(p.dist));
      const meanLogD = logD.reduce((a, b) => a + b, 0) / logD.length;
      const meanRssi = distPts.map((p) => p.rssi).reduce((a, b) => a + b, 0) / distPts.length;

      let num = 0;
      let den = 0;
      for (let i = 0; i < distPts.length; i++) {
        num += (logD[i] - meanLogD) * (distPts[i].rssi - meanRssi);
        den += (logD[i] - meanLogD) ** 2;
      }

      if (den > 1e-5) {
        const slope = num / den;
        n = Math.max(1.2, Math.min(5.0, -slope / 10));
        pZero = meanRssi - slope * meanLogD;
      }
    }

    const maxD = Math.max(10, ...(distPts.length > 0 ? distPts.map((p) => p.dist * 1.2) : [10]));
    const mDist = Array.from({ length: 40 }, (_, i) => 0.5 + (i * (maxD - 0.5)) / 39);
    const mRssi = mDist.map((d) => pZero - 10 * n * Math.log10(d));
    const fsRssi = mDist.map((d) => pZero - 10 * 2.0 * Math.log10(d));

    return {
      fittedN: n,
      p0: pZero,
      distancePoints: distPts,
      modelDistances: mDist,
      modelRssi: mRssi,
      freeSpaceRssi: fsRssi,
    };
  }, [locations]);

  // Validation metrics
  const valMetrics = validationData as any;
  const hasValidation = valMetrics && valMetrics.mae_db !== undefined && valMetrics.per_point;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top Parameter Strip */}
      <div
        className="clean-card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          padding: '14px 20px',
        }}
      >
        <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Path Loss Exponent (n)
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent-cyan)' }}>
              n = {fittedN.toFixed(2)}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Reference Power (P₀ @ 1m)
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent-teal)' }}>
              {p0.toFixed(1)} dBm
            </div>
          </div>

          {hasValidation && (
            <>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  LOOCV Mean Error (MAE)
                </div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                  {valMetrics.mae_db} dB
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  LOOCV Root Mean Square (RMSE)
                </div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent-indigo)' }}>
                  {valMetrics.rmse_db} dB
                </div>
              </div>
            </>
          )}
        </div>

        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {fittedN < 2.2 ? 'Line-of-Sight Channel' : 'Obstructed Multipath Channel'}
        </div>
      </div>

      {/* Two Plots Side-by-Side */}
      <div className="two-col">
        {/* Plot 1: Path Loss Fit */}
        <div className="clean-card">
          <div className="clean-card-header">
            <div>
              <h3 className="clean-card-title">Empirical Path Loss Curve</h3>
              <p className="clean-card-subtitle">Log-distance attenuation vs distance</p>
            </div>
          </div>

          <div style={{ width: '100%', height: '340px' }}>
            <Plot
              data={[
                {
                  type: 'scatter',
                  mode: 'markers',
                  x: distancePoints.map((p) => p.dist),
                  y: distancePoints.map((p) => p.rssi),
                  error_y: {
                    type: 'data',
                    array: distancePoints.map((p) => p.std),
                    visible: true,
                    color: 'rgba(56, 189, 248, 0.3)',
                  },
                  marker: { size: 6, color: '#38bdf8' },
                  name: 'Measured Nodes',
                },
                {
                  type: 'scatter',
                  mode: 'lines',
                  x: modelDistances,
                  y: modelRssi,
                  name: `Fit (n=${fittedN.toFixed(2)})`,
                  line: { color: '#34d399', width: 2 },
                },
                {
                  type: 'scatter',
                  mode: 'lines',
                  x: modelDistances,
                  y: freeSpaceRssi,
                  name: 'Free Space (n=2.0)',
                  line: { color: '#64748b', width: 1.5, dash: 'dot' },
                },
              ]}
              layout={{
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'rgba(13, 18, 31, 0.6)',
                autosize: true,
                height: 340,
                margin: { l: 45, r: 15, t: 10, b: 40 },
                xaxis: {
                  title: { text: 'Distance d (m)', font: { color: '#64748b', size: 10 } },
                  gridcolor: 'rgba(255, 255, 255, 0.04)',
                  tickfont: { color: '#64748b', size: 9 },
                },
                yaxis: {
                  title: { text: 'RSSI (dBm)', font: { color: '#64748b', size: 10 } },
                  gridcolor: 'rgba(255, 255, 255, 0.04)',
                  tickfont: { color: '#64748b', size: 9 },
                },
                legend: { orientation: 'h', y: 1.1, font: { color: '#94a3b8', size: 10 } },
              }}
              config={{ responsive: true, displaylogo: false }}
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        </div>

        {/* Plot 2: Parity Plot (Actual vs Predicted) */}
        <div className="clean-card">
          <div className="clean-card-header">
            <div>
              <h3 className="clean-card-title">Cross-Validation Parity Plot</h3>
              <p className="clean-card-subtitle">Leave-One-Out (LOOCV) prediction accuracy</p>
            </div>
          </div>

          <div style={{ width: '100%', height: '340px' }}>
            {hasValidation ? (
              <Plot
                data={[
                  {
                    type: 'scatter',
                    mode: 'markers',
                    x: valMetrics.per_point.map((p: any) => p.actual),
                    y: valMetrics.per_point.map((p: any) => p.predicted),
                    marker: { size: 6, color: '#818cf8' },
                    name: 'Hold-Out Points',
                    hovertemplate: 'Actual: %{x:.1f} dBm<br>Predicted: %{y:.1f} dBm<extra></extra>',
                  },
                  {
                    type: 'scatter',
                    mode: 'lines',
                    x: [-65, -20],
                    y: [-65, -20],
                    line: { color: '#64748b', dash: 'dash', width: 1.5 },
                    name: '1:1 Ideal Identity',
                  },
                ]}
                layout={{
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'rgba(13, 18, 31, 0.6)',
                  autosize: true,
                  height: 340,
                  margin: { l: 45, r: 15, t: 10, b: 40 },
                  xaxis: {
                    title: { text: 'Ground Truth RSSI (dBm)', font: { color: '#64748b', size: 10 } },
                    gridcolor: 'rgba(255, 255, 255, 0.04)',
                    tickfont: { color: '#64748b', size: 9 },
                  },
                  yaxis: {
                    title: { text: 'Predicted RSSI (dBm)', font: { color: '#64748b', size: 10 } },
                    gridcolor: 'rgba(255, 255, 255, 0.04)',
                    tickfont: { color: '#64748b', size: 9 },
                  },
                  legend: { orientation: 'h', y: 1.1, font: { color: '#94a3b8', size: 10 } },
                }}
                config={{ responsive: true, displaylogo: false }}
                style={{ width: '100%', height: '100%' }}
              />
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                Collect at least 4 non-collinear points for LOOCV parity plot.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Residual Table */}
      {hasValidation && (
        <div className="clean-card" style={{ maxHeight: '240px', overflowY: 'auto' }}>
          <div className="clean-card-header">
            <h3 className="clean-card-title">Leave-One-Out Residual Errors</h3>
          </div>
          <table className="clean-table">
            <thead>
              <tr>
                <th>Coordinate</th>
                <th>Measured</th>
                <th>Predicted</th>
                <th>Residual Error</th>
              </tr>
            </thead>
            <tbody>
              {valMetrics.per_point.slice(0, 15).map((p: any, i: number) => (
                <tr key={i}>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>({p.x_m.toFixed(1)}m, {p.y_m.toFixed(1)}m)</td>
                  <td>{p.actual} dBm</td>
                  <td>{p.predicted} dBm</td>
                  <td style={{ color: p.abs_error < 2 ? '#34d399' : p.abs_error < 4 ? '#fbbf24' : '#f87171' }}>
                    {p.error > 0 ? `+${p.error}` : p.error} dB
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
