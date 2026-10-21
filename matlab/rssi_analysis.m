% Wi-Fi RSSI Measurement & Statistical Analysis
% File: rssi_analysis.m
% Description: Analyzes 10-sample ESP32 RSSI serial data, computes statistical
% metrics, and exports academic plots for project reviews.

clc;
clear;
close all;

fprintf('=================================================================\n');
fprintf('       Wi-Fi RSSI Statistical Analysis Using ESP32 Data         \n');
fprintf('=================================================================\n\n');

%% 1. Locate and Load Dataset
filename = 'rssi_data.csv';

if ~isfile(filename)
    % Check alternative path
    script_dir = fileparts(mfilename('fullpath'));
    alt_file = fullfile(script_dir, '..', 'data', 'real', 'rssi_data.csv');
    if isfile(alt_file)
        filename = alt_file;
    else
        error('CSV file "%s" not found. Place rssi_data.csv in the MATLAB folder.', filename);
    end
end

fprintf('Loading dataset: %s\n', filename);
data = readtable(filename);
disp(data);

%% 2. Extract and Clean RSSI Values
% Support different column naming variations
col_names = data.Properties.VariableNames;
rssi_col = '';
for c = {'RSSI_dBm', 'rssi_dbm', 'RSSI', 'rssi'}
    if any(strcmp(col_names, c{1}))
        rssi_col = c{1};
        break;
    end
end

if isempty(rssi_col)
    error('Could not find RSSI column (expected RSSI_dBm or rssi_dbm).');
end

% Extract and clean numeric values
if exist('clean_rssi_data', 'file') == 2
    RSSI = clean_rssi_data(data.(rssi_col));
else
    raw = data.(rssi_col);
    if iscell(raw) || isstring(raw)
        raw = regexprep(string(raw), '(?i)\s*dbm', '');
        RSSI = str2double(raw);
    else
        RSSI = double(raw);
    end
end

validIdx = ~isnan(RSSI) & RSSI ~= -999;
RSSI = RSSI(validIdx);
N = length(RSSI);

if N == 0
    error('No valid RSSI measurements found in the dataset.');
end

%% 3. Statistical Calculations
meanRSSI   = mean(RSSI);
medianRSSI = median(RSSI);
minRSSI    = min(RSSI);
maxRSSI    = max(RSSI);
rangeRSSI  = maxRSSI - minRSSI;
stdRSSI    = std(RSSI);
varRSSI    = var(RSSI);
ci95       = 1.96 * (stdRSSI / sqrt(N)); % 95% Confidence Interval half-width

fprintf('\n-------------------------------------------------------------\n');
fprintf('               RSSI Statistical Summary                      \n');
fprintf('-------------------------------------------------------------\n');
fprintf(' Number of valid samples (N) : %d\n', N);
fprintf(' Average (Mean) RSSI         : %.2f dBm\n', meanRSSI);
fprintf(' Median RSSI                 : %.2f dBm\n', medianRSSI);
fprintf(' Minimum RSSI                : %.2f dBm\n', minRSSI);
fprintf(' Maximum RSSI                : %.2f dBm\n', maxRSSI);
fprintf(' Dynamic Range               : %.2f dB\n', rangeRSSI);
fprintf(' Standard Deviation (sigma)  : %.2f dB\n', stdRSSI);
fprintf(' Variance (sigma^2)          : %.2f dB^2\n', varRSSI);
fprintf(' 95%% Confidence Interval     : [%.2f, %.2f] dBm\n', meanRSSI - ci95, meanRSSI + ci95);
fprintf('-------------------------------------------------------------\n\n');

%% 4. Figure 1: Sequential RSSI Time Series Plot
fig1 = figure('Name', 'ESP32 RSSI Time Sequence', 'Color', 'w', 'Position', [100, 100, 750, 480]);

readings = 1:N;
plot(readings, RSSI, '-o', 'LineWidth', 2.2, 'Color', [0.08, 0.45, 0.82], ...
    'MarkerSize', 8, 'MarkerFaceColor', [0.18, 0.65, 0.92], 'MarkerEdgeColor', [0.08, 0.35, 0.70]);
