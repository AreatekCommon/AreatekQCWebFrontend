import type {
    AdvancedScanMode,
    CustomizedExposureSlots,
    ExposureMode,
    PathNode,
    PathPoint,
    PathPointExposure,
    PathPositionType,
    ScannerExposureSettings,
} from "../types/api";
import { useI18n } from "../i18n/useI18n";
import {
    createDefaultPointExposure,
    isScanPositionType,
    PointExposureFields,
} from "./PointExposureFields";
import { nameForPoint, normalizeTurntableForType, updateNodeById } from "../utils/pathNodes";

const POSITION_TYPES: PathPositionType[] = [
    "home",
    "basic_scan",
    "advanced_scan",
    "end",
];

type NodeInspectorProps = {
    node: PathNode | null;
    points: PathPoint[];
    disabled?: boolean;
    movingIndex?: number | null;
    touchUpPointId?: string | null;
    emptyNamePointIds?: Set<string>;
    exposureMode?: ExposureMode;
    customizedSlots?: CustomizedExposureSlots;
    globalExposureDefaults?: ScannerExposureSettings;
    perPointExposure?: boolean;
    perPointMarkerExposure?: boolean;
    uniformAdvancedScanRotations?: boolean;
    onChange: (node: PathNode) => void;
    onPointChange?: (pointId: string, patch: Partial<PathPoint>) => void;
    onPointNameBlur?: (pointId: string, name: string) => void;
    onDelete?: () => void;
    onDeletePoint?: () => void;
    onCopy?: () => void;
    onMoveTo?: () => void;
    onTouchUp?: () => void;
};

