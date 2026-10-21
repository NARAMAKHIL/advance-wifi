% Wi-Fi RSSI Indoor Trilateration & Multilateration Localization
% File: indoor_localization.m
% Description: Uses multi-AP RSSI ranging and Linear/Non-linear Least Squares
% to estimate 2D position fixes inside an indoor facility.

clc;
clear;
close all;

fprintf('=================================================================\n');
fprintf('     Wi-Fi RSSI Indoor Multilateration & Position Estimation     \n');
fprintf('=================================================================\n\n');

%% 1. System Parameters & Anchor Access Points
% Known Access Point (AP) physical coordinates in the facility
AP_coords = [
    1.0, 1.0;   % AP 1: West Wall (Amrita-2.4G-B244)
    7.0, 1.0;   % AP 2: North Wall (Amrita-5G-B244)
    1.0, 7.0;   % AP 3: South Wall (Amrita-Staff-B244)
    7.0, 7.0    % AP 4: East Wall (Amrita-Lab-B244)
];
M = size(AP_coords, 1);

% Path loss propagation parameters (from path_loss_prediction.m)
P0 = -40.0;     % Reference power at 1 meter (dBm)
n  = 2.75;      % Path loss exponent in obstructed lab
d0 = 1.0;       % Reference distance (m)

%% 2. True Target Position & Simulated RSSI Reception
true_pos = [4.2, 3.6]; % True unknown receiver position (m)

% True geometric distances
true_dist = sqrt(sum((AP_coords - true_pos).^2, 2));

% Add log-normal shadow noise (sigma = 1.5 dB)
rng(42); % Fixed seed for reproducible presentation results
shadow_noise = randn(M, 1) * 1.5;
measured_rssi = P0 - 10 * n * log10(true_dist / d0) + shadow_noise;

% Estimated distances from received RSSI
est_dist = d0 * 10.^((P0 - measured_rssi) / (10 * n));

fprintf('Access Point Beacons & Ranging Measurements:\n');
fprintf('-------------------------------------------------------------\n');
fprintf(' Anchor | (X, Y) Pos (m) | Measured RSSI | Est. Dist | True Dist\n');
fprintf('-------------------------------------------------------------\n');
for j = 1:M
    fprintf('  AP %d  | (%4.1f, %4.1f)   |   %6.2f dBm  |  %5.2f m  |  %5.2f m\n', ...
        j, AP_coords(j, 1), AP_coords(j, 2), measured_rssi(j), est_dist(j), true_dist(j));
end
fprintf('-------------------------------------------------------------\n\n');

%% 3. Linear Least Squares (LLS) Solver
% Anchor M is used as reference
xM = AP_coords(M, 1);
yM = AP_coords(M, 2);
dM = est_dist(M);

A_mat = zeros(M - 1, 2);
b_vec = zeros(M - 1, 1);

for j = 1:(M - 1)
    xj = AP_coords(j, 1);
    yj = AP_coords(j, 2);
    dj = est_dist(j);
    
    A_mat(j, :) = [2 * (xj - xM), 2 * (yj - yM)];
    b_vec(j)    = (dj^2 - dM^2) - (xj^2 + yj^2) + (xM^2 + yM^2);
end

% Normal equation solution: p_lls = (A' * A) \ (A' * b)
pos_lls = (A_mat \ b_vec)';

%% 4. Non-Linear Least Squares (NLS) Refinement
% Objective: minimize sum of squared distance errors
obj_fun = @(p) sum((sqrt(sum((AP_coords - p).^2, 2)) - est_dist).^2);

options = optimset('Display', 'off', 'TolX', 1e-4, 'TolFun', 1e-4);
pos_nls = fminsearch(obj_fun, pos_lls, options);

% Localization Errors
err_lls = norm(pos_lls - true_pos);
err_nls = norm(pos_nls - true_pos);

fprintf('Localization Results:\n');
fprintf('-------------------------------------------------------------\n');
fprintf(' True Receiver Position   : (%.2f, %.2f) m\n', true_pos(1), true_pos(2));
fprintf(' LLS Estimated Position   : (%.2f, %.2f) m  | Error: %.2f m\n', ...
    pos_lls(1), pos_lls(2), err_lls);
fprintf(' NLS Refined Position     : (%.2f, %.2f) m  | Error: %.2f m\n', ...
    pos_nls(1), pos_nls(2), err_nls);
fprintf('-------------------------------------------------------------\n\n');

%% 5. Visualization Plot
fig = figure('Name', 'Wi-Fi Trilateration Localization', 'Color', 'w', 'Position', [100, 100, 800, 650]);
hold on;

% Draw Ranging Circles from AP anchors
theta = linspace(0, 2*pi, 150);
for j = 1:M
    cx = AP_coords(j, 1) + est_dist(j) * cos(theta);
    cy = AP_coords(j, 2) + est_dist(j) * sin(theta);
    plot(cx, cy, ':', 'Color', [0.4, 0.6, 0.8], 'LineWidth', 1.2);
end

% Plot AP Anchors
plot(AP_coords(:, 1), AP_coords(:, 2), '^', 'MarkerSize', 14, ...
    'MarkerFaceColor', [0.85, 0.20, 0.20], 'MarkerEdgeColor', 'k', ...
    'LineWidth', 1.5, 'DisplayName', 'Wi-Fi AP Anchors');

% Label APs
for j = 1:M
    text(AP_coords(j, 1) + 0.2, AP_coords(j, 2) + 0.2, sprintf('AP %d', j), ...
        'FontSize', 11, 'FontWeight', 'bold', 'Color', [0.7, 0.1, 0.1]);
end

% Plot True Position
plot(true_pos(1), true_pos(2), 's', 'MarkerSize', 14, ...
    'MarkerFaceColor', [0.15, 0.70, 0.30], 'MarkerEdgeColor', 'k', ...
    'LineWidth', 1.5, 'DisplayName', sprintf('True Location (%.1f, %.1f)', true_pos(1), true_pos(2)));

% Plot NLS Estimated Position
plot(pos_nls(1), pos_nls(2), 'p', 'MarkerSize', 16, ...
    'MarkerFaceColor', [0.95, 0.60, 0.10], 'MarkerEdgeColor', 'k', ...
    'LineWidth', 1.5, 'DisplayName', sprintf('Estimated Fix (%.1f, %.1f)', pos_nls(1), pos_nls(2)));

% Error Vector
line([true_pos(1), pos_nls(1)], [true_pos(2), pos_nls(2)], ...
    'Color', 'r', 'LineWidth', 2.0, 'LineStyle', '--', ...
    'DisplayName', sprintf('Localization Error (%.2f m)', err_nls));

hold off;
axis equal;
grid on;
box on;
xlim([-0.5, 8.5]);
ylim([-0.5, 8.5]);
xlabel('Facility X Dimension (meters)', 'FontSize', 12, 'FontWeight', 'bold');
ylabel('Facility Y Dimension (meters)', 'FontSize', 12, 'FontWeight', 'bold');
title(sprintf('Indoor RSSI Trilateration Solver (NLS Error = %.2f m)', err_nls), ...
    'FontSize', 13, 'FontWeight', 'bold');
legend('show', 'Location', 'northeast');
set(gca, 'FontSize', 11);

saveas(fig, 'WiFi_Trilateration_Localization.png');
fprintf('Saved figure: WiFi_Trilateration_Localization.png\n');
fprintf('Multilateration localization analysis completed.\n\n');
