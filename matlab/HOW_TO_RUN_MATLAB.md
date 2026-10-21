# How to Run MATLAB Wireless Propagation & Heatmap Suite

This guide explains how to run the complete MATLAB analytical suite on your machine (MATLAB R2018a or later, or MATLAB Online).

---

## 📁 Directory Structure & File Map

```
advanced-wifi-speed-meter/
├── matlab/
│   ├── clean_rssi_data.m              # Helper: cleans string 'dBm', -999, NaNs
│   ├── rssi_data.csv                  # Real 10-reading ESP32 benchmark (Amrita-2.4G-B244)
│   ├── spatial_rssi_data.csv          # 16-point physical spatial room survey dataset
│   ├── rssi_analysis.m                # Stage 1: Statistical analysis & time stability
│   ├── rssi_heatmap.m                 # Stage 2: 2D contour & 3D signal surface elevation
│   ├── path_loss_prediction.m         # Stage 3: Log-distance OLS regression & lookup table
│   ├── indoor_localization.m          # Stage 4: Multi-AP trilateration solver (LLS/NLS)
│   ├── run_all_wifi_analysis.m        # Master script: 1-click execution of all 4 stages
│   └── figures/                       # Pre-generated 300 DPI publication figures
```

---

## 🚀 Quick Start (1-Click Run)

1. Launch **MATLAB**.
2. Set the **Current Folder** to the `matlab/` directory:
   ```matlab
   cd '/Users/kaush/Downloads/advanced-wifi-speed-meter/matlab'
   ```
3. In the MATLAB Command Window, run the master runner:
   ```matlab
   run_all_wifi_analysis
   ```
4. All four stages will run sequentially, print summary tables to the Command Window, and save high-resolution figures.

---

## 🔬 Running Individual Modules

### 1. Single-Location RSSI Statistical Analysis
* **Script:** `rssi_analysis.m`
* **Input File:** `rssi_data.csv`
* **Execution:**
  ```matlab
  rssi_analysis
  ```
* **Outputs Generated:**
  * Displays sample count $N=10$, Mean RSSI ($-54.10\text{ dBm}$), Minimum ($-55\text{ dBm}$), Maximum ($-53\text{ dBm}$), Standard Deviation ($\sigma = 0.88\text{ dB}$), and 95% Confidence Interval.
  * Saves `WiFi_RSSI_TimeSeries.png` (time-series with mean and $\pm 1\sigma$ band).
  * Saves `WiFi_RSSI_Bar.png` (average signal bar chart and distribution histogram).

---

### 2. Spatial RSSI 2D Contour & 3D Surface Heatmap
* **Script:** `rssi_heatmap.m`
* **Input File:** `spatial_rssi_data.csv`
* **Execution:**
  ```matlab
  rssi_heatmap
  ```
* **Outputs Generated:**
  * Computes natural-neighbor and Delaunay spatial interpolation over a $120 \times 120$ grid.
  * Overlays physical survey nodes with annotated RSSI readings.
  * Highlights the Wi-Fi Access Point location with a prominent red star.
  * Prints a coverage quality breakdown:
    * **Excellent ($\ge -50\text{ dBm}$)**
    * **Good ($-50$ to $-60\text{ dBm}$)**
    * **Fair ($-60$ to $-70\text{ dBm}$)**
    * **Poor ($< -70\text{ dBm}$)**
  * Saves `WiFi_RSSI_Heatmap_2D.png` and `WiFi_RSSI_Heatmap_3D.png`.

---

### 3. Log-Distance Path Loss Regression & Distance Table
* **Script:** `path_loss_prediction.m`
* **Input File:** `spatial_rssi_data.csv`
* **Execution:**
  ```matlab
  path_loss_prediction
  ```
* **Mathematical Formulation:**
  $$P_r(d) = P_0 - 10 \cdot n \cdot \log_{10}\left(\frac{d}{d_0}\right) + X_\sigma$$
* **Outputs Generated:**
  * Extracts empirical path loss exponent $n$ (indoor lab typically $\approx 2.7$–$3.2$).
  * Estimates reference power $P_0$ at $d_0 = 1.0\text{ m}$.
  * Computes shadow fading standard deviation $\hat{\sigma}$ (dB).
  * Compares empirical curve against theoretical free space ($n = 2.0$).
  * Prints a distance lookup prediction table from $1\text{ m}$ to $25\text{ m}$.
  * Saves `WiFi_Path_Loss_Model.png`.

---

### 4. Indoor Multilateration & Trilateration Positioning
* **Script:** `indoor_localization.m`
* **Execution:**
  ```matlab
  indoor_localization
  ```
* **Outputs Generated:**
  * Takes ranging estimates from 4 Wi-Fi Access Points.
  * Solves receiver coordinates using Linear Least Squares (LLS) and Non-linear Least Squares (NLS) optimization (`fminsearch`).
  * Calculates localization error in meters.
  * Plots transmitter anchors, ranging circles, true location, and estimated position.
  * Saves `WiFi_Trilateration_Localization.png`.

---

## 🛠️ Data Format Guide

### Single-Location Benchmark (`rssi_data.csv`)
```csv
Date_Time,Reading,ESP32_Time,SSID,RSSI_dBm
2026-09-29 21:40:22,1,4914,Amrita-2.4G-B244,-54 dBm
2026-09-29 21:40:30,2,12912,Amrita-2.4G-B244,-54 dBm
...
```
*(Notice: The scripts automatically handle the `' dBm'` string suffix!)*

### Spatial Survey Grid (`spatial_rssi_data.csv`)
```csv
Point_ID,X,Y,RSSI_dBm,SSID,Sample_Count,Std_Dev_dB
P01,1.0,1.0,-39.2,Amrita-2.4G-B244,10,0.75
P02,3.0,1.0,-47.5,Amrita-2.4G-B244,10,0.82
...
```
* **X**: Horizontal coordinate in meters relative to room origin $(0, 0)$.
* **Y**: Vertical coordinate in meters relative to room origin $(0, 0)$.
* **RSSI_dBm**: 10-sample mean signal strength measured at that location.
