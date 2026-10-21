% Wi-Fi RSSI Spatial Heatmap & 3D Surface Visualization
% File: rssi_heatmap.m
% Description: Reads spatial survey coordinates (X, Y, RSSI_dBm), interpolates
% coverage using scattered natural-neighbor interpolation, and generates
% 2D contour heatmaps and 3D signal surface elevation plots.

clc;
clear;
close all;

fprintf('=================================================================\n');
fprintf('     Wi-Fi RSSI Spatial Heatmap & Coverage Visualization         \n');
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
disp(data);

%% 2. Extract and Validate Coordinates and RSSI
% Determine column names dynamically
col_names = data.Properties.VariableNames;

% Find X column
x_col = '';
for c = {'X', 'x', 'x_m', 'X_m'}
    if any(strcmp(col_names, c{1})), x_col = c{1}; break; end
end

% Find Y column
y_col = '';
for c = {'Y', 'y', 'y_m', 'Y_m'}
    if any(strcmp(col_names, c{1})), y_col = c{1}; break; end
end

% Find RSSI column
rssi_col = '';
for c = {'RSSI_dBm', 'rssi_dbm', 'RSSI', 'rssi'}
    if any(strcmp(col_names, c{1})), rssi_col = c{1}; break; end
end

if isempty(x_col) || isempty(y_col) || isempty(rssi_col)
    error('Could not identify required columns. Expected X, Y, and RSSI_dBm.');
end

X_raw = double(data.(x_col));
Y_raw = double(data.(y_col));

if exist('clean_rssi_data', 'file') == 2
    RSSI_raw = clean_rssi_data(data.(rssi_col));
else
    raw = data.(rssi_col);
    if iscell(raw) || isstring(raw)
        raw = regexprep(string(raw), '(?i)\s*dbm', '');
        RSSI_raw = str2double(raw);
    else
        RSSI_raw = double(raw);
    end
end

% Clean invalid entries
validIdx = isfinite(X_raw) & isfinite(Y_raw) & isfinite(RSSI_raw) & RSSI_raw ~= -999;
X = X_raw(validIdx);
Y = Y_raw(validIdx);
RSSI = RSSI_raw(validIdx);

num_points = length(RSSI);
if num_points < 3
    error('At least 3 valid spatial measurement points are required to interpolate.');
end

fprintf('\nLoaded %d valid spatial measurement points.\n', num_points);
fprintf('  X bounds: [%.1f, %.1f] meters\n', min(X), max(X));
fprintf('  Y bounds: [%.1f, %.1f] meters\n', min(Y), max(Y));
fprintf('  RSSI range: [%.1f, %.1f] dBm\n', min(RSSI), max(RSSI));

%% 3. Construct 2D Interpolation Grid
grid_res = 120;
xGrid = linspace(min(X) - 0.5, max(X) + 0.5, grid_res);
yGrid = linspace(min(Y) - 0.5, max(Y) + 0.5, grid_res);
[XGrid, YGrid] = meshgrid(xGrid, yGrid);

% Natural-neighbor scattered interpolant
F = scatteredInterpolant(X, Y, RSSI, 'natural', 'linear');
RSSIGrid = F(XGrid, YGrid);

% Identify AP transmitter location (location of highest measured RSSI or P01)
[max_rssi, max_idx] = max(RSSI);
ap_x = X(max_idx);
ap_y = Y(max_idx);

%% 4. Figure 1: 2D Spatial Contour Heatmap
fig1 = figure('Name', 'Wi-Fi RSSI 2D Spatial Heatmap', 'Color', 'w', 'Position', [100, 100, 850, 650]);

% Contour fill
levels = linspace(floor(min(RSSI)), ceil(max(RSSI)), 16);
[C, h] = contourf(XGrid, YGrid, RSSIGrid, levels, 'LineColor', [0.3, 0.3, 0.3], 'LineWidth', 0.5);
hold on;

% Apply colormap
if exist('turbo', 'builtin') || exist('turbo', 'file')
    colormap(turbo(256));
else
    colormap(jet(256));
end

cb = colorbar;
ylabel(cb, 'Received Signal Strength (dBm)', 'FontSize', 12, 'FontWeight', 'bold');
caxis([min(RSSI) - 2, max(RSSI) + 2]);

% Plot actual physical survey points
scatter(X, Y, 55, 'k', 'filled', 'MarkerEdgeColor', 'w', 'LineWidth', 1.2, 'DisplayName', 'Survey Nodes');

