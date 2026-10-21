% Wi-Fi Log-Distance Path Loss Modeling & Distance Prediction
% File: path_loss_prediction.m
% Description: Fits empirical Log-Distance Path Loss with log-normal shadowing
% using Ordinary Least Squares (OLS) regression on spatial ESP32 measurements.

clc;
clear;
close all;

fprintf('=================================================================\n');
fprintf('     Wi-Fi Log-Distance Path Loss Parameter Estimation & Modeling\n');
fprintf('=================================================================\n\n');

%% 1. Locate and Load Dataset
filename = 'spatial_rssi_data.csv';

if ~isfile(filename)
    script_dir = fileparts(mfilename('fullpath'));
    alt_file = fullfile(script_dir, '..', 'data', 'real', 'spatial_rssi_data.csv');
    if isfile(alt_file)
        filename = alt_file;
    else
        error('Spatial CSV file "%s" not found. Place spatial_rssi_data.csv in the folder.', filename);
    end
end

fprintf('Loading spatial dataset: %s\n', filename);
data = readtable(filename);

% Extract coordinates and RSSI
X = double(data.X);
Y = double(data.Y);

if exist('clean_rssi_data', 'file') == 2
    RSSI = clean_rssi_data(data.RSSI_dBm);
else
    raw = data.RSSI_dBm;
    if iscell(raw) || isstring(raw)
        raw = regexprep(string(raw), '(?i)\s*dbm', '');
        RSSI = str2double(raw);
    else
        RSSI = double(raw);
    end
end

valid = isfinite(X) & isfinite(Y) & isfinite(RSSI);
X = X(valid);
Y = Y(valid);
RSSI = RSSI(valid);
N = length(RSSI);

if N < 3
    error('At least 3 valid points are required for regression.');
end

%% 2. Define Access Point Position & Compute Distances
% Location of maximum RSSI corresponds to the AP position
[max_rssi, max_idx] = max(RSSI);
ap_x = X(max_idx);
ap_y = Y(max_idx);

fprintf('Access Point (AP) estimated location: (%.1f, %.1f) m with RSSI = %.1f dBm\n', ...
    ap_x, ap_y, max_rssi);

% Reference distance d0 = 1.0 m
d0 = 1.0;

% Euclidean distances
distances = sqrt((X - ap_x).^2 + (Y - ap_y).^2);
% Clamp minimum distance to 0.5 m to avoid log(0) singularity
distances(distances < 0.5) = 0.5;

%% 3. Ordinary Least Squares (OLS) Fitting
% Model: RSSI(d) = P0 - 10 * n * log10(d / d0)
% Linearized: y = beta1 + beta2 * x_reg
% where y = RSSI, x_reg = -10 * log10(d / d0)
% beta1 = P0 (reference power at 1m)
% beta2 = n (path loss exponent)

x_reg = -10 * log10(distances / d0);
X_mat = [ones(N, 1), x_reg];
y_vec = RSSI;

% OLS Normal Equation: beta = (X' * X) \ (X' * y)
beta = X_mat \ y_vec;
P0 = beta(1);
n  = beta(2);

% Model predictions and residuals
y_pred = X_mat * beta;
residuals = y_vec - y_pred;
sigma_shadow = std(residuals);
rmse = sqrt(mean(residuals.^2));
mae  = mean(abs(residuals));

% R-squared coefficient of determination
ss_total = sum((y_vec - mean(y_vec)).^2);
ss_res   = sum(residuals.^2);
r_squared = 1 - (ss_res / ss_total);

fprintf('\n-------------------------------------------------------------\n');
fprintf('             Empirical Path Loss Fit Parameters              \n');
fprintf('-------------------------------------------------------------\n');
fprintf(' Reference Distance (d0)         : %.1f m\n', d0);
fprintf(' Reference Power (P0 at 1m)      : %.2f dBm\n', P0);
fprintf(' Path Loss Exponent (n)          : %.2f (Indoor obstructed: 2.5 - 3.5)\n', n);
fprintf(' Shadow Fading Std (sigma)       : %.2f dB\n', sigma_shadow);
fprintf(' Root Mean Square Error (RMSE)   : %.2f dB\n', rmse);
fprintf(' Mean Absolute Error (MAE)       : %.2f dB\n', mae);
fprintf(' Coefficient of Determination R^2: %.3f\n', r_squared);
fprintf('-------------------------------------------------------------\n\n');

