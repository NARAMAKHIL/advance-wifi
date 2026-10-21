function results = indoor_localization_trilateration(true_pos, noise_sigma_dB)
% INDOOR_LOCALIZATION_TRILATERATION - RSSI-Based Indoor Trilateration Solver
%
% Implements Linear Least Squares (LLS) and Non-linear Least Squares (NLS)
% indoor position estimation using calibrated path loss parameters.
%
% Syntax:
%   results = indoor_localization_trilateration(true_pos, noise_sigma_dB)
%
% Inputs:
%   true_pos       - [x_true, y_true] Ground truth coordinate in metres (default: [4.2, 5.8])
%   noise_sigma_dB - Shadow fading noise standard deviation in dB (default: 2.0 dB)

    if nargin < 1 || isempty(true_pos)
        true_pos = [4.2, 5.8];
    end
    if nargin < 2 || isempty(noise_sigma_dB)
        noise_sigma_dB = 2.0;
    end

    fprintf('========================================================\n');
    fprintf(' WiFiSense 3D: RSSI Indoor Localization & Trilateration \n');
    fprintf('========================================================\n');
    fprintf('True Target Position: (%.2f m, %.2f m)\n', true_pos(1), true_pos(2));
    fprintf('Simulated Channel Shadowing Noise: %.1f dB\n', noise_sigma_dB);

    % Configure Access Point anchors around a 10m x 10m room
    % AP anchors at 4 corners
    AP_coords = [
        1.0, 1.0;   % AP 1: Bottom-Left
        9.0, 1.0;   % AP 2: Bottom-Right
        9.0, 9.0;   % AP 3: Top-Right
        1.0, 9.0;   % AP 4: Top-Left
    ];
    M = size(AP_coords, 1);

    % Path loss parameters (P0 @ 1m, path loss exponent n)
    P0 = -40.0;     % dBm
    n_exp = 2.6;    % typical indoor

    % Calculate true Euclidean distances to each AP
    d_true = sqrt(sum((AP_coords - true_pos).^2, 2));

    % Generate synthetic noisy RSSI measurements
    % RSSI_j = P0 - 10 * n * log10(d_j) + N(0, noise_sigma^2)
    noise = randn(M, 1) * noise_sigma_dB;
    rssi_measured = P0 - 10 * n_exp * log10(d_true) + noise;

    % Invert log-distance model to obtain estimated ranges
    % d_hat = 10^((P0 - RSSI) / (10 * n))
    d_est = 10 .^ ((P0 - rssi_measured) / (10 * n_exp));

    fprintf('\nBeacon Signal Telemetry:\n');
    for j = 1:M
        fprintf('  AP %d @ (%.1f, %.1f): True d = %.2f m | RSSI = %.1f dBm | Est d = %.2f m\n', ...
            j, AP_coords(j, 1), AP_coords(j, 2), d_true(j), rssi_measured(j), d_est(j));
    end

    % --- Method 1: Linear Least Squares (LLS) with Reference Subtraction ---
    % Use last AP (M) as reference:
    % 2*(x_j - x_M)*x + 2*(y_j - y_M)*y = d_est(M)^2 - d_est(j)^2 + (x_j^2 + y_j^2) - (x_M^2 + y_M^2)
    A_lls = zeros(M - 1, 2);
    b_lls = zeros(M - 1, 1);
    ref_x = AP_coords(M, 1);
    ref_y = AP_coords(M, 2);
    ref_d2 = d_est(M)^2;
    ref_r2 = ref_x^2 + ref_y^2;

    for j = 1:(M - 1)
        xj = AP_coords(j, 1);
        yj = AP_coords(j, 2);
        A_lls(j, :) = [2 * (xj - ref_x), 2 * (yj - ref_y)];
        b_lls(j) = ref_d2 - d_est(j)^2 + (xj^2 + yj^2) - ref_r2;
    end

    pos_lls = (A_lls \ b_lls)';
    err_lls = norm(pos_lls - true_pos);

    % --- Method 2: Non-Linear Least Squares (NLS) Optimization ---
    cost_fun = @(p) sum((sqrt((AP_coords(:, 1) - p(1)).^2 + (AP_coords(:, 2) - p(2)).^2) - d_est).^2);
    initial_guess = mean(AP_coords, 1);

    if exist('fminsearch', 'file')
        opt = optimset('Display', 'off');
        pos_nls = fminsearch(cost_fun, initial_guess, opt);
    else
        pos_nls = pos_lls;
    end
    err_nls = norm(pos_nls - true_pos);

    fprintf('\n--- Localization Benchmark Results ---\n');
    fprintf('  Linear Least Squares (LLS):       Est: (%.2f, %.2f) m | Error: %.2f m\n', ...
        pos_lls(1), pos_lls(2), err_lls);
    fprintf('  Non-linear Least Squares (NLS):   Est: (%.2f, %.2f) m | Error: %.2f m\n\n', ...
        pos_nls(1), pos_nls(2), err_nls);

    % Generate Visualization Plot
    figure('Name', 'WiFiSense 3D: RSSI Indoor Trilateration', ...
           'Color', [0.05, 0.07, 0.11], 'Position', [150, 150, 750, 650]);

    hold on;
    % Plot AP ranging circles
    theta = linspace(0, 2*pi, 100);
    colors = [0.06, 0.75, 0.85; 0.55, 0.36, 0.96; 0.08, 0.72, 0.51; 0.96, 0.62, 0.04];

    for j = 1:M
        cx = AP_coords(j, 1) + d_est(j) * cos(theta);
        cy = AP_coords(j, 2) + d_est(j) * sin(theta);
        plot(cx, cy, '--', 'Color', [colors(j, :), 0.5], 'LineWidth', 1.2, ...
            'DisplayName', sprintf('AP %d Range Circle (\\approx %.1fm)', j, d_est(j)));

        % AP Anchor node marker
        plot(AP_coords(j, 1), AP_coords(j, 2), 's', 'MarkerSize', 10, ...
            'MarkerFaceColor', colors(j, :), 'MarkerEdgeColor', 'w', ...
            'HandleVisibility', 'off');
        text(AP_coords(j, 1) + 0.3, AP_coords(j, 2) + 0.3, sprintf('AP %d', j), ...
            'Color', colors(j, :), 'FontWeight', 'bold', 'FontSize', 10);
    end

    % Ground Truth position marker
    plot(true_pos(1), true_pos(2), 'kp', 'MarkerSize', 16, ...
        'MarkerFaceColor', [0.1, 0.8, 0.4], 'LineWidth', 1.5, ...
        'DisplayName', sprintf('Ground Truth (%.1f, %.1f) m', true_pos(1), true_pos(2)));

    % LLS position estimate
    plot(pos_lls(1), pos_lls(2), 'o', 'MarkerSize', 10, ...
        'MarkerFaceColor', [0.95, 0.25, 0.37], 'MarkerEdgeColor', 'w', ...
        'DisplayName', sprintf('LLS Estimate (Err: %.2f m)', err_lls));

    % NLS position estimate
    plot(pos_nls(1), pos_nls(2), 'd', 'MarkerSize', 11, ...
        'MarkerFaceColor', [0.06, 0.75, 0.85], 'MarkerEdgeColor', 'w', ...
        'DisplayName', sprintf('NLS Estimate (Err: %.2f m)', err_nls));

    grid on;
    axis([0, 10, 0, 10]);
    axis square;
    set(gca, 'Color', [0.08, 0.11, 0.18], 'XColor', [0.7, 0.7, 0.7], 'YColor', [0.7, 0.7, 0.7], ...
        'GridColor', [0.2, 0.25, 0.35], 'GridAlpha', 0.5, 'FontSize', 11);

    xlabel('X Coordinate (metres)', 'Color', 'w');
    ylabel('Y Coordinate (metres)', 'Color', 'w');
    title('WiFiSense 3D: RSSI Multilateration & Position Estimation Fix', ...
        'Color', 'w', 'FontSize', 13, 'FontWeight', 'bold');

    lgd = legend('Location', 'northeastoutside');
    set(lgd, 'TextColor', 'w', 'Color', [0.12, 0.16, 0.24], 'EdgeColor', [0.3, 0.35, 0.45]);

    hold off;

    results = struct(...
        'true_pos', true_pos, ...
        'pos_lls', pos_lls, ...
        'err_lls_m', err_lls, ...
        'pos_nls', pos_nls, ...
        'err_nls_m', err_nls, ...
        'd_true', d_true, ...
        'd_est', d_est, ...
        'rssi_measured', rssi_measured);
end
