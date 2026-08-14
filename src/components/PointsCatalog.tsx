import { useState } from "react";
import type { PathPoint } from "../types/api";
import { useI18n } from "../i18n/useI18n";
import { JOINT_KEYS } from "../utils/positionIds";

type PointsCatalogProps = {
    points: PathPoint[];
    disabled?: boolean;
    touchUpIndex?: number | null;
    addingPoint?: boolean;
    emptyNamePointIds?: Set<string>;
    onChange: (points: PathPoint[]) => void;
    onAxesChange?: (points: PathPoint[]) => void;
    onAddPoint?: () => void;
    onTouchUp?: (index: number) => void;
    onPointNameBlur?: (pointId: string, name: string) => void;
    onReorder?: (fromIndex: number, toIndex: number) => void;
};

export function PointsCatalog({
    points,
    disabled = false,
    touchUpIndex = null,
    addingPoint = false,
    emptyNamePointIds = new Set(),
    onChange,
    onAxesChange,
    onAddPoint,
    onTouchUp,
    onPointNameBlur,
    onReorder,
}: PointsCatalogProps) {
    const { t } = useI18n();
    const [dragIndex, setDragIndex] = useState<number | null>(null);

    function updatePoint(index: number, patch: Partial<PathPoint>) {
        onChange(points.map((point, pointIndex) => (pointIndex === index ? { ...point, ...patch } : point)));
    }

    function updateAxis(index: number, joint: (typeof JOINT_KEYS)[number], value: number) {
        const nextPoints = points.map((item, pointIndex) =>
            pointIndex === index ? { ...item, axes: { ...item.axes, [joint]: value } } : item,
        );
        if (onAxesChange) {
            onAxesChange(nextPoints);
        } else {
            onChange(nextPoints);
        }
    }

    function handleDelete(index: number) {
        onChange(points.filter((_, pointIndex) => pointIndex !== index));
    }

    function handleDrop(targetIndex: number) {
        if (dragIndex === null || dragIndex === targetIndex || !onReorder) {
            setDragIndex(null);
            return;
        }
        onReorder(dragIndex, targetIndex);
        setDragIndex(null);
    }

    return (
        <div className="points-catalog">
            <div className="path-editor-subtitle">{t.pathsPage.pointsCatalog}</div>
            <div className="points-catalog-actions">
                <button
                    type="button"
                    className="nav-btn"
                    disabled={disabled || addingPoint || !onAddPoint}
                    onClick={() => onAddPoint?.()}
                >
                    {addingPoint ? t.pathsPage.addPointInProgress : t.pathsPage.addPoint}
                </button>
            </div>
            <div className="points-catalog-wrap">
                <table className="points-catalog-table">
                    <thead>
                        <tr>
                            <th className="points-catalog-drag-col" aria-label={t.pathsPage.dragHandle} />
                            <th>{t.pathsPage.fields.id}</th>
                            <th>{t.pathsPage.fields.pointName}</th>
                            {JOINT_KEYS.map((joint) => (
                                <th key={joint} className="points-catalog-axis-col">
                                    {joint}
                                </th>
                            ))}
                            <th>{t.pathsPage.actions}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {points.map((point, index) => (
                            <tr
                                key={point.id}
                                className={dragIndex === index ? "points-catalog-row--dragging" : ""}
                                onDragOver={(event) => {
                                    if (disabled || dragIndex === null) {
                                        return;
                                    }
                                    event.preventDefault();
                                }}
                                onDrop={(event) => {
                                    event.preventDefault();
                                    handleDrop(index);
                                }}
                            >
                                <td className="points-catalog-drag-col">
                                    {!disabled && onReorder ? (
                                        <button
                                            type="button"
                                            className="points-catalog-drag-handle"
                                            draggable={!disabled}
                                            disabled={disabled}
                                            aria-label={t.pathsPage.dragHandle}
                                            onDragStart={() => setDragIndex(index)}
                                            onDragEnd={() => setDragIndex(null)}
                                        >
                                            ⋮⋮
                                        </button>
                                    ) : null}
                                </td>
                                <td>{point.id}</td>
                                <td>
                                    <input
                                        type="text"
                                        className={`points-catalog-input${emptyNamePointIds.has(point.id) ? " input-invalid" : ""}`}
                                        value={point.name}
                                        disabled={disabled}
                                        onChange={(event) => updatePoint(index, { name: event.target.value })}
                                        onBlur={(event) => onPointNameBlur?.(point.id, event.target.value)}
                                    />
                                    {emptyNamePointIds.has(point.id) ? (
                                        <div className="field-error-text">{t.pathsPage.emptyPointNameError}</div>
                                    ) : null}
                                </td>
                                {JOINT_KEYS.map((joint) => (
                                    <td key={`${point.id}-${joint}`} className="points-catalog-axis-col">
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="points-catalog-input points-catalog-axis-input"
                                            value={point.axes[joint]}
                                            disabled={disabled}
                                            onChange={(event) => updateAxis(index, joint, Number(event.target.value))}
                                        />
                                    </td>
                                ))}
                                <td className="points-catalog-row-actions">
                                    {onTouchUp && (
                                        <button
                                            type="button"
                                            className="nav-btn"
                                            disabled={disabled || touchUpIndex !== null || addingPoint}
                                            onClick={() => onTouchUp(index)}
                                        >
                                            {touchUpIndex === index
                                                ? t.pathsPage.touchUpInProgress
                                                : t.pathsPage.touchUp}
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        className="nav-btn"
                                        disabled={disabled}
                                        onClick={() => handleDelete(index)}
                                    >
                                        {t.pathsPage.deletePosition}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
