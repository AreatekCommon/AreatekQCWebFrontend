import { useEffect, useRef, useState } from "react";
import { fetchTrajectory } from "../api/client";
import type { TrajectoryResponse } from "../types/api";
import { useI18n } from "../i18n/useI18n";

function formatAxisValue(value: number): string {
    return value.toFixed(2);
}

function getTypeLabel(
    pointType: string,
    labels: {
        home: string;
        transition: string;
        scan: string;
        end: string;
    }
): string {
    switch (pointType) {
        case "home":
            return labels.home;
        case "transition":
            return labels.transition;
        case "scan":
            return labels.scan;
        case "end":
            return labels.end;
        default:
            return pointType;
    }
}

export function PathVisualizerPanel({
    activeStepIndex = null,
    resendStepIndices = [],
}: {
    activeStepIndex?: number | null;
    resendStepIndices?: number[];
}) {
    const { t } = useI18n();
    const resendStepSet = new Set(resendStepIndices);
    const [trajectory, setTrajectory] = useState<TrajectoryResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [followCurrentPoint, setFollowCurrentPoint] = useState(true);
    const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());

    useEffect(() => {
        let cancelled = false;

        async function loadTrajectory() {
            try {
                const data = await fetchTrajectory();
                if (!cancelled) {
                    setTrajectory(data);
                    setError(null);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : t.common.unknownError);
                }
            }
        }

        void loadTrajectory();

        return () => {
            cancelled = true;
        };
    }, [t.common.unknownError]);

    useEffect(() => {
        if (!followCurrentPoint || activeStepIndex == null) {
            return;
        }

        const row = rowRefs.current.get(activeStepIndex);
        row?.scrollIntoView({ block: "nearest" });
    }, [activeStepIndex, followCurrentPoint]);

    const loadError = trajectory?.load_error;
    const hasPoints = (trajectory?.points.length ?? 0) > 0;

    return (
        <div className="card path-visualizer-card">
            <div className="path-visualizer-header">
                <div className="card-title">{t.pathVisualizer.title}</div>
                <div className="path-visualizer-meta">
                    <span>
                        {t.pathVisualizer.steps}: {trajectory?.point_count ?? 0}
                    </span>
                    {trajectory?.source_path && (
                        <span>
                            {t.pathVisualizer.sourcePath}: {trajectory.source_path}
                        </span>
                    )}
                </div>
                {hasPoints && (
                    <label className="path-visualizer-scroll-checkbox">
                        <input
                            type="checkbox"
                            checked={followCurrentPoint}
                            onChange={(e) => setFollowCurrentPoint(e.target.checked)}
                        />
                        <span>{t.pathVisualizer.scrollFollow}</span>
                    </label>
                )}
            </div>

            {error && <div className="error-text">{error}</div>}
            {loadError && (
                <div className="error-text">
                    {t.pathVisualizer.loadError}: {loadError}
                </div>
            )}
            {!error && !loadError && !hasPoints && (
                <div className="path-visualizer-placeholder">{t.pathVisualizer.noData}</div>
            )}

            {hasPoints && (
                <div className="path-visualizer-table">
                    <div className="path-visualizer-table-head">
                        <span>{t.pathVisualizer.step}</span>
                        <span>{t.pathVisualizer.type}</span>
                        <span>{t.pathVisualizer.comment}</span>
                        <span>{t.axisDebug.a1}</span>
                        <span>{t.axisDebug.a2}</span>
                        <span>{t.axisDebug.a3}</span>
                        <span>{t.axisDebug.a4}</span>
                        <span>{t.axisDebug.a5}</span>
                        <span>{t.axisDebug.a6}</span>
                        <span>{t.pathVisualizer.turntable}</span>
                    </div>
                    <div className="path-visualizer-body">
                        {trajectory?.points.map((point) => {
                            const isActive = activeStepIndex === point.index;
                            const isMissed = resendStepSet.has(point.index);
                            const rowClassName = [
                                "path-visualizer-table-row",
                                isActive ? "active" : "",
                                isMissed ? "path-visualizer-table-row--missed" : "",
                            ]
                                .filter(Boolean)
                                .join(" ");

                            return (
                            <div
                                className={rowClassName}
                                key={point.index}
                                data-step-index={point.index}
                                title={isMissed ? t.pathVisualizer.missedStep : undefined}
                                ref={(element) => {
                                    if (element) {
                                        rowRefs.current.set(point.index, element);
                                    } else {
                                        rowRefs.current.delete(point.index);
                                    }
                                }}
                            >
                                <span className="path-step-cell">{point.index + 1}</span>
                                <span>
                                    <span className={`path-type-badge path-type-${point.point_type}`}>
                                        {getTypeLabel(point.point_type, t.pathVisualizer.types)}
                                    </span>
                                </span>
                                <span className="path-row-comment">{point.comment || "-"}</span>
                                <span>{formatAxisValue(point.a1)}</span>
                                <span>{formatAxisValue(point.a2)}</span>
                                <span>{formatAxisValue(point.a3)}</span>
                                <span>{formatAxisValue(point.a4)}</span>
                                <span>{formatAxisValue(point.a5)}</span>
                                <span>{formatAxisValue(point.a6)}</span>
                                <span className="path-turntable-value">{formatAxisValue(point.turntable_angle)}</span>
                            </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