% Annotate Point IDs or RSSI values
for i = 1:num_points
    text(X(i) + 0.15, Y(i) + 0.15, sprintf('%.1f', RSSI(i)), ...
        'FontSize', 9, 'FontWeight', 'bold', 'Color', 'k', ...
        'BackgroundColor', [1 1 1 0.7], 'Margin', 2);
end

% Mark Wi-Fi Access Point location
plot(ap_x, ap_y, 'p', 'MarkerSize', 18, 'MarkerFaceColor', 'r', ...
    'MarkerEdgeColor', 'k', 'LineWidth', 1.5, 'DisplayName', 'Wi-Fi AP (Amrita-2.4G-B244)');

hold off;
axis equal;
xlim([min(xGrid), max(xGrid)]);
ylim([min(yGrid), max(yGrid)]);
grid on;
box on;
set(gca, 'FontSize', 11);
xlabel('Physical X Dimension (meters)', 'FontSize', 12, 'FontWeight', 'bold');
ylabel('Physical Y Dimension (meters)', 'FontSize', 12, 'FontWeight', 'bold');
title({'Wi-Fi RSSI Spatial Heatmap - Indoor Environment (Lab B244)'; ...
       sprintf('SSID: Amrita-2.4G-B244 | Measurements: %d Locations', num_points)}, ...
       'FontSize', 13, 'FontWeight', 'bold');
legend('show', 'Location', 'northeast');

% Save 2D Heatmap
saveas(fig1, 'WiFi_RSSI_Heatmap_2D.png');
fprintf('Saved figure: WiFi_RSSI_Heatmap_2D.png\n');

%% 5. Figure 2: 3D Signal Surface Elevation Mesh
fig2 = figure('Name', 'Wi-Fi RSSI 3D Elevation Surface', 'Color', 'w', 'Position', [150, 150, 850, 600]);

surf(XGrid, YGrid, RSSIGrid, 'EdgeColor', 'none', 'FaceAlpha', 0.95);
hold on;
contour3(XGrid, YGrid, RSSIGrid, 12, 'k', 'LineWidth', 0.5);

% Plot survey scatter points in 3D
scatter3(X, Y, RSSI + 0.5, 60, 'k', 'filled', 'MarkerEdgeColor', 'w', 'LineWidth', 1.2);

% AP marker in 3D
plot3(ap_x, ap_y, max_rssi + 1.0, 'p', 'MarkerSize', 20, ...
    'MarkerFaceColor', 'r', 'MarkerEdgeColor', 'k', 'LineWidth', 1.8);

hold off;
if exist('turbo', 'builtin') || exist('turbo', 'file')
    colormap(turbo(256));
else
    colormap(jet(256));
end
cb3 = colorbar;
ylabel(cb3, 'RSSI (dBm)', 'FontSize', 11, 'FontWeight', 'bold');
caxis([min(RSSI) - 2, max(RSSI) + 2]);

xlabel('X Position (m)', 'FontSize', 11, 'FontWeight', 'bold');
ylabel('Y Position (m)', 'FontSize', 11, 'FontWeight', 'bold');
zlabel('Signal Strength (dBm)', 'FontSize', 11, 'FontWeight', 'bold');
title('3D Wi-Fi Signal Elevation Surface (Spatial Topography)', 'FontSize', 13, 'FontWeight', 'bold');
view(-35, 40);
grid on;
box on;
set(gca, 'FontSize', 11);

% Save 3D Heatmap
saveas(fig2, 'WiFi_RSSI_Heatmap_3D.png');
fprintf('Saved figure: WiFi_RSSI_Heatmap_3D.png\n');

%% 6. Coverage Zones Summary
excellent_pct = sum(RSSI >= -50) / num_points * 100;
good_pct      = sum(RSSI >= -60 & RSSI < -50) / num_points * 100;
fair_pct      = sum(RSSI >= -70 & RSSI < -60) / num_points * 100;
poor_pct      = sum(RSSI < -70) / num_points * 100;

fprintf('\n-------------------------------------------------------------\n');
fprintf('               Coverage Quality Breakdown                     \n');
fprintf('-------------------------------------------------------------\n');
fprintf(' Excellent (>= -50 dBm) : %5.1f%% (High-speed streaming/gaming)\n', excellent_pct);
fprintf(' Good (-50 to -60 dBm)  : %5.1f%% (HD video & fast browsing)\n', good_pct);
fprintf(' Fair (-60 to -70 dBm)  : %5.1f%% (Basic browsing & voice)\n', fair_pct);
fprintf(' Poor (< -70 dBm)       : %5.1f%% (Dead-zone / weak signal)\n', poor_pct);
fprintf('-------------------------------------------------------------\n');
fprintf('Spatial heatmap generation completed successfully.\n\n');
