# WiFiSense 3D — MATLAB Wireless Propagation Suite

This directory contains research-grade MATLAB scripts and algorithms for analyzing RF signal data collected by WiFiSense 3D.

---

## 📁 Files Overview

| Script | Purpose | Mathematical Formulation |
| :--- | :--- | :--- |
| `path_loss_model.m` | Fits empirical Log-Distance Path Loss model | $P_r(d) = P_0 - 10 n \log_{10}(d/d_0) + X_\sigma$ |
| `spatial_interpolation_comparison.m` | Benchmarks Delaunay, Natural, Cubic & RBF | Leave-One-Out Cross-Validation (LOOCV) RMSE / MAE |
| `indoor_localization_trilateration.m` | RSSI-based 2D position estimation fix | Linear (LLS) & Non-linear (NLS) Trilateration |
| `run_all_analytics.m` | Master script executing all models & generating plots | End-to-end evaluation report |

---

## 🚀 How to Run in MATLAB

1. Open MATLAB (R2020a or later, or GNU Octave).
2. Change the current folder to `matlab/`:
   ```matlab
   cd /path/to/advanced-wifi-speed-meter/matlab
   ```
3. Run the master script:
   ```matlab
   run_all_analytics
   ```

### Running Individual Analysis:
- **Path Loss Model:**
  ```matlab
  results = path_loss_model('../data/synthetic_demo/measurements.csv');
  ```
- **Interpolation Benchmark:**
  ```matlab
  results = spatial_interpolation_comparison('../data/synthetic_demo/measurements.csv');
  ```
- **Indoor Trilateration Localization:**
  ```matlab
  results = indoor_localization_trilateration([4.5, 6.0], 1.5);
  ```

---

## 📊 Outputs & Academic Plots

1. **Empirical Path Loss Curve**: Displays measured survey nodes with $\mu \pm \sigma$ error bars, empirical curve fit ($n$, $P_0$), theoretical free space comparison ($n=2.0$), and the $\pm 1\sigma$ shadow fading envelope.
2. **4-Panel Interpolation Benchmark**: Visual comparison of Linear Delaunay Triangulation, Natural Neighbor, Cubic Spline, and Radial Basis Function (RBF) with LOOCV RMSE scores.
3. **RSSI Trilateration Range Plot**: Access Point transmitter beacons with ranging uncertainty radii, true node location, and LLS / NLS estimated positions.