%% 4. Figure: Log-Distance Curve & Shadow Fading Envelope
fig = figure('Name', 'Log-Distance Path Loss Model', 'Color', 'w', 'Position', [100, 100, 850, 520]);

% Continuous distance range for smooth curves
d_fine = linspace(0.8, max(distances) + 2.0, 200);
rssi_empirical = P0 - 10 * n * log10(d_fine / d0);
rssi_freespace = P0 - 10 * 2.0 * log10(d_fine / d0); % n = 2.0 Free Space

% Shadow fading envelope (±1 sigma)
upper_envelope = rssi_empirical + sigma_shadow;
lower_envelope = rssi_empirical - sigma_shadow;

% Fill shadow envelope
fill([d_fine, fliplr(d_fine)], [upper_envelope, fliplr(lower_envelope)], ...
    [0.90, 0.93, 0.98], 'FaceAlpha', 0.6, 'EdgeColor', 'none', ...
    'DisplayName', sprintf('Shadow Fading Envelope (\\pm 1\\sigma = %.1f dB)', sigma_shadow));
hold on;

% Theoretical Free-Space Line
plot(d_fine, rssi_freespace, '--', 'Color', [0.4, 0.4, 0.4], 'LineWidth', 1.8, ...
    'DisplayName', 'Theoretical Free Space (n = 2.0)');

% Empirical Fitted Curve
plot(d_fine, rssi_empirical, '-r', 'LineWidth', 2.5, ...
    'DisplayName', sprintf('Empirical Model: P_r(d) = %.1f - 10(%.2f)log_{10}(d)', P0, n));

% Surveyed Data Points
scatter(distances, RSSI, 65, [0.08, 0.45, 0.82], 'filled', 'MarkerEdgeColor', 'k', ...
    'DisplayName', sprintf('Measured Nodes (N = %d)', N));

hold off;
grid on;
box on;
xlabel('Distance from Wi-Fi Access Point (meters)', 'FontSize', 12, 'FontWeight', 'bold');
ylabel('Received Signal Strength Indicator (dBm)', 'FontSize', 12, 'FontWeight', 'bold');
title(sprintf('Log-Distance Path Loss Regression (n = %.2f, P_0 = %.1f dBm, \\sigma = %.2f dB)', ...
    n, P0, sigma_shadow), 'FontSize', 13, 'FontWeight', 'bold');
legend('show', 'Location', 'northeast');
xlim([0.5, max(distances) + 2.0]);
ylim([min(RSSI) - 8, max(RSSI) + 5]);
set(gca, 'FontSize', 11);

saveas(fig, 'WiFi_Path_Loss_Model.png');
fprintf('Saved figure: WiFi_Path_Loss_Model.png\n');

%% 5. Distance vs. RSSI Prediction Table
pred_distances = [1.0, 2.0, 3.0, 4.0, 5.0, 7.0, 10.0, 15.0, 20.0, 25.0];

fprintf('\n-------------------------------------------------------------\n');
fprintf('     Distance vs. Predicted RSSI Lookup Table (Lab B244)     \n');
fprintf('-------------------------------------------------------------\n');
fprintf(' Distance (m) | Predicted RSSI (dBm) | Expected Signal Quality\n');
fprintf('-------------------------------------------------------------\n');

for i = 1:length(pred_distances)
    d = pred_distances(i);
    pred_val = P0 - 10 * n * log10(d / d0);
    
    if pred_val >= -50
        qual = 'Excellent (Near AP)';
    elseif pred_val >= -60
        qual = 'Good (Standard coverage)';
    elseif pred_val >= -70
        qual = 'Fair (Wall attenuation)';
    else
        qual = 'Weak / Borderline Deadzone';
    end
    
    fprintf('   %5.1f m    |       %6.2f dBm      | %s\n', d, pred_val, qual);
end
fprintf('-------------------------------------------------------------\n');
fprintf('Path-loss model analysis completed successfully.\n\n');
