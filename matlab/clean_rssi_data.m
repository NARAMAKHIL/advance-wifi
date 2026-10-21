function rssi_numeric = clean_rssi_data(rssi_raw)
% CLEAN_RSSI_DATA - Robustly converts RSSI vector to numeric values.
%
% Handles:
%   - Numeric doubles or integers
%   - Strings or character cell arrays with ' dBm' / 'dBm' suffixes
%   - NaN, empty cells, and placeholder values (-999)
%
% Usage:
%   rssi_clean = clean_rssi_data(data.RSSI_dBm);

    if isempty(rssi_raw)
        rssi_numeric = [];
        return;
    end

    if isnumeric(rssi_raw)
        rssi_numeric = double(rssi_raw);
    elseif iscell(rssi_raw) || isstring(rssi_raw)
        % Convert to string array
        str_vals = string(rssi_raw);
        % Remove 'dBm', 'dbm', 'DBM', whitespace
        str_vals = regexprep(str_vals, '(?i)\s*dbm', '');
        str_vals = strtrim(str_vals);
        % Convert to double
        rssi_numeric = str2double(str_vals);
    else
        error('Unsupported data type for RSSI column: %s', class(rssi_raw));
    end

    % Replace -999 placeholders or invalid numbers with NaN
    rssi_numeric(rssi_numeric == -999) = NaN;
    rssi_numeric(isinf(rssi_numeric)) = NaN;
end
