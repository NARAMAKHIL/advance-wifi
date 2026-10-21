function results = path_loss_model(csv_path, ap_coords)
% PATH_LOSS_MODEL - Log-Distance Path Loss Model Estimation for WiFiSense 3D
%
% Syntax:
%   results = path_loss_model(csv_path, ap_coords)
%
% Inputs:
%   csv_path  - Path to WiFiSense exported CSV file
%   ap_coords - [x0, y0] Access Point transmitter coordinates in metres
%               (optional; defaults to coordinates of maximum RSSI point)
%
% Mathematical Formulation:
%   Pr(d) = P0 - 10 * n * log10(d / d0) + X_sigma
%   where:
%     d        = Euclidean distance to AP = sqrt((x-x0)^2 + (y-y0)^2)
%     d0       = Reference distance (1.0 metre)
%     P0       = Received power at reference distance d0 (dBm)
%     n        = Path loss exponent (typically 1.8-2.2 for free space,
%                2.5-4.0 for indoor office with walls/clutter)
%     X_sigma  = Zero-mean Gaussian random variable ~ N(0, sigma^2)
%                representing log-normal shadow fading.

    if nargin < 1 || isempty(csv_path)
        csv_path = '../data/synthetic_demo/measurements.csv';
        if ~isfile(csv_path)
            csv_path = 'data/synthetic_demo/measurements.csv';
        end
    end

    if ~isfile(csv_path)
        error('WiFiSense:FileNotFound', 'CSV data file not found: %s', csv_path);
    end

    fprintf('========================================================\n');
    fprintf(' WiFiSense 3D: Log-Distance Path Loss Model Estimation \n');
    fprintf('========================================================\n');
    fprintf('Loading dataset from: %s\n', csv_path);

    % Read CSV table
    T = readtable(csv_path);

    % Filter for valid measurements
    valid_mask = ~isnan(T.rssi_dbm) & strcmp(T.scan_status, 'ok');
    T_valid = T(valid_mask, :);

    if height(T_valid) < 3
        error('WiFiSense:InsufficientData', 'Need at least 3 valid RSSI measurements for path loss fitting.');
    end

    % Aggregate by unique spatial location (x, y)
    [unique_locs, ~, loc_idx] = unique([T_valid.x_m, T_valid.y_m], 'rows');
    num_locs = size(unique_locs, 1);

    mean_rssi = zeros(num_locs, 1);
    std_rssi  = zeros(num_locs, 1);
    sample_n  = zeros(num_locs, 1);

    for i = 1:num_locs
        pts = T_valid.rssi_dbm(loc_idx == i);
        mean_rssi(i) = mean(pts);
        std_rssi(i)  = std(pts);
        sample_n(i)  = length(pts);
    end

    x_loc = unique_locs(:, 1);
    y_loc = unique_locs(:, 2);

    % Determine Access Point location
    if nargin < 2 || isempty(ap_coords)
        [~, max_idx] = max(mean_rssi);
        ap_x = x_loc(max_idx);
        ap_y = y_loc(max_idx);
        fprintf('Auto-detected AP Anchor at peak RSSI node: (%.2f m, %.2f m) @ %.1f dBm\n', ...
            ap_x, ap_y, mean_rssi(max_idx));
    else
        ap_x = ap_coords(1);
        ap_y = ap_coords(2);
        fprintf('User-specified AP Anchor: (%.2f m, %.2f m)\n', ap_x, ap_y);
    end

    % Calculate Euclidean distances (clamp minimum distance to 0.5 m to avoid log(0))
    dist = max(0.5, sqrt((x_loc - ap_x).^2 + (y_loc - ap_y).^2));

    % Linear Regression on log10(d):
    % Model: RSSI = P0 - (10 * n) * log10(d)
    % Let y = RSSI, X = [1, -10 * log10(d)]
    % beta = [P0; n]
    X_reg = [ones(num_locs, 1), -10 * log10(dist)];
    y_reg = mean_rssi;

    beta = X_reg \ y_reg;
    P0 = beta(1);
    n_exp = beta(2);

    % Predictions & Residuals
    y_pred = X_reg * beta;
    residuals = y_reg - y_pred;

    % Goodness-of-Fit Metrics
    SS_tot = sum((y_reg - mean(y_reg)).^2);
    SS_res = sum(residuals.^2);
    R_squared = 1 - (SS_res / max(eps, SS_tot));
    RMSE = sqrt(mean(residuals.^2));
    sigma_shadow = std(residuals);

    fprintf('\n--- Fitted RF Propagation Model Results ---\n');
    fprintf('  Reference RSSI @ 1.0 m (P0):  %.2f dBm\n', P0);
    fprintf('  Path Loss Exponent (n):       %.2f\n', n_exp);
    fprintf('  Shadow Fading Std Dev (sigma): %.2f dB\n', sigma_shadow);
    fprintf('  Coefficient of Determination: %.4f (R^2)\n', R_squared);
    fprintf('  Root Mean Square Error:       %.2f dB\n', RMSE);
    fprintf('  Number of Survey Locations:   %d\n', num_locs);
    fprintf('  Total Valid Samples:          %d\n\n', height(T_valid));

    % Generate Academic Plot
    figure('Name', 'WiFiSense 3D: Empirical Log-Distance Path Loss Fit', ...
           'Color', [0.05, 0.07, 0.11], 'Position', [150, 150, 850, 520]);

    d_grid = linspace(0.5, max(dist) * 1.25, 200);
    rssi_fitted = P0 - 10 * n_exp * log10(d_grid);
    rssi_free_space = P0 - 10 * 2.0 * log10(d_grid);

    hold on;
    % Theoretical Free Space Reference (n=2)
    plot(d_grid, rssi_free_space, '--', 'Color', [0.5, 0.5, 0.6], 'LineWidth', 1.5, ...
        'DisplayName', 'Free Space Theory (n = 2.0)');

    % Empirical Fitted Path Loss Model Curve
    plot(d_grid, rssi_fitted, '-', 'Color', [0.06, 0.75, 0.85], 'LineWidth', 2.5, ...
        'DisplayName', sprintf('Empirical Fit (n = %.2f, P_0 = %.1f dBm)', n_exp, P0));

    % 1-sigma Shadow Fading Confidence Bound
    fill([d_grid, fliplr(d_grid)], ...
         [rssi_fitted + sigma_shadow, fliplr(rssi_fitted - sigma_shadow)], ...
         [0.06, 0.75, 0.85], 'FaceAlpha', 0.12, 'EdgeColor', 'none', ...
         'DisplayName', sprintf('\\pm 1\\sigma Shadow Fading (\\sigma = %.1f dB)', sigma_shadow));

    % Empirical Survey Points with Error Bars
    errorbar(dist, mean_rssi, std_rssi, 'o', 'Color', [0.95, 0.62, 0.05], ...
        'MarkerFaceColor', [0.95, 0.62, 0.05], 'MarkerSize', 6, 'LineWidth', 1.2, ...
        'DisplayName', 'Measured Survey Nodes (\mu \pm \sigma)');

    grid on;
    set(gca, 'Color', [0.08, 0.11, 0.18], 'XColor', [0.65, 0.72, 0.8], 'YColor', [0.65, 0.72, 0.8], ...
        'GridColor', [0.2, 0.25, 0.35], 'GridAlpha', 0.4, 'FontSize', 11);

    xlabel('Euclidean Distance to AP d (metres)', 'Color', [0.9, 0.95, 1.0], 'FontSize', 12);
    ylabel('Received Signal Strength RSSI (dBm)', 'Color', [0.9, 0.95, 1.0], 'FontSize', 12);
    title('WiFiSense 3D: Empirical Log-Distance Path Loss Model with Shadow Fading', ...
        'Color', [0.95, 0.98, 1.0], 'FontSize', 13, 'FontWeight', 'bold');

    lgd = legend('Location', 'northeast');
    set(lgd, 'TextColor', [0.9, 0.95, 1.0], 'Color', [0.12, 0.16, 0.24], 'EdgeColor', [0.3, 0.35, 0.45]);

    hold off;

    % Return structured results
    results = struct(...
        'P0', P0, ...
        'n_exponent', n_exp, ...
        'sigma_shadowing_dB', sigma_shadow, ...
        'R_squared', R_squared, ...
        'RMSE_dB', RMSE, ...
        'ap_coords', [ap_x, ap_y], ...
        'num_locations', num_locs, ...
        'total_samples', height(T_valid));
end
