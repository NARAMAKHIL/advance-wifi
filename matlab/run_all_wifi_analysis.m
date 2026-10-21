% Master Runner Script for Wi-Fi RSSI Mapping & Propagation Analysis
% File: run_all_wifi_analysis.m
% Description: Runs all four project analytical stages in sequence:
%   1. rssi_analysis.m        - 10-sample time stability & statistics
%   2. rssi_heatmap.m         - 2D contour heatmap & 3D signal surface
%   3. path_loss_prediction.m - Log-distance path loss OLS regression & prediction
%   4. indoor_localization.m  - Multi-AP trilateration position estimation

clc;
clear;
close all;

fprintf('=================================================================\n');
fprintf('   Wi-Fi Signal Strength Mapping & Analytical Suite (ESP32)      \n');
fprintf('     Department of Computer Science / ECE / AI & Data Science    \n');
fprintf('=================================================================\n\n');

start_time = tic;

%% Stage 1: Single-Location Statistical Analysis
fprintf('>>> STAGE 1/4: Analyzing ESP32 RSSI Time Sequence...\n');
try
    rssi_analysis;
catch ME
    fprintf('Error in Stage 1: %s\n', ME.message);
end

%% Stage 2: Spatial RSSI Heatmap & 3D Surface
fprintf('\n>>> STAGE 2/4: Generating Spatial RSSI Heatmap & 3D Mesh...\n');
try
    rssi_heatmap;
catch ME
    fprintf('Error in Stage 2: %s\n', ME.message);
end

%% Stage 3: Log-Distance Path Loss Modeling
fprintf('\n>>> STAGE 3/4: Estimating Empirical Log-Distance Path Loss...\n');
try
    path_loss_prediction;
catch ME
    fprintf('Error in Stage 3: %s\n', ME.message);
end

%% Stage 4: Indoor Trilateration Localization
fprintf('\n>>> STAGE 4/4: Running Indoor Trilateration Positioning...\n');
try
    indoor_localization;
catch ME
    fprintf('Error in Stage 4: %s\n', ME.message);
end

total_time = toc(start_time);

fprintf('\n=================================================================\n');
fprintf('                      ANALYSIS COMPLETE                          \n');
fprintf('=================================================================\n');
fprintf(' Total execution time: %.2f seconds\n', total_time);
fprintf(' Generated Publication Figures:\n');
fprintf('   1. WiFi_RSSI_TimeSeries.png          (Sample time stability)\n');
fprintf('   2. WiFi_RSSI_Bar.png                 (Mean & distribution)\n');
fprintf('   3. WiFi_RSSI_Heatmap_2D.png          (2D spatial contour map)\n');
fprintf('   4. WiFi_RSSI_Heatmap_3D.png          (3D elevation surface)\n');
fprintf('   5. WiFi_Path_Loss_Model.png          (Empirical regression curve)\n');
fprintf('   6. WiFi_Trilateration_Localization.png (Multi-AP position fix)\n');
fprintf('=================================================================\n\n');
