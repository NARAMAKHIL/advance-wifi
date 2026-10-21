function results = spatial_interpolation_comparison(csv_path)
% SPATIAL_INTERPOLATION_COMPARISON - Benchmark 2D/3D Spatial Interpolators
%
% Compares Linear Delaunay, Natural Neighbor, Cubic Spline, and RBF (Multiquadric)
% across the surveyed Wi-Fi coverage field using Leave-One-Out Cross-Validation (LOOCV).
%
% Syntax:
%   results = spatial_interpolation_comparison(csv_path)

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
    fprintf(' WiFiSense 3D: Spatial Interpolation Comparison & LOOCV \n');
    fprintf('========================================================\n');

    T = readtable(csv_path);
    valid_mask = ~isnan(T.rssi_dbm) & strcmp(T.scan_status, 'ok');
    T_valid = T(valid_mask, :);

    [unique_locs, ~, loc_idx] = unique([T_valid.x_m, T_valid.y_m], 'rows');
    N = size(unique_locs, 1);

    if N < 4
        error('WiFiSense:InsufficientPoints', 'Need >= 4 unique spatial survey coordinates for cross-validation.');
    end

    mean_rssi = zeros(N, 1);
    for i = 1:N
        mean_rssi(i) = mean(T_valid.rssi_dbm(loc_idx == i));
    end

    x = unique_locs(:, 1);
    y = unique_locs(:, 2);
    z = mean_rssi;

    % Define fine room grid
    x_room = max(10, max(x) * 1.1);
    y_room = max(10, max(y) * 1.1);
    [X_grid, Y_grid] = meshgrid(linspace(0, x_room, 60), linspace(0, y_room, 60));

    % 1. Linear Delaunay
    Z_linear = griddata(x, y, z, X_grid, Y_grid, 'linear');

    % 2. Natural Neighbor
    Z_natural = griddata(x, y, z, X_grid, Y_grid, 'natural');

    % 3. Cubic Spline
    Z_cubic = griddata(x, y, z, X_grid, Y_grid, 'cubic');

    % 4. Radial Basis Function (Multiquadric: phi(r) = sqrt(r^2 + c^2))
    c_param = 1.5;
    dist_mat = pdist2([x, y], [x, y]);
    Phi = sqrt(dist_mat.^2 + c_param^2);
    w_rbf = Phi \ z;

    grid_pts = [X_grid(:), Y_grid(:)];
    Phi_eval = sqrt(pdist2(grid_pts, [x, y]).^2 + c_param^2);
    Z_rbf = reshape(Phi_eval * w_rbf, size(X_grid));

    % --- Leave-One-Out Cross-Validation (LOOCV) ---
    methods = {'linear', 'natural', 'cubic', 'rbf'};
    errors = struct('linear', [], 'natural', [], 'cubic', [], 'rbf', []);

    fprintf('\nExecuting Leave-One-Out Cross-Validation (N = %d)...\n', N);

    for i = 1:N
        % Train set (N-1 points)
        train_x = x([1:i-1, i+1:N]);
        train_y = y([1:i-1, i+1:N]);
        train_z = z([1:i-1, i+1:N]);

        test_x = x(i);
        test_y = y(i);
        actual = z(i);

        % Linear
        p_lin = griddata(train_x, train_y, train_z, test_x, test_y, 'linear');
        if ~isnan(p_lin), errors.linear(end+1) = p_lin - actual; end

        % Natural
        p_nat = griddata(train_x, train_y, train_z, test_x, test_y, 'natural');
        if ~isnan(p_nat), errors.natural(end+1) = p_nat - actual; end

        % Cubic
        p_cub = griddata(train_x, train_y, train_z, test_x, test_y, 'cubic');
        if ~isnan(p_cub), errors.cubic(end+1) = p_cub - actual; end

        % RBF
        D_train = pdist2([train_x, train_y], [train_x, train_y]);
        Phi_tr = sqrt(D_train.^2 + c_param^2);
        w_tr = Phi_tr \ train_z;
        p_rbf = sqrt(pdist2([test_x, test_y], [train_x, train_y]).^2 + c_param^2) * w_tr;
        errors.rbf(end+1) = p_rbf - actual;
    end

    % Summary Performance Table
    fprintf('\n========================================================\n');
    fprintf('  Method          | MAE (dB) | RMSE (dB) | Max Err (dB) \n');
    fprintf('--------------------------------------------------------\n');

    metrics = struct();
    for m = 1:length(methods)
        name = methods{m};
        e = errors.(name);
        if ~isempty(e)
            mae = mean(abs(e));
            rmse = sqrt(mean(e.^2));
            max_e = max(abs(e));
            fprintf('  %-15s |   %5.2f  |   %6.2f  |   %7.2f    \n', name, mae, rmse, max_e);
            metrics.(name) = struct('MAE', mae, 'RMSE', rmse, 'MaxErr', max_e, 'N', length(e));
        end
    end
    fprintf('========================================================\n');

    % Multi-panel Visualization
    figure('Name', 'WiFiSense 3D: Interpolation Method Benchmark', ...
           'Color', [0.05, 0.07, 0.11], 'Position', [100, 100, 1100, 750]);

    colormap(turbo);

    % Subplot 1: Linear
    subplot(2, 2, 1);
    contourf(X_grid, Y_grid, Z_linear, 20, 'LineColor', 'none');
    hold on; plot(x, y, 'w.', 'MarkerSize', 12); hold off;
    title(sprintf('Linear Delaunay (RMSE: %.2f dB)', metrics.linear.RMSE), 'Color', 'w');
    xlabel('X (m)', 'Color', 'w'); ylabel('Y (m)', 'Color', 'w');
    set(gca, 'Color', [0.08, 0.11, 0.18], 'XColor', [0.7, 0.7, 0.7], 'YColor', [0.7, 0.7, 0.7]);
    colorbar('Color', 'w');

    % Subplot 2: Natural Neighbor
    subplot(2, 2, 2);
    contourf(X_grid, Y_grid, Z_natural, 20, 'LineColor', 'none');
    hold on; plot(x, y, 'w.', 'MarkerSize', 12); hold off;
    title(sprintf('Natural Neighbor (RMSE: %.2f dB)', metrics.natural.RMSE), 'Color', 'w');
    xlabel('X (m)', 'Color', 'w'); ylabel('Y (m)', 'Color', 'w');
    set(gca, 'Color', [0.08, 0.11, 0.18], 'XColor', [0.7, 0.7, 0.7], 'YColor', [0.7, 0.7, 0.7]);
    colorbar('Color', 'w');

    % Subplot 3: Cubic Spline
    subplot(2, 2, 3);
    contourf(X_grid, Y_grid, Z_cubic, 20, 'LineColor', 'none');
    hold on; plot(x, y, 'w.', 'MarkerSize', 12); hold off;
    title(sprintf('Cubic Spline (RMSE: %.2f dB)', metrics.cubic.RMSE), 'Color', 'w');
    xlabel('X (m)', 'Color', 'w'); ylabel('Y (m)', 'Color', 'w');
    set(gca, 'Color', [0.08, 0.11, 0.18], 'XColor', [0.7, 0.7, 0.7], 'YColor', [0.7, 0.7, 0.7]);
    colorbar('Color', 'w');

    % Subplot 4: RBF Multiquadric
    subplot(2, 2, 4);
    contourf(X_grid, Y_grid, Z_rbf, 20, 'LineColor', 'none');
    hold on; plot(x, y, 'w.', 'MarkerSize', 12); hold off;
    title(sprintf('RBF Multiquadric (RMSE: %.2f dB)', metrics.rbf.RMSE), 'Color', 'w');
    xlabel('X (m)', 'Color', 'w'); ylabel('Y (m)', 'Color', 'w');
    set(gca, 'Color', [0.08, 0.11, 0.18], 'XColor', [0.7, 0.7, 0.7], 'YColor', [0.7, 0.7, 0.7]);
    colorbar('Color', 'w');

    results = struct('metrics', metrics, 'errors', errors);
end
