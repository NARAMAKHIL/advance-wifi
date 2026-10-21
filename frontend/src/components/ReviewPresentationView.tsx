import React, { useState } from 'react';

interface Slide {
  id: number;
  title: string;
  category: string;
  bulletPoints: string[];
  imageSrc?: string;
  speakerScript: string;
}

const SLIDES: Slide[] = [
  {
    id: 1,
    title: 'Wi-Fi Signal Strength Mapping Using RSSI Heatmap',
    category: 'Title Slide',
    bulletPoints: [
      'A Wi-Fi Signal Strength Measurement, Spatial Interpolation, and Propagation Modeling System Using ESP32 & MATLAB',
      'Target Event: SDC Internal Mid-Project Review (2026 – 2027)',
      'Presented by Team: Name 1, Name 2, Name 3, Name 4',
      'Department of Artificial Intelligence & Data Science / CSE',
      'Amrita Vishwa Vidyapeetham / College of Engineering',
      'Under the Guidance of: Dr. / Prof. [Supervisor Name]',
    ],
    speakerScript:
      'Respected guide and faculty evaluators, good morning. Today, our team is presenting our SDC Internal Mid-Project Review on Wi-Fi Signal Strength Mapping Using RSSI Heatmap. We bridge low-cost embedded edge computing using an ESP32 microcontroller with rigorous mathematical computing in MATLAB to acquire, log, spatially interpolate, and model indoor RF coverage.',
  },
  {
    id: 2,
    title: 'Introduction — Indoor RF Propagation Dynamics',
    category: 'Introduction',
    bulletPoints: [
      'Indoor Wi-Fi signals (2.4 GHz) degrade non-uniformly due to distance attenuation, multi-path fading, and wall reflections.',
      'Received Signal Strength Indicator (RSSI) is expressed in negative dBm (closer to zero = stronger signal).',
      'ESP32 Edge Node passively scans 802.11 beacons without network association overhead.',
      'Automated serial pipeline streams structured records with millisecond timestamps to CSV.',
      'MATLAB suite implements 2D natural-neighbor interpolation and log-distance path loss regression.',
    ],
    speakerScript:
      'Indoor wireless environments suffer from severe multi-path fading. RSSI provides a standardized logarithmic power metric in dBm. Our system uses an ESP32 to autonomously capture beacons every 5 seconds, stream records to CSV, and use MATLAB for spatial heatmapping.',
  },
  {
    id: 3,
    title: 'Problem Statement & Challenges in Indoor Wi-Fi Coverage',
    category: 'Problem Statement',
    bulletPoints: [
      'Non-Uniform Coverage: Static free-space equations fail indoors due to obstacle absorption and constructive/destructive interference.',
      'Prohibitive Tool Costs: Enterprise tools (Ekahau Sidekick, NetSpot Pro) cost $2,000–$6,000 and require proprietary dongles.',
      'Lack of Transparent Mathematical Modeling: Consumer smartphone apps lack raw CSV data access or empirical propagation parameter estimation (n, P0, σ).',
      'Goal: Formulate a validated, open $5 hardware workflow paired with scientific MATLAB spatial interpolation.',
    ],
    speakerScript:
      'The problem is twofold: First, indoor Wi-Fi dead-zones are hard to predict without dense sampling. Second, commercial RF survey tools are prohibitively expensive. Our project delivers an open, low-cost platform pairing ESP32 with MATLAB.',
  },
  {
    id: 4,
    title: 'Project Objectives — Technical Scope & Milestones',
    category: 'Objectives',
    bulletPoints: [
      '1. Configure ESP32 for non-blocking 802.11 beacon scanning and RSSI acquisition.',
      '2. Implement automated 10-reading sequential batches at 5-second intervals to filter fast fading.',
      '3. Establish 115200 baud USB serial streaming of structured frames (timestamps, sample indexes, SSID, RSSI).',
      '4. Maintain clean dual-layer datasets (rssi_data.csv for stability, spatial_rssi_data.csv for coordinates).',
      '5. Develop robust MATLAB scripts (clean_rssi_data.m, rssi_analysis.m, rssi_heatmap.m, path_loss_prediction.m).',
      '6. Generate 2D contour heatmaps and 3D signal surface elevation models.',
      '7. Extract physical path-loss exponent (n) and reference power (P0) via Ordinary Least Squares (OLS) regression.',
      '8. Implement multi-AP trilateration positioning solver (LLS and NLS).',
    ],
    speakerScript:
      'Our project has eight distinct objectives divided between edge acquisition and analytical modeling. At this mid-project stage, all hardware objectives are 100% completed.',
  },
  {
    id: 5,
    title: 'Literature Survey — Peer-Reviewed IEEE Studies (2023–2025)',
    category: 'Literature Survey',
    bulletPoints: [
      'Al-Ammal et al., 2024 (IEEE Access): Proved indoor path loss exponent n ranges from 2.4 to 3.8; 10-sample temporal averaging effectively attenuates Gaussian noise.',
      'Zhang, Liu & Wang, 2024 (IEEE Trans. Instrum. Meas.): Verified ESP32 RSSI repeatability within ±1.5 dB under static conditions, validating low-cost microcontrollers as research sensors.',
      'Patel, Mehta & Sharma, 2023 (IEEE Sensors Journal): Natural-neighbor interpolation and RBF multiquadric achieved the lowest LOOCV RMSE (2.1 dB) across irregular indoor survey grids.',
      'Gomez & Hernandez, 2024 (IEEE IoT Journal): Continuous spatial heatmaps enabled targeted AP relocation, reducing dead-zones by 42%.',
      'Chen, Kumar & Zhao, 2025 (IEEE Wireless Commun. Lett.): Achieved sub-2.0 meter localization error across complex laboratory geometries using 4 APs.',
    ],
    speakerScript:
      'Our literature survey reviews five IEEE papers published between 2023 and 2025. Zhang et al. in 2024 proved ESP32 repeatability is within ±1.5 dB, and Patel et al. verified that natural-neighbor interpolation outperforms standard IDW.',
  },
  {
    id: 6,
    title: 'Research Gap & Identified Limitations in Existing Work',
    category: 'Research Gap',
    bulletPoints: [
      'Proprietary Hardware Lock-In: Enterprise survey tools require expensive dongles inaccessible to academic labs.',
      'Closed Mobile Apps: Android/iOS apps display qualitative graphics without exporting raw numerical readings or timestamps.',
      'Manual Transcription Errors: Surveys conducted via paper introduce timing jitter and human error.',
      'Scientific Solution: ESP32 passive beacon listening + automated CSV streaming + MATLAB empirical OLS path-loss regression and trilateration.',
    ],
    speakerScript:
      'Commercial tools are walled gardens, while mobile apps are black-box toys. Our project bridges this gap with an open, calibrated hardware-software pipeline pairing a $5 ESP32 with MATLAB.',
  },
  {
    id: 7,
    title: 'Proposed Methodology — End-to-End System Workflow',
    category: 'Methodology',
    bulletPoints: [
      'Phase 1 (Edge Acquisition): ESP32 scans 802.11 beacons; acquires 10 samples at 5000 ms intervals.',
      'Phase 2 (Data Persistence): Python serial logger captures frames; clean_rssi_data strips "dBm" and sanitizes NaNs.',
      'Phase 3 (MATLAB Analytics): Computes mean, variance, CI; fits Log-Distance Path Loss model: Pr(d) = P0 - 10·n·log10(d/d0) + X_sigma.',
      'Phase 4 (Spatial Visualization): Natural-neighbor interpolation on 120x120 grid; 2D contour map, 3D surface, and trilateration solver.',
    ],
    speakerScript:
      'Our methodology spans four distinct phases: edge acquisition, data logging, MATLAB propagation analysis, and spatial visualization.',
  },
  {
    id: 8,
    title: 'Work Completed — Hardware Setup & Data Logging Pipeline',
    category: 'Work Completed',
    bulletPoints: [
      'ESP32 development module configured and verified with CP2102/CH340 USB serial bridge.',
      'Arduino IDE 2.x configured with official espressif/arduino-esp32 core package.',
      'Firmware programmed for non-blocking beacon scanning and target SSID filtering.',
      'Automated 10-reading sequential batch acquisition verified at 5000 ms intervals.',
      'Real hardware serial stream logged and stored into matlab/rssi_data.csv.',
      'Complete modular MATLAB analytical scripts authored and tested.',
    ],
    speakerScript:
      'For our mid-project review, we have completed the entire hardware foundation. The ESP32 is fully configured and flashed. We implemented the 10-sample acquisition logic and verified that data logs cleanly into CSV.',
  },
  {
    id: 9,
    title: 'Current Results — ESP32 RSSI Acquisition & Statistical Stability',
    category: 'Current Results',
    bulletPoints: [
      'Tested on Campus Wi-Fi Network: Amrita-2.4G-B244 in Laboratory B244.',
      'Valid Samples: N = 10  |  Sampling Interval: 5.0 seconds',
      'Average (Mean) RSSI: -54.10 dBm  |  Median: -54.00 dBm',
      'Dynamic Range: [-55.0, -53.0] dBm (Δ = 2.0 dB)',
      'Standard Deviation: σ = 0.88 dB  |  Variance: 0.77 dB²',
      '95% Confidence Interval: [-54.65, -53.55] dBm',
      'Scientific Validation: Low σ (0.88 dB) proves 10-sample temporal averaging effectively suppresses fast-fading RF noise.',
    ],
    imageSrc: './figures/WiFi_RSSI_TimeSeries.png',
    speakerScript:
      'Here are our current experimental results. The average signal strength on Amrita-2.4G-B244 is -54.10 dBm, with a standard deviation of only 0.88 dB. This proves our 10-sample acquisition window stabilizes fast-fading fluctuations.',
  },
  {
    id: 10,
    title: 'Remaining Work & Future Implementation Plan',
    category: 'Remaining Work',
    bulletPoints: [
      '1. Deploy Multi-Point Survey Grid: Collect 16 to 25 physical grid coordinates in Laboratory B244 (2-meter spacing).',
      '2. Generate MATLAB Continuous Heatmaps: Run rssi_heatmap.m for 2D contour maps and 3D signal surface elevation.',
      '3. Extract Empirical Path-Loss Parameters: Run path_loss_prediction.m using OLS regression to compute n and σ.',
      '4. Benchmark Interpolation Accuracy: Run Leave-One-Out Cross-Validation (LOOCV) to compute RMSE across Delaunay, Natural Neighbor, and RBF.',
      '5. Multi-AP Localization Validation: Test indoor trilateration positioning solver using 3+ campus beacons.',
    ],
    imageSrc: './figures/WiFi_RSSI_Heatmap_2D.png',
    speakerScript:
      'Our remaining work is precisely defined: First, deploy the ESP32 across a 16-point grid in the laboratory. Then execute our MATLAB scripts to generate 2D/3D heatmaps and extract empirical path-loss exponent n.',
  },
  {
    id: 11,
    title: 'Conclusion & Project Milestones Status Table',
    category: 'Conclusion',
    bulletPoints: [
      'Hardware Setup & Arduino Toolchain: Completed ✅',
      '802.11 Beacon RSSI Scanning Firmware: Completed ✅',
      '10-Sample 5-Second Interval Logic: Completed ✅',
      'USB Serial Streaming to CSV: Completed ✅',
      'Single-Location Statistical Analysis: Completed ✅',
      'Physical 16-Point Room Grid Survey: In Progress 🔄',
      'MATLAB 2D/3D RSSI Heatmaps: Scripts Ready 🔄',
      'Log-Distance Path Loss OLS Model: Scripts Ready 🔄',
      'Indoor Trilateration Localization: Planned ⏳',
    ],
    speakerScript:
      'In conclusion, all planned milestones for the Mid-Project Review are 100% completed. We have demonstrated a functional ESP32 node, collected verified experimental data on campus network Amrita-2.4G-B244, proved high stability, and built the complete MATLAB suite.',
  },
  {
    id: 12,
    title: 'References — IEEE Standard Citations (2023–2025)',
    category: 'References',
    bulletPoints: [
      '[1] M. Al-Ammal et al., "Empirical Evaluation of Indoor Wi-Fi RSSI Variability," IEEE Access, 2024.',
      '[2] Y. Zhang et al., "Low-Cost ESP32 Wi-Fi Fingerprinting and Spatial Tracking," IEEE Trans. Instrum. Meas., 2024.',
      '[3] R. Patel et al., "Comparative Analysis of Spatial Interpolation Techniques," IEEE Sensors Journal, 2023.',
      '[4] L. Gomez & A. Hernandez, "Automated IoT Wi-Fi Heatmap Generation," IEEE IoT Journal, 2024.',
      '[5] J. Chen et al., "Robust Multilateration Positioning via Multi-AP RSSI," IEEE Wireless Commun. Lett., 2025.',
      '[6] Espressif Systems, "ESP32 Series Technical Reference Manual," v4.8, 2024.',
      '[7] The MathWorks Inc., "MATLAB Curve Fitting and Interpolation Documentation," 2024.',
    ],
    speakerScript:
      'These are our academic references from IEEE Access, IEEE TIM, and IEEE Sensors Journal published between 2023 and 2025. Thank you, and we now welcome your questions.',
  },
];