hold on;

% Mean line
yline(meanRSSI, '--r', sprintf('Mean = %.2f dBm', meanRSSI), ...
    'LineWidth', 1.8, 'LabelHorizontalAlignment', 'left', 'FontSize', 11);

% ±1 sigma confidence band
fill([readings, fliplr(readings)], ...
     [repmat(meanRSSI + stdRSSI, 1, N), repmat(meanRSSI - stdRSSI, 1, N)], ...
     [0.85, 0.92, 0.98], 'FaceAlpha', 0.4, 'EdgeColor', 'none', 'DisplayName', '\pm 1\sigma Band');

% Re-plot data points on top
plot(readings, RSSI, '-o', 'LineWidth', 2.2, 'Color', [0.08, 0.45, 0.82], ...
    'MarkerSize', 8, 'MarkerFaceColor', [0.18, 0.65, 0.92], 'MarkerEdgeColor', [0.08, 0.35, 0.70]);

hold off;
grid on;
box on;
xlabel('Measurement Sample Index (5-second intervals)', 'FontSize', 12, 'FontWeight', 'bold');
ylabel('Received Signal Strength Indicator (dBm)', 'FontSize', 12, 'FontWeight', 'bold');
title(sprintf('Wi-Fi RSSI Time Stability - ESP32 Acquisition (\\mu = %.2f dBm, \\sigma = %.2f dB)', ...
    meanRSSI, stdRSSI), 'FontSize', 13, 'FontWeight', 'bold');
xlim([0.5, N + 0.5]);
ylim([minRSSI - 3, maxRSSI + 3]);
set(gca, 'FontSize', 11);

% Save figure
saveas(fig1, 'WiFi_RSSI_TimeSeries.png');
fprintf('Saved figure: WiFi_RSSI_TimeSeries.png\n');

%% 5. Figure 2: Statistical Bar Chart & Value Distribution
fig2 = figure('Name', 'RSSI Statistical Metrics', 'Color', 'w', 'Position', [150, 150, 800, 420]);

subplot(1, 2, 1);
b = bar(1, meanRSSI, 0.5, 'FaceColor', [0.20, 0.55, 0.85], 'EdgeColor', [0.10, 0.35, 0.65], 'LineWidth', 1.5);
hold on;
errorbar(1, meanRSSI, stdRSSI, 'k', 'LineWidth', 2, 'CapSize', 15);
hold off;
grid on;
box on;
set(gca, 'XTick', 1, 'XTickLabel', {'Mean RSSI (\pm \sigma)'}, 'FontSize', 11);
ylabel('Signal Strength (dBm)', 'FontSize', 12, 'FontWeight', 'bold');
title('Average Signal Strength', 'FontSize', 12, 'FontWeight', 'bold');
ylim([minRSSI - 5, 0]);
text(1, meanRSSI / 2, sprintf('%.2f dBm\n\\sigma = %.2f dB', meanRSSI, stdRSSI), ...
    'HorizontalAlignment', 'center', 'FontSize', 11, 'Color', 'w', 'FontWeight', 'bold');

subplot(1, 2, 2);
histogram(RSSI, 'BinWidth', 1, 'FaceColor', [0.30, 0.70, 0.50], 'EdgeColor', 'k', 'FaceAlpha', 0.85);
grid on;
box on;
xlabel('Measured RSSI (dBm)', 'FontSize', 12, 'FontWeight', 'bold');
ylabel('Frequency Count', 'FontSize', 12, 'FontWeight', 'bold');
title('Sample Distribution Histogram', 'FontSize', 12, 'FontWeight', 'bold');
set(gca, 'FontSize', 11);

saveas(fig2, 'WiFi_RSSI_Bar.png');
fprintf('Saved figure: WiFi_RSSI_Bar.png\n');

fprintf('\nRSSI analysis completed successfully.\n');
