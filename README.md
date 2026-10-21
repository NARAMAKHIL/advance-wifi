# WiFiSense 3D: Intelligent Wi-Fi Signal Mapping, Coverage Analytics, and Experimental Indoor Localization

**A BTech Capstone Project in Artificial Intelligence & Data Science**  
*Embedded Systems (ESP32) • Scientific Computing (Python & MATLAB) • Full-Stack Telemetry (FastAPI & React 19)*

---

### 🌐 Live Dashboard & Mid-Project Review Deliverables

* **Live Web Dashboard (GitHub Pages):** [https://naramakhil.github.io/advance-wifi/](https://naramakhil.github.io/advance-wifi/)
* **12-Slide PowerPoint Presentation (.pptx):** [`docs/SDC_Mid_Project_Review_WiFi_RSSI_Mapping.pptx`](file:///Users/kaush/Downloads/advanced-wifi-speed-meter/docs/SDC_Mid_Project_Review_WiFi_RSSI_Mapping.pptx)
* **Presentation Script & Viva Defense Guide:** [`docs/MID_PROJECT_REVIEW_PPT_CONTENT.md`](file:///Users/kaush/Downloads/advanced-wifi-speed-meter/docs/MID_PROJECT_REVIEW_PPT_CONTENT.md)
* **Complete MATLAB Wireless Propagation Suite:** [`matlab/HOW_TO_RUN_MATLAB.md`](file:///Users/kaush/Downloads/advanced-wifi-speed-meter/matlab/HOW_TO_RUN_MATLAB.md)
* **Real ESP32 Experimental Log (`Amrita-2.4G-B244`):** [`matlab/rssi_data.csv`](file:///Users/kaush/Downloads/advanced-wifi-speed-meter/matlab/rssi_data.csv)

---

## 📌 Executive Summary

Modern indoor wireless communication environments suffer from complex multi-path fading, shadow attenuation through partition walls, and unpredictable signal degradation. Commercial Wi-Fi surveys often rely on expensive proprietary dongles or coarse simulation models that fail to capture physical environment realities.

**WiFiSense 3D** is an end-to-end, scientifically defensible platform that bridges low-cost embedded hardware with high-fidelity statistical machine learning and spatial interpolation:
1. **ESP32 Edge Node**: Collects passively surveyed 802.11 beacons with calibrated metadata, transmitting structured JSON frames over a high-speed serial link.
2. **FastAPI Analytical Backend**: Implements thread-safe CSV persistence, Leave-One-Out Cross-Validation (LOOCV), information-gain survey point recommendation, and physics-based synthetic propagation simulation.
3. **React 19 + Plotly Web Interface**: Offers interactive 2D contour heatmaps, 3D signal elevation surfaces, empirical log-distance path loss regression curves, and a live hardware control console.
4. **MATLAB Wireless Research Suite**: Provides academic scripts for empirical path loss modeling, comparative spatial interpolation benchmarks, and RSSI multilateration/trilateration localization.

---

## 📐 Theoretical Framework & Mathematical Formulations

### 1. Log-Distance Path Loss Model with Log-Normal Shadowing
Wireless power attenuation as a function of Euclidean transmitter-receiver separation $d = \sqrt{(x - x_0)^2 + (y - y_0)^2}$ is modeled as:

$$P_r(d) = P_0 - 10 \cdot n \cdot \log_{10}\left(\frac{d}{d_0}\right) + X_\sigma$$

Where:
- $d_0 = 1.0\text{ m}$: Reference distance.
- $P_0$: Received signal strength at reference distance $d_0$ (dBm).
- $n$: Path loss exponent ($n \approx 2.0$ in free space; $n \in [2.5, 4.0]$ in obstructed indoor office environments).
- $X_\sigma \sim \mathcal{N}(0, \sigma^2)$: Zero-mean Gaussian random variable modeling large-scale shadow fading from obstacles (walls, pillars, furniture).

#### Ordinary Least Squares (OLS) Parameter Estimation:
Linearizing with respect to $\beta = [P_0, n]^T$:

$$\mathbf{y} = \mathbf{X} \beta + \mathbf{\epsilon}$$

$$\mathbf{X}_i = \left[1, \ -10 \log_{10}(d_i)\right], \quad y_i = \overline{\text{RSSI}}_i$$

$$\hat{\beta} = (\mathbf{X}^T \mathbf{X})^{-1} \mathbf{X}^T \mathbf{y}$$

$$\hat{\sigma} = \sqrt{\frac{1}{N - 2} \sum_{i=1}^N (y_i - \hat{y}_i)^2}$$

---

### 2. Spatial Signal Interpolation
To reconstruct continuous 2D/3D signal surfaces from discrete survey coordinates $\mathcal{S} = \{(x_i, y_i, \overline{\text{RSSI}}_i)\}_{i=1}^N$:
- **Delaunay Linear Interpolation**: Constructs a 2D simplicial complex (triangulation) over $\mathcal{S}$ and computes barycentric coordinates inside each triangle.
- **Nearest-Neighbor (Voronoi)**: Assigns signal strength from the closest measured Euclidean sample point.
- **Radial Basis Functions (RBF - Multiquadric)**:
  $$f(\mathbf{x}) = \sum_{j=1}^N w_j \sqrt{\|\mathbf{x} - \mathbf{x}_j\|^2 + c^2}$$
  $$\mathbf{w} = \mathbf{\Phi}^{-1} \mathbf{z}, \quad \Phi_{ij} = \sqrt{\|\mathbf{x}_i - \mathbf{x}_j\|^2 + c^2}$$

---

### 3. Leave-One-Out Cross-Validation (LOOCV)
To avoid over-fitting and objectively benchmark interpolation accuracy without bias:

$$\text{RMSE} = \sqrt{\frac{1}{K} \sum_{i \in \text{valid}} \left( \hat{f}_{-i}(x_i, y_i) - \text{RSSI}_i \right)^2}$$

$$\text{MAE} = \frac{1}{K} \sum_{i \in \text{valid}} \left| \hat{f}_{-i}(x_i, y_i) - \text{RSSI}_i \right|$$

Where $\hat{f}_{-i}$ denotes the model trained on all survey points *excluding* point $i$.

---

### 4. RSSI-Based Trilateration / Multilateration Localization
Given $M \ge 3$ fixed anchors at $(x_j, y_j)$ with measured RSSI $P_{r,j}$, the estimated distances are:

$$\hat{d}_j = d_0 \cdot 10^{\frac{P_0 - P_{r,j}}{10 n}}$$

#### Linear Least Squares (LLS) via Reference Subtraction:
Using anchor $M$ as reference:

$$2(x_j - x_M) x + 2(y_j - y_M) y = \hat{d}_M^2 - \hat{d}_j^2 + (x_j^2 + y_j^2) - (x_M^2 + y_M^2)$$

$$\mathbf{A} \mathbf{p} = \mathbf{b} \implies \hat{\mathbf{p}} = (\mathbf{A}^T \mathbf{A})^{-1} \mathbf{A}^T \mathbf{b}$$

#### Non-Linear Least Squares (NLS) Optimization:
$$\hat{\mathbf{p}}_{\text{NLS}} = \arg\min_{\mathbf{p}} \sum_{j=1}^M \left( \|\mathbf{p} - \mathbf{p}_j\| - \hat{d}_j \right)^2$$

---

## 🏗️ Repository Architecture

```
advanced-wifi-speed-meter/
├── firmware/
│   └── wifisense_esp32/
│       ├── wifisense_esp32.ino    # ESP32 C++ firmware with non-blocking scans & JSON protocol
│       └── README.md              # Wiring, flashing, and serial protocol specifications
├── backend/
│   ├── app/
│   │   ├── main.py                # FastAPI lifecycle, CORS, static mounts
│   │   ├── models.py              # Pydantic data schemas & enums
│   │   ├── routers/
│   │   │   └── __init__.py        # REST endpoints and WebSocket stream
│   │   └── services/
│   │       ├── analytics.py       # SciPy interpolation, LOOCV, active recommendations
│   │       ├── data_store.py      # Thread-safe CSV persistence & session filters
│   │       ├── serial_manager.py  # PySerial background thread & device state machine
│   │       └── simulation.py      # Physics-based synthetic path loss & shadow generator
│   └── tests/
│       └── test_backend.py        # 30 unit & integration tests (Pytest)
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Sidebar.tsx        # Navigation with real-time status pill
│   │   │   ├── MetricCard.tsx     # KPI telemetry badges
│   │   │   ├── Heatmap2D.tsx      # Plotly 2D contour map & point sampling trigger
│   │   │   ├── Heatmap3D.tsx      # Plotly 3D signal surface elevation mesh
│   │   │   ├── SignalAnalytics.tsx# Empirical path loss fitting vs theoretical free space
│   │   │   ├── SurveyPlanner.tsx  # Active spatial survey recommendations
│   │   │   ├── ModelValidation.tsx# LOOCV parity plot & residual error table
│   │   │   ├── SerialPanel.tsx    # Hardware link manager & live terminal console
│   │   │   └── DataManagementView.tsx # Session admin, CSV I/O, synthetic generator
│   │   ├── services/
│   │   │   └── api.ts             # Fetch API client matching FastAPI schemas
│   │   ├── types/
│   │   │   └── index.ts           # TypeScript interfaces
│   │   ├── App.tsx                # Master orchestration layout
│   │   └── index.css              # Custom dark scientific design system
│   └── vite.config.ts             # Vite 8 config with backend API proxy
├── matlab/
│   ├── path_loss_model.m          # MATLAB empirical path loss & shadow fading fitter
│   ├── spatial_interpolation_comparison.m # MATLAB 4-way interpolation benchmark (LOOCV)
│   ├── indoor_localization_trilateration.m # LLS & NLS trilateration solver
│   ├── run_all_analytics.m        # Master MATLAB runner script
│   └── README.md                  # MATLAB documentation & instructions
├── scripts/
│   ├── run_backend.sh             # Launch FastAPI server
│   ├── run_frontend.sh            # Launch React dev server
│   ├── test_all.sh                # Run Python and frontend test suites
│   └── generate_demo_data.py      # CLI demo dataset generator
└── data/
    ├── real/                      # Real ESP32 survey CSV files
    └── synthetic_demo/            # Simulated survey CSV datasets
```

---

## ⚡ Quickstart Guide

### Prerequisites
- **Python**: 3.10+ (tested with Python 3.13)
- **Node.js**: v18+ & npm
- **Hardware (Optional)**: ESP32 development board (e.g., ESP32-WROOM-32)
- **MATLAB (Optional)**: R2020a+ or GNU Octave

---

### 1. Run the Python Backend
```bash
# Navigate to project root
cd /path/to/advanced-wifi-speed-meter

# Activate virtual environment
source backend/.venv/bin/activate

# Launch FastAPI server (starts on http://localhost:8000)
./scripts/run_backend.sh
```
*Interactive Swagger API documentation will be available at:* **`http://localhost:8000/docs`**

---

### 2. Run the React Frontend
In a second terminal:
```bash
cd /path/to/advanced-wifi-speed-meter

# Start Vite dev server (starts on http://localhost:5173)
./scripts/run_frontend.sh
```
Open **`http://localhost:5173`** in your browser.

> **Note**: Because the frontend production bundle is pre-built into `frontend/dist`, running just `./scripts/run_backend.sh` also serves the complete UI directly from **`http://localhost:8000`**!

---

### 3. Run the Automated Test Suite
To verify backend functionality and frontend build integrity:
```bash
./scripts/test_all.sh
```
All **30 backend tests** will execute and report passing status.

---

### 4. Run the MATLAB Suite
```matlab
cd ('matlab')
run_all_analytics
```
This generates publication-ready figures for empirical path loss, 4-way interpolation contours, and multilateration ranging circles.

---

## 🎓 Academic Defense & Viva Guide

### Q1: Why do indoor RSSI readings fluctuate significantly at a fixed coordinate?
> **Answer**: Indoor 2.4 GHz RF signals suffer from **small-scale multipath fading**. Transmitted waves reflect off concrete walls, metallic fixtures, and floors, creating constructive and destructive interference patterns at the receiver antenna. Additionally, human movement within the Fresnel zone changes the channel characteristics. WiFiSense 3D addresses this by acquiring multiple samples per coordinate (default: 10 samples) and reporting both the arithmetic mean $\mu$ and standard deviation $\sigma$.

### Q2: Why is Leave-One-Out Cross-Validation (LOOCV) used instead of standard k-fold?
> **Answer**: In spatial indoor site surveys, collecting ground-truth physical coordinates is labor-intensive, resulting in a moderate sample count ($N \in [15, 60]$ locations). Standard k-fold splitting would discard too much spatial training data, weakening the Delaunay triangulation convex hull. LOOCV maximizes sample utilization by training on $N-1$ points and evaluating exclusively on the single held-out point, yielding an unbiased estimate of generalization error.

### Q3: Why does pure RSSI trilateration exhibit positional errors?
> **Answer**: Inversion of the log-distance model assumes spherical, isotropic path loss. In real buildings, non-homogeneous wall partition losses and multi-wall attenuation introduce non-linear biases into estimated distances $\hat{d}_j$. WiFiSense 3D demonstrates both Linear Least Squares (LLS) and Non-linear Least Squares (NLS) to show students and researchers the physical limits of RSSI-based positioning and motivates fingerprinting or hybrid approaches.

---

## 📄 License
Academic & Educational Use Only — BTech Artificial Intelligence and Data Science Capstone Project.
