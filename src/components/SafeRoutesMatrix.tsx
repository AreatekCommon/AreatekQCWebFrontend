import type { PathPoint } from "../types/api";
import { useI18n } from "../i18n/useI18n";
import { nameForPoint } from "../utils/pathNodes";

type SafeRoutesMatrixProps = {
    points: PathPoint[];
    safeRouteIds: string[];
    safeRoutes: boolean[][];
    disabled?: boolean;
    onChange: (safeRoutes: boolean[][]) => void;
};

export function SafeRoutesMatrix({
    points,
    safeRouteIds,
    safeRoutes,
    disabled = false,
    onChange,
}: SafeRoutesMatrixProps) {
    const { t } = useI18n();

    if (!safeRouteIds.length) {
        return null;
    }

    function toggleRoute(fromIndex: number, toIndex: number) {
        if (disabled || fromIndex === toIndex) {
            return;
        }

        const next = safeRoutes.map((row) => [...row]);
        const value = !next[fromIndex][toIndex];
        next[fromIndex][toIndex] = value;
        next[toIndex][fromIndex] = value;
        onChange(next);
    }

    function headerLabel(pointId: string): string {
        const name = nameForPoint(points, pointId);
        const suffix = name && name !== pointId ? ` ${name.slice(0, 18)}` : "";
        return `${pointId}${suffix}`;
    }

    return (
        <div className="safe-routes-section">
            <div className="path-editor-subtitle">{t.pathsPage.safeRoutesTitle}</div>
            <p className="safe-routes-hint">{t.pathsPage.safeRoutesHint}</p>
            <div className="safe-routes-matrix-wrap">
                <table className="safe-routes-matrix">
                    <thead>
                        <tr>
                            <th className="safe-routes-corner">{t.pathsPage.safeRoutesFromTo}</th>
                            {safeRouteIds.map((pointId) => (
                                <th key={`col-${pointId}`} className="safe-routes-header">
                                    {headerLabel(pointId)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {safeRouteIds.map((rowId, rowIndex) => (
                            <tr key={`row-${rowId}`}>
                                <th className="safe-routes-header safe-routes-row-header">
                                    {headerLabel(rowId)}
                                </th>
                                {safeRouteIds.map((columnId, columnIndex) => (
                                    <td key={`cell-${rowId}-${columnId}`} className="safe-routes-cell">
                                        {rowIndex > columnIndex ? (
                                            <input
                                                type="checkbox"
                                                checked={safeRoutes[rowIndex]?.[columnIndex] ?? false}
                                                disabled={disabled}
                                                aria-label={`${headerLabel(rowId)} -> ${headerLabel(columnId)}`}
                                                onChange={() => toggleRoute(rowIndex, columnIndex)}
                                            />
                                        ) : null}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
