"""
WiFiSense 3D - Analytics Service
==================================
Statistical analysis, spatial interpolation, and survey recommendations.
All computations use actual collected measurements — never fabricated data.
"""
from __future__ import annotations

from typing import Optional

import numpy as np
from scipy.interpolate import LinearNDInterpolator, NearestNDInterpolator

from app.models import (
    AnalyticsSummary,
    HeatmapData,
    LocationSummary,
    RSSIMeasurement,
    SurveyRecommendation,
)


class AnalyticsService:
    """Computes analytics from collected RSSI measurements."""

    @staticmethod
    def compute_location_summaries(
        measurements: list[RSSIMeasurement],
    ) -> list[LocationSummary]:
        """
        Aggregate measurements by physical location (x, y, z).
        Computes mean, std, min, max, range, count, and stability score.
        """
        if not measurements:
            return []

        # Group by location
        location_groups: dict[tuple[float, float, float], list[float]] = {}
        location_sessions: dict[tuple[float, float, float], str] = {}

        for m in measurements:
            if m.rssi_dbm is None:
                continue
            key = (m.x_m, m.y_m, m.z_m)
            if key not in location_groups:
                location_groups[key] = []
                location_sessions[key] = m.session_id
            location_groups[key].append(m.rssi_dbm)

        summaries = []
        for (x, y, z), rssi_values in location_groups.items():
            arr = np.array(rssi_values)
            n = len(arr)
            mean_v = float(np.mean(arr))
            std_v = float(np.std(arr, ddof=1)) if n > 1 else None
            min_v = float(np.min(arr))
            max_v = float(np.max(arr))
            range_v = max_v - min_v

            # Stability score: 100 = perfectly stable, lower = more variable
            # Formula: max(0, 100 - (std * 5)) where std is sample std deviation
            # This is a heuristic indicator, not a calibrated metric.
            stability = None
            if std_v is not None:
                stability = round(max(0.0, 100.0 - (std_v * 5.0)), 1)

            summaries.append(LocationSummary(
                x_m=x,
                y_m=y,
                z_m=z,
                mean_rssi=round(mean_v, 2),
                std_rssi=round(std_v, 2) if std_v is not None else None,
                min_rssi=round(min_v, 2),
                max_rssi=round(max_v, 2),
                range_rssi=round(range_v, 2),
                sample_count=n,
                valid_count=n,
                stability_score=stability,
                session_id=location_sessions.get((x, y, z), ""),
            ))

        return summaries

    @staticmethod
    def compute_summary(measurements: list[RSSIMeasurement]) -> AnalyticsSummary:
        """Compute overall analytics summary from measurements."""
        if not measurements:
            return AnalyticsSummary()

        valid = [m for m in measurements if m.rssi_dbm is not None]
        rssi_values = [m.rssi_dbm for m in valid if m.rssi_dbm is not None]
        sessions = set(m.session_id for m in measurements)
        locations = set((m.x_m, m.y_m, m.z_m) for m in valid)

        # Determine collection source label
        sources = set(m.collection_source.value for m in measurements)
        if len(sources) == 1:
            source_label = list(sources)[0]
        else:
            source_label = "mixed"

        summary = AnalyticsSummary(
            total_samples=len(measurements),
            valid_samples=len(valid),
            total_locations=len(locations),
            sessions=len(sessions),
            valid_ratio=round(len(valid) / len(measurements), 3) if measurements else None,
            collection_source=source_label,
        )

        if rssi_values:
            arr = np.array(rssi_values)
            summary.overall_mean_rssi = round(float(np.mean(arr)), 2)
            summary.overall_std_rssi = round(float(np.std(arr, ddof=1)), 2) if len(arr) > 1 else None
            summary.overall_min_rssi = round(float(np.min(arr)), 2)
            summary.overall_max_rssi = round(float(np.max(arr)), 2)

        # Last measurement time
        timestamps = [m.timestamp_iso for m in measurements if m.timestamp_iso]
        if timestamps:
            summary.last_measurement_at = max(timestamps)

        return summary

    @staticmethod
    def generate_heatmap(
        summaries: list[LocationSummary],
        room_width: float = 10.0,
        room_length: float = 10.0,
        grid_resolution: int = 30,
        method: str = "linear",
    ) -> HeatmapData:
        """
        Generate interpolated 2D heatmap data from location summaries.

        Requires at least 3 non-collinear measurement locations for 'linear' interpolation.
        Falls back to 'nearest' if linear interpolation fails.
        """
        warnings: list[str] = []

        if not summaries:
            return HeatmapData(
                room_width_m=room_width,
                room_length_m=room_length,
                has_sufficient_data=False,
                warnings=["No measurement data available."],
            )

        # Extract measured points
        points = np.array([[s.x_m, s.y_m] for s in summaries])
        values = np.array([s.mean_rssi for s in summaries])

        n_points = len(points)

        if n_points < 3:
            warnings.append(
                f"Only {n_points} unique location(s). Need at least 3 non-collinear "
                "locations for spatial interpolation. Showing measured points only."
            )
            return HeatmapData(
                locations=summaries,
                room_width_m=room_width,
                room_length_m=room_length,
                measured_count=n_points,
                has_sufficient_data=False,
                warnings=warnings,
            )

        # Check for collinearity
        if _are_collinear(points):
            warnings.append(
                "All measurement locations are collinear (in a straight line). "
                "2D interpolation requires points that span an area. "
                "Showing measured points only."
            )
            return HeatmapData(
                locations=summaries,
                room_width_m=room_width,
                room_length_m=room_length,
                measured_count=n_points,
                has_sufficient_data=False,
                warnings=warnings,
            )

        # Generate grid
        x_grid = np.linspace(0, room_width, grid_resolution)
        y_grid = np.linspace(0, room_length, grid_resolution)
        xx, yy = np.meshgrid(x_grid, y_grid)

        # Interpolate
        actual_method = method
        try:
            if method == "linear":
                interpolator = LinearNDInterpolator(points, values)
                zz = interpolator(xx, yy)
                # Fill NaN (outside convex hull) with nearest neighbor
                mask = np.isnan(zz)
                if np.any(mask):
                    nn = NearestNDInterpolator(points, values)
                    zz_nn = nn(xx, yy)
                    # Only fill nearby points, not the whole room
                    # Mark far-from-data points as NaN
                    from scipy.spatial import cKDTree
                    tree = cKDTree(points)
                    grid_points = np.column_stack([xx.ravel(), yy.ravel()])
                    distances, _ = tree.query(grid_points)
                    max_dist = np.max(distances[~mask.ravel()]) * 1.5 if np.any(~mask.ravel()) else 2.0
                    far_mask = distances.reshape(xx.shape) > max_dist
                    zz[mask & ~far_mask] = zz_nn[mask & ~far_mask]
                    zz[far_mask] = np.nan
                    warnings.append(
                        "Regions far from measured points are masked (shown as empty). "
                        "Collect more measurements to fill these areas."
                    )

            elif method == "nearest":
                interpolator = NearestNDInterpolator(points, values)
                zz = interpolator(xx, yy)
            else:
                warnings.append(f"Unknown method '{method}', using 'linear'.")
                actual_method = "linear"
                interpolator = LinearNDInterpolator(points, values)
                zz = interpolator(xx, yy)

        except Exception as e:
            warnings.append(f"Interpolation failed: {e}. Falling back to nearest-neighbor.")
            actual_method = "nearest"
            try:
                interpolator = NearestNDInterpolator(points, values)
                zz = interpolator(xx, yy)
            except Exception as e2:
                warnings.append(f"Nearest-neighbor also failed: {e2}")
                return HeatmapData(
                    locations=summaries,
                    room_width_m=room_width,
                    room_length_m=room_length,
                    measured_count=n_points,
                    has_sufficient_data=False,
                    warnings=warnings,
                )

        # Convert to lists, replacing NaN with None
        grid_rssi = []
        for row in zz:
            grid_rssi.append([
                round(float(v), 2) if not np.isnan(v) else None
                for v in row
            ])

        return HeatmapData(
            locations=summaries,
            grid_x=xx.tolist(),
            grid_y=yy.tolist(),
            grid_rssi=grid_rssi,
            interpolation_method=actual_method,
            room_width_m=room_width,
            room_length_m=room_length,
            measured_count=n_points,
            has_sufficient_data=True,
            warnings=warnings,
        )

    @staticmethod
    def recommend_survey_points(
        summaries: list[LocationSummary],
        room_width: float = 10.0,
        room_length: float = 10.0,
        grid_spacing: float = 1.0,
        max_recommendations: int = 5,
    ) -> list[SurveyRecommendation]:
        """
        Recommend next measurement locations using rule-based heuristics.

        Strategy:
        1. Generate a candidate grid over the room.
        2. Rank candidates by distance from existing measurements (larger gap = higher priority).
        3. Bonus priority for regions near high-variability measurements.

        This is a transparent heuristic, not a machine learning algorithm.
        """
        if not summaries:
            # No data at all — recommend center and corners
            cx, cy = room_width / 2, room_length / 2
            return [
                SurveyRecommendation(x_m=cx, y_m=cy, reason="Room center (start here)", priority=10.0),
                SurveyRecommendation(x_m=0.5, y_m=0.5, reason="Near corner", priority=8.0),
                SurveyRecommendation(x_m=room_width - 0.5, y_m=0.5, reason="Near corner", priority=8.0),
                SurveyRecommendation(x_m=0.5, y_m=room_length - 0.5, reason="Near corner", priority=8.0),
                SurveyRecommendation(x_m=room_width - 0.5, y_m=room_length - 0.5, reason="Near corner", priority=8.0),
            ][:max_recommendations]

        measured_points = np.array([[s.x_m, s.y_m] for s in summaries])
        std_values = np.array([s.std_rssi if s.std_rssi is not None else 0.0 for s in summaries])

        # Generate candidate grid
        x_candidates = np.arange(grid_spacing / 2, room_width, grid_spacing)
        y_candidates = np.arange(grid_spacing / 2, room_length, grid_spacing)
        candidates = np.array([(x, y) for x in x_candidates for y in y_candidates])

        if len(candidates) == 0:
            return []

        # Compute distance from each candidate to nearest measured point
        from scipy.spatial import cKDTree
        tree = cKDTree(measured_points)
        distances, indices = tree.query(candidates)

        # Priority = distance + variability bonus from nearest measured point
        variability_bonus = std_values[indices] * 0.1  # scale factor
        priorities = distances + variability_bonus

        # Sort by priority (highest first)
        order = np.argsort(-priorities)

        recommendations = []
        for i in order[:max_recommendations]:
            x, y = candidates[i]
            dist = distances[i]
            nearest_idx = indices[i]
            nearest_std = std_values[nearest_idx]

            reason_parts = [f"Gap of {dist:.1f}m from nearest measurement"]
            if nearest_std > 2.0:
                reason_parts.append(f"nearby point has high variability (σ={nearest_std:.1f} dB)")

            recommendations.append(SurveyRecommendation(
                x_m=round(float(x), 2),
                y_m=round(float(y), 2),
                reason="; ".join(reason_parts),
                priority=round(float(priorities[i]), 2),
            ))

        return recommendations

    @staticmethod
    def evaluate_interpolation_loocv(
        summaries: list[LocationSummary],
        room_width: float = 10.0,
        room_length: float = 10.0,
    ) -> Optional[dict]:
        """
        Leave-one-out cross-validation for interpolation quality.
        Only meaningful with >= 4 non-collinear points.

        Returns dict with MAE, RMSE, per-point errors, or None if insufficient data.
        """
        if len(summaries) < 4:
            return None

        points = np.array([[s.x_m, s.y_m] for s in summaries])
        values = np.array([s.mean_rssi for s in summaries])

        if _are_collinear(points):
            return None

        errors = []
        per_point = []

        for i in range(len(summaries)):
            # Leave out point i
            train_pts = np.delete(points, i, axis=0)
            train_vals = np.delete(values, i)
            test_pt = points[i:i+1]
            test_val = values[i]

            if _are_collinear(train_pts):
                continue

            try:
                interp = LinearNDInterpolator(train_pts, train_vals)
                pred = interp(test_pt[0, 0], test_pt[0, 1])
                if np.isnan(pred):
                    # Point outside convex hull of remaining points
                    continue
                err = float(pred - test_val)
                errors.append(abs(err))
                per_point.append({
                    "x_m": summaries[i].x_m,
                    "y_m": summaries[i].y_m,
                    "actual": round(test_val, 2),
                    "predicted": round(float(pred), 2),
                    "error": round(err, 2),
                    "abs_error": round(abs(err), 2),
                })
            except Exception:
                continue

        if not errors:
            return None

        return {
            "method": "linear_LOOCV",
            "n_evaluated": len(errors),
            "n_total": len(summaries),
            "mae_db": round(float(np.mean(errors)), 2),
            "rmse_db": round(float(np.sqrt(np.mean(np.array(errors) ** 2))), 2),
            "max_error_db": round(float(np.max(errors)), 2),
            "per_point": per_point,
            "note": "Leave-one-out cross-validation of linear interpolation. "
                    "Each point was predicted from remaining points.",
        }


def _are_collinear(points: np.ndarray, tol: float = 1e-10) -> bool:
    """Check if 2D points are all collinear."""
    if len(points) < 3:
        return True
    p0 = points[0]
    for i in range(1, len(points)):
        for j in range(i + 1, len(points)):
            cross = (points[i][0] - p0[0]) * (points[j][1] - p0[1]) - \
                    (points[i][1] - p0[1]) * (points[j][0] - p0[0])
            if abs(cross) > tol:
                return False
    return True