export function NodeInspector({
    node,
    points,
    disabled = false,
    movingIndex = null,
    touchUpPointId = null,
    emptyNamePointIds = new Set(),
    exposureMode = "auto",
    customizedSlots = "first",
    globalExposureDefaults,
    perPointExposure = false,
    perPointMarkerExposure = false,
    uniformAdvancedScanRotations = false,
    onChange,
    onPointChange,
    onPointNameBlur,
    onDelete,
    onDeletePoint,
    onCopy,
    onMoveTo,
    onTouchUp,
}: NodeInspectorProps) {
    const { t } = useI18n();

    if (!node) {
        return (
            <div className="node-inspector node-inspector--empty">
                <div className="path-editor-subtitle">{t.pathsPage.nodeInspector}</div>
                <p className="node-inspector-hint">{t.pathsPage.selectNodeHint}</p>
            </div>
        );
    }

    const activeNode = node;

    function patch(partial: Partial<PathNode>) {
        onChange({ ...activeNode, ...partial });
    }

    function updateType(type: PathPositionType) {
        patch({
            type,
            turntable: normalizeTurntableForType(type, activeNode.turntable),
        });
    }

    function updateTurntable(field: string, value: number) {
        patch({
            turntable: {
                ...activeNode.turntable,
                [field]: value,
            },
        });
    }

    function updateAdvancedScanMode(mode: AdvancedScanMode) {
        patch({
            turntable: normalizeTurntableForType("advanced_scan", {
                ...activeNode.turntable,
                advanced_scan_mode: mode,
            }),
        });
    }

    function updateMotion(field: "speed" | "acceleration", value: number) {
        patch({
            motion: {
                speed: activeNode.motion?.speed ?? 50,
                acceleration: activeNode.motion?.acceleration ?? 50,
                [field]: value,
            },
        });
    }

    const showExposureSection =
        (perPointExposure || perPointMarkerExposure) &&
        exposureMode !== "auto" &&
        globalExposureDefaults != null &&
        isScanPositionType(activeNode.type);

    const linkedPoint = points.find((point) => point.id === node.point_id);

    return (
        <div className="node-inspector">
            <div className="path-editor-subtitle">{t.pathsPage.nodeInspector}</div>
            <div className="node-inspector-actions">
                {onTouchUp && linkedPoint && (
                    <button
                        type="button"
                        className="nav-btn"
                        disabled={disabled || touchUpPointId !== null}
                        onClick={onTouchUp}
                    >
                        {touchUpPointId === node.point_id
                            ? t.pathsPage.touchUpInProgress
                            : t.pathsPage.touchUp}
                    </button>
                )}
                {onMoveTo && (
                    <button type="button" className="nav-btn active" disabled={disabled || movingIndex !== null} onClick={onMoveTo}>
                        {movingIndex !== null ? t.pathsPage.travelToPositionInProgress : t.pathsPage.travelToPosition}
                    </button>
                )}
                {onCopy && (
                    <button type="button" className="nav-btn" disabled={disabled} onClick={onCopy}>
                        {t.pathsPage.copyPosition}
                    </button>
                )}
                {onDelete && (
                    <button type="button" className="nav-btn" disabled={disabled} onClick={onDelete}>
                        {t.pathsPage.deleteNode}
                    </button>
                )}
                {onDeletePoint && linkedPoint && (
                    <button type="button" className="nav-btn" disabled={disabled} onClick={onDeletePoint}>
                        {t.pathsPage.deletePoint}
                    </button>
                )}
            </div>

            <div className="path-editor-grid">
                <label className="form-field">
                    <span>{t.pathsPage.fields.type}</span>
                    <select value={node.type} disabled={disabled} onChange={(event) => updateType(event.target.value as PathPositionType)}>
                        {POSITION_TYPES.map((type) => (
                            <option key={type} value={type}>
                                {t.pathsPage.types[type]}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="form-field">
                    <span>{t.pathsPage.selectPoint}</span>
                    <select
                        value={node.point_id}
                        disabled={disabled || !points.length}
                        onChange={(event) => patch({ point_id: event.target.value })}
                    >
                        {points.map((point) => (
                            <option key={point.id} value={point.id}>
                                {point.id} — {point.name || point.id}
                            </option>
                        ))}
                    </select>
                </label>
                {linkedPoint && onPointChange && (
                    <label className="form-field">
                        <span>{t.pathsPage.fields.pointName}</span>
                        <input
                            type="text"
                            className={emptyNamePointIds.has(linkedPoint.id) ? "input-invalid" : ""}
                            value={linkedPoint.name}
                            disabled={disabled}
                            onChange={(event) =>
                                onPointChange(linkedPoint.id, { name: event.target.value })
                            }
                            onBlur={(event) => onPointNameBlur?.(linkedPoint.id, event.target.value)}
                        />
                        {emptyNamePointIds.has(linkedPoint.id) ? (
                            <div className="field-error-text">{t.pathsPage.emptyPointNameError}</div>
                        ) : null}
                    </label>
                )}
                {node.prev_node_id && (
                    <label className="form-field">
                        <span>{t.pathsPage.fields.prevNode}</span>
                        <input type="text" value={node.prev_node_id} readOnly disabled />
                    </label>
                )}
                {node.next_node_id && (
                    <label className="form-field">
                        <span>{t.pathsPage.fields.nextNode}</span>
                        <input type="text" value={node.next_node_id} readOnly disabled />
                    </label>
                )}
            </div>

            <details className="path-editor-collapsible" open>
                <summary>{t.pathsPage.sections.turntable}</summary>
                {node.type === "advanced_scan" ? (
                    <div className="path-editor-grid path-editor-grid-compact">
                        <label className="form-field">
                            <span>{t.pathsPage.fields.advancedScanMode}</span>
                            <select
                                value={node.turntable.advanced_scan_mode ?? "range"}
                                disabled={disabled}
                                onChange={(e) => updateAdvancedScanMode(e.target.value as AdvancedScanMode)}
                            >
                                <option value="range">{t.pathsPage.fields.advancedScanModeRange}</option>
                                <option value="step">{t.pathsPage.fields.advancedScanModeStep}</option>
                            </select>
                        </label>
                        <label className="form-field">
                            <span>{t.pathsPage.fields.startAngle}</span>
                            <input type="number" step="0.01" value={node.turntable.start_angle ?? 0} disabled={disabled} onChange={(e) => updateTurntable("start_angle", Number(e.target.value))} />
                        </label>
                        {(node.turntable.advanced_scan_mode ?? "range") === "range" ? (
                            <label className="form-field">
                                <span>{t.pathsPage.fields.endAngle}</span>
                                <input type="number" step="0.01" value={node.turntable.end_angle ?? 0} disabled={disabled} onChange={(e) => updateTurntable("end_angle", Number(e.target.value))} />
                            </label>
                        ) : (
                            <label className="form-field">
                                <span>{t.pathsPage.fields.stepAngle}</span>
                                <input type="number" step="0.01" value={node.turntable.step_angle ?? 90} disabled={disabled} onChange={(e) => updateTurntable("step_angle", Number(e.target.value))} />
                            </label>
                        )}
                        {!uniformAdvancedScanRotations && (
                            <label className="form-field">
                                <span>{t.pathsPage.fields.scanCount}</span>
                                <input type="number" min={1} step={1} value={node.turntable.scan_count ?? 1} disabled={disabled} onChange={(e) => updateTurntable("scan_count", Number(e.target.value))} />
                            </label>
                        )}
                    </div>
                ) : (
                    <div className="path-editor-grid path-editor-grid-compact">
                        <label className="form-field">
                            <span>{t.pathsPage.fields.angle}</span>
                            <input type="number" step="0.01" value={node.turntable.angle ?? 0} disabled={disabled} onChange={(e) => updateTurntable("angle", Number(e.target.value))} />
                        </label>
                    </div>
                )}
                <div className="path-editor-grid path-editor-grid-compact">
                    <label className="form-field">
                        <span>{t.pathsPage.fields.turntableSpeed}</span>
                        <input type="number" step="0.01" value={node.turntable.speed ?? 50} disabled={disabled} onChange={(e) => updateTurntable("speed", Number(e.target.value))} />
                    </label>
                    <label className="form-field">
                        <span>{t.pathsPage.fields.turntableAcceleration}</span>
                        <input type="number" step="0.01" value={node.turntable.acceleration ?? 50} disabled={disabled} onChange={(e) => updateTurntable("acceleration", Number(e.target.value))} />
                    </label>
                </div>
            </details>

            <details className="path-editor-collapsible">
                <summary>{t.pathsPage.sections.motion}</summary>
                <div className="path-editor-grid path-editor-grid-compact">
                    <label className="form-field">
                        <span>{t.pathsPage.fields.motionSpeed}</span>
                        <input type="number" step="0.01" value={node.motion?.speed ?? 50} disabled={disabled} onChange={(e) => updateMotion("speed", Number(e.target.value))} />
                    </label>
                    <label className="form-field">
                        <span>{t.pathsPage.fields.motionAcceleration}</span>
                        <input type="number" step="0.01" value={node.motion?.acceleration ?? 50} disabled={disabled} onChange={(e) => updateMotion("acceleration", Number(e.target.value))} />
                    </label>
                </div>
            </details>

            {showExposureSection && (
                <details className="path-editor-collapsible" open>
                    <summary>{t.pathsPage.sections.exposure}</summary>
                    <PointExposureFields
                        exposure={createDefaultPointExposure(
                            {
                                val1: globalExposureDefaults.val1,
                                val2: globalExposureDefaults.val2,
                                val3: globalExposureDefaults.val3,
                                marker_exp: globalExposureDefaults.marker_exp,
                            },
                            node.exposure,
                        )}
                        exposureMode={exposureMode}
                        customizedSlots={customizedSlots}
                        perPointExposure={perPointExposure}
                        perPointMarkerExposure={perPointMarkerExposure}
                        disabled={disabled}
                        onChange={(exposure: PathPointExposure) => patch({ exposure })}
                    />
                </details>
            )}

            <div className="node-inspector-meta">
                {t.pathsPage.nodeLabel} {node.id} · {t.pathsPage.pointLabel} {nameForPoint(points, node.point_id)}
            </div>
        </div>
    );
}

export function applyNodeInspectorChange(nodes: PathNode[], updated: PathNode): PathNode[] {
    return updateNodeById(nodes, updated.id, updated);
}
