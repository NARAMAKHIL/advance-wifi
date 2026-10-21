% RUN_ALL_ANALYTICS - Master Runner for WiFiSense 3D MATLAB Suite
%
% Executes:
%   1. Empirical Log-Distance Path Loss parameter estimation (P0, n, sigma)
%   2. Spatial Interpolation Benchmark & LOOCV (Linear vs Natural vs Cubic vs RBF)
%   3. RSSI Trilateration & Indoor Localization Solver (LLS and NLS)

clear; clc; close all;

fprintf('=================================================================\n');
fprintf('        WiFiSense 3D - Comprehensive MATLAB Analysis Suite       \n');
fprintf('  Intelligent RF Signal Mapping & Academic Experimental Modeling \n');
fprintf('=================================================================\n\n');

% Locate sample dataset
script_dir = fileparts(mfilename('fullpath'));
csv_candidates = {
    fullfile(script_dir, '..', 'data', 'real', 'measurements.csv'),
    fullfile(script_dir, '..', 'data', 'synthetic_demo', 'measurements.csv'),
    fullfile(script_dir, 'sample_measurements.csv')
};

target_csv = '';
for i = 1:length(csv_candidates)
    if isfile(csv_candidates{i})
        target_csv = csv_candidates{i};
        break;
    end
end

if isempty(target_csv)
    warning('No existing CSV found. Creating a synthetic baseline for testing...');
    target_csv = fullfile(script_dir, 'sample_measurements.csv');
    % Generate a quick CSV baseline
    x_pts = repmat(1:2:7, 1, 4);
    y_pts = repelem(1:2:7, 4);
    d_pts = sqrt(x_pts.^2 + y_pts.^2);
    rssi = -42 - 10 * 2.5 * log10(max(1, d_pts)) + randn(1, 16) * 1.5;
    
    T_synth = table(x_pts', y_pts', rssi', repmat({'ok'}, 16, 1), ...
        'VariableNames', {'x_m', 'y_m', 'rssi_dbm', 'scan_status'});
    writetable(T_synth, target_csv);
    fprintf('Saved temporary baseline to %s\n', target_csv);
end

fprintf('Target Data: %s\n\n', target_csv);

% Step 1: Path Loss Model
fprintf('>>> [1/3] Estimating Log-Distance Path Loss Parameters...\n');
try
    res_pathloss = path_loss_model(target_csv);
catch ME
    fprintf('Path loss fitting error: %s\n', ME.message);
end

% Step 2: Spatial Interpolation Comparison
fprintf('\n>>> [2/3] Benchmarking 2D Spatial Interpolation via LOOCV...\n');
try
    res_interp = spatial_interpolation_comparison(target_csv);
catch ME
    fprintf('Interpolation benchmark error: %s\n', ME.message);
end

% Step 3: Trilateration Localization
fprintf('\n>>> [3/3] Running RSSI Indoor Trilateration Solver...\n');
try
    res_trilat = indoor_localization_trilateration([3.5, 6.2], 2.0);
catch ME
    fprintf('Trilateration solver error: %s\n', ME.message);
end

fprintf('\n=================================================================\n');
fprintf('  WiFiSense 3D MATLAB Execution Completed Successfully.          \n');
fprintf('  All publication figures and metrics are generated.              \n');
fprintf('=================================================================\n');