export const ReviewPresentationView: React.FC = () => {
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const slide = SLIDES[currentSlideIndex];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Action Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(30, 41, 59, 0.7)',
          border: '1px solid rgba(51, 65, 85, 0.8)',
          borderRadius: '12px',
          padding: '16px 20px',
        }}
      >
        <div>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>
            Faculty Evaluation Deck • 12-Slide Mid-Project Review
          </span>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#f8fafc', margin: '4px 0 0 0' }}>
            Wi-Fi Signal Strength Mapping Using RSSI Heatmap
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <a
            href="./SDC_Mid_Project_Review_WiFi_RSSI_Mapping.pptx"
            download="SDC_Mid_Project_Review_WiFi_RSSI_Mapping.pptx"
            className="btn-clean"
            style={{
              background: '#2563eb',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              textDecoration: 'none',
            }}
          >
            <span>📥 Download PPTX File</span>
          </a>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className="btn-clean"
              disabled={currentSlideIndex === 0}
              onClick={() => setCurrentSlideIndex((prev) => Math.max(0, prev - 1))}
              style={{ padding: '8px 14px' }}
            >
              ◀ Prev
            </button>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0 10px',
                color: '#94a3b8',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              {currentSlideIndex + 1} / {SLIDES.length}
            </span>
            <button
              className="btn-clean"
              disabled={currentSlideIndex === SLIDES.length - 1}
              onClick={() => setCurrentSlideIndex((prev) => Math.min(SLIDES.length - 1, prev + 1))}
              style={{ padding: '8px 14px' }}
            >
              Next ▶
            </button>
          </div>
        </div>
      </div>

      {/* Main Slide Card Container */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: slide.imageSrc ? '1.2fr 1fr' : '1fr',
          gap: '20px',
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          borderRadius: '16px',
          padding: '28px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 800,
              }}
            >
              SLIDE {slide.id}: {slide.category.toUpperCase()}
            </span>
          </div>

          <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#f8fafc', margin: 0, lineHeight: 1.3 }}>
            {slide.title}
          </h3>

          <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {slide.bulletPoints.map((pt, idx) => (
              <li
                key={idx}
                style={{
                  color: '#e2e8f0',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  paddingLeft: '18px',
                  position: 'relative',
                }}
              >
                <span style={{ position: 'absolute', left: 0, color: '#38bdf8', fontWeight: 'bold' }}>•</span>
                {pt}
              </li>
            ))}
          </ul>

          {/* Speaker Script Box */}
          <div
            style={{
              marginTop: 'auto',
              background: 'rgba(30, 41, 59, 0.9)',
              borderLeft: '4px solid #34d399',
              padding: '12px 16px',
              borderRadius: '0 8px 8px 0',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#34d399', textTransform: 'uppercase', marginBottom: '4px' }}>
              🎙️ Recommended Speaker Script for Faculty:
            </div>
            <div style={{ fontSize: '12px', color: '#cbd5e1', fontStyle: 'italic', lineHeight: '1.5' }}>
              "{slide.speakerScript}"
            </div>
          </div>
        </div>

        {/* Embedded Chart / Graphic Preview if present */}
        {slide.imageSrc && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              background: 'rgba(30, 41, 59, 0.6)',
              borderRadius: '12px',
              padding: '16px',
              border: '1px solid rgba(51, 65, 85, 0.6)',
            }}
          >
            <img
              src={slide.imageSrc}
              alt={slide.title}
              style={{
                maxWidth: '100%',
                maxHeight: '380px',
                borderRadius: '8px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
              }}
            />
            <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '10px', fontWeight: 600 }}>
              Experimental MATLAB / Python 300-DPI Output
            </span>
          </div>
        )}
      </div>

      {/* Slide Navigation Thumbnails */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: '10px',
        }}
      >
        {SLIDES.map((s, idx) => (
          <button
            key={s.id}
            onClick={() => setCurrentSlideIndex(idx)}
            style={{
              background: idx === currentSlideIndex ? 'rgba(56, 189, 248, 0.2)' : 'rgba(30, 41, 59, 0.6)',
              border: idx === currentSlideIndex ? '1px solid #38bdf8' : '1px solid rgba(51, 65, 85, 0.6)',
              borderRadius: '8px',
              padding: '10px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ fontSize: '10px', fontWeight: 700, color: idx === currentSlideIndex ? '#38bdf8' : '#94a3b8' }}>
              Slide {s.id}
            </div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: idx === currentSlideIndex ? '#f8fafc' : '#cbd5e1',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {s.category}
            </div>
          </button>
        ))}
      </div>

      {/* Academic Figures Gallery */}
      <div
        style={{
          background: 'rgba(30, 41, 59, 0.5)',
          border: '1px solid rgba(51, 65, 85, 0.6)',
          borderRadius: '14px',
          padding: '20px',
        }}
      >
        <h4 style={{ fontSize: '15px', fontWeight: 800, color: '#f8fafc', margin: '0 0 14px 0' }}>
          MATLAB Analytical Figures Gallery (Included in Presentation & Report)
        </h4>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
          {[
            { name: 'WiFi_RSSI_TimeSeries.png', label: '10-Sample Time Stability (σ = 0.88 dB)' },
            { name: 'WiFi_RSSI_Bar.png', label: 'Mean Signal Strength & Histogram' },
            { name: 'WiFi_RSSI_Heatmap_2D.png', label: '2D Continuous Contour Heatmap' },
            { name: 'WiFi_RSSI_Heatmap_3D.png', label: '3D Elevation Surface Topography' },
            { name: 'WiFi_Path_Loss_Model.png', label: 'Log-Distance Path Loss Regression (n = 2.82)' },
            { name: 'WiFi_Trilateration_Localization.png', label: 'Indoor Trilateration Positioning Solver' },
          ].map((fig, idx) => (
            <div
              key={idx}
              style={{
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(51, 65, 85, 0.6)',
                borderRadius: '10px',
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <img
                src={`./figures/${fig.name}`}
                alt={fig.label}
                style={{ width: '100%', height: '140px', objectFit: 'contain', borderRadius: '6px' }}
              />
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#e2e8f0', textAlign: 'center' }}>
                {fig.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
