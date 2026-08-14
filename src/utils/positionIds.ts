import type { PathPoint, PathPosition, PathPositionAxes } from "../types/api";

export const JOINT_KEYS = ["J1", "J2", "J3", "J4", "J5", "J6"] as const;

export function axesKey(axes: PathPositionAxes): string {
    return JOINT_KEYS.map((joint) => axes[joint].toFixed(2)).join("|");
}

function parseId(value: string | undefined): number | null {
    if (!value?.trim()) {
        return null;
    }
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isNaN(parsed) ? null : parsed;
}

function sortIdKey(positionId: string): [number, string | number] {
    const parsed = parseId(positionId);
    if (parsed !== null) {
        return [0, parsed];
    }
    return [1, positionId];
}

function nextFreeId(usedIds: Set<string>): string {
    let candidate = 0;
    while (usedIds.has(String(candidate))) {
        candidate += 1;
    }
    return String(candidate);
}

export function normalizePositionIds(positions: PathPosition[]): PathPosition[] {
    const groups = new Map<string, number[]>();

    positions.forEach((position, index) => {
        const key = axesKey(position.axes);
        const members = groups.get(key) ?? [];
        members.push(index);
        groups.set(key, members);
    });

    const groupEntries = Array.from(groups.entries()).map(([key, indices]) => {
        const numericIds = indices
            .map((index) => parseId(positions[index].id))
            .filter((value): value is number => value !== null);
        const canonical =
            numericIds.length > 0 ? String(Math.min(...numericIds)) : String(Math.min(...indices));
        return {
            key,
            minIndex: Math.min(...indices),
            canonical,
        };
    });

    groupEntries.sort((left, right) => left.minIndex - right.minIndex);

    const assigned = new Map<string, string>();
    const usedIds = new Set<string>();

    for (const entry of groupEntries) {
        let chosen = entry.canonical;
        if (usedIds.has(chosen)) {
            chosen = nextFreeId(usedIds);
        }
        assigned.set(entry.key, chosen);
        usedIds.add(chosen);
    }

    return positions.map((position) => {
        const key = axesKey(position.axes);
        return {
            ...position,
            id: assigned.get(key) ?? position.id,
        };
    });
}

type IdLabelItem = { id: string; name?: string; comment?: string };

export function uniqueSortedIds(positions: IdLabelItem[]): string[] {
    const unique = new Set(positions.map((position) => position.id).filter(Boolean));
    return Array.from(unique).sort((left, right) => {
        const leftKey = sortIdKey(left);
        const rightKey = sortIdKey(right);
        if (leftKey[0] !== rightKey[0]) {
            return leftKey[0] - rightKey[0];
        }
        if (typeof leftKey[1] === "number" && typeof rightKey[1] === "number") {
            return leftKey[1] - rightKey[1];
        }
        return String(leftKey[1]).localeCompare(String(rightKey[1]));
    });
}

/** Point IDs in catalog array order (deduplicated, first occurrence wins). */
export function catalogOrderIds(positions: IdLabelItem[]): string[] {
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const position of positions) {
        if (!position.id || seen.has(position.id)) {
            continue;
        }
        seen.add(position.id);
        ids.push(position.id);
    }
    return ids;
}

export function firstIndexForId(positions: PathPosition[], positionId: string): number {
    const index = positions.findIndex((position) => position.id === positionId);
    if (index < 0) {
        throw new Error(`Position id not found: ${positionId}`);
    }
    return index;
}

export function normalizeIdSafeRoutes(ids: string[], matrix?: boolean[][]): boolean[][] {
    const count = ids.length;
    if (count === 0) {
        return [];
    }

    if (matrix === undefined && count <= 2) {
        return Array.from({ length: count }, () => Array.from({ length: count }, () => true));
    }

    const routes: boolean[][] = [];
    for (let rowIndex = 0; rowIndex < count; rowIndex += 1) {
        const row: boolean[] = [];
        for (let columnIndex = 0; columnIndex < count; columnIndex += 1) {
            if (rowIndex === columnIndex) {
                row.push(true);
                continue;
            }
            row.push(Boolean(matrix?.[rowIndex]?.[columnIndex]));
        }
        routes.push(row);
    }

    for (let rowIndex = 0; rowIndex < count; rowIndex += 1) {
        for (let columnIndex = rowIndex + 1; columnIndex < count; columnIndex += 1) {
            const merged = routes[rowIndex][columnIndex] || routes[columnIndex][rowIndex];
            routes[rowIndex][columnIndex] = merged;
            routes[columnIndex][rowIndex] = merged;
        }
    }

    return routes;
}

export function migratePositionMatrixToIdMatrix(
    positions: PathPosition[],
    oldMatrix?: boolean[][],
): { ids: string[]; matrix: boolean[][] } {
    const ids = uniqueSortedIds(positions);
    const size = ids.length;
    if (size === 0) {
        return { ids: [], matrix: [] };
    }

    const idToIndex = new Map(ids.map((id, index) => [id, index]));
    const merged = Array.from({ length: size }, (_, rowIndex) =>
        Array.from({ length: size }, (_, columnIndex) => rowIndex === columnIndex),
    );

    if (!oldMatrix) {
        return { ids, matrix: normalizeIdSafeRoutes(ids, merged) };
    }

    positions.forEach((position, rowIndex) => {
        const fromId = position.id;
        const fromMatrixIndex = idToIndex.get(fromId);
        if (fromMatrixIndex === undefined || rowIndex >= oldMatrix.length) {
            return;
        }
        const sourceRow = oldMatrix[rowIndex];
        positions.forEach((other, columnIndex) => {
            if (columnIndex >= sourceRow.length) {
                return;
            }
            const toId = other.id;
            const toMatrixIndex = idToIndex.get(toId);
            if (toMatrixIndex === undefined || !sourceRow[columnIndex]) {
                return;
            }
            merged[fromMatrixIndex][toMatrixIndex] = true;
            merged[toMatrixIndex][fromMatrixIndex] = true;
        });
    });

    return { ids, matrix: normalizeIdSafeRoutes(ids, merged) };
}

export function remapIdMatrix(
    oldIds: string[],
    oldMatrix: boolean[][],
    newIds: string[],
): { ids: string[]; matrix: boolean[][] } {
    if (newIds.length === 0) {
        return { ids: [], matrix: [] };
    }

    const newIndex = new Map(newIds.map((id, index) => [id, index]));
    const size = newIds.length;
    const merged = Array.from({ length: size }, (_, rowIndex) =>
        Array.from({ length: size }, (_, columnIndex) => rowIndex === columnIndex),
    );

    oldIds.forEach((fromId, rowIndex) => {
        const fromMatrixIndex = newIndex.get(fromId);
        if (fromMatrixIndex === undefined || rowIndex >= oldMatrix.length) {
            return;
        }
        const sourceRow = oldMatrix[rowIndex];
        oldIds.forEach((toId, columnIndex) => {
            if (columnIndex >= sourceRow.length) {
                return;
            }
            const toMatrixIndex = newIndex.get(toId);
            if (toMatrixIndex === undefined || !sourceRow[columnIndex]) {
                return;
            }
            merged[fromMatrixIndex][toMatrixIndex] = true;
            merged[toMatrixIndex][fromMatrixIndex] = true;
        });
    });

    return { ids: newIds, matrix: normalizeIdSafeRoutes(newIds, merged) };
}

export function resolveSafeRoutes(
    positions: PathPosition[],
    safeRouteIds?: string[],
    safeRoutes?: boolean[][],
): { ids: string[]; matrix: boolean[][] } {
    const ids = uniqueSortedIds(positions);

    if (
        safeRouteIds &&
        safeRoutes &&
        safeRouteIds.length === safeRoutes.length &&
        safeRouteIds.length === ids.length &&
        new Set(safeRouteIds).size === new Set(ids).size &&
        ids.every((id) => safeRouteIds.includes(id))
    ) {
        const idToOldIndex = new Map(safeRouteIds.map((id, index) => [id, index]));
        const reordered = ids.map((fromId, rowIndex) =>
            ids.map((toId, columnIndex) => {
                if (rowIndex === columnIndex) {
                    return true;
                }
                const oldRow = idToOldIndex.get(fromId)!;
                const oldColumn = idToOldIndex.get(toId)!;
                return Boolean(safeRoutes[oldRow]?.[oldColumn]);
            }),
        );
        return { ids, matrix: normalizeIdSafeRoutes(ids, reordered) };
    }

    if (safeRouteIds && safeRoutes && safeRouteIds.length === safeRoutes.length) {
        return remapIdMatrix(safeRouteIds, safeRoutes, ids);
    }

    if (safeRoutes && safeRoutes.length === positions.length) {
        return migratePositionMatrixToIdMatrix(positions, safeRoutes);
    }

    return { ids, matrix: normalizeIdSafeRoutes(ids) };
}

export function commentForId(positions: IdLabelItem[], positionId: string): string {
    const position = positions.find((item) => item.id === positionId);
    return position?.name?.trim() ?? position?.comment?.trim() ?? "";
}

export function syncCommentsById(positions: PathPoint[]): PathPoint[] {
    const nameById = new Map<string, string>();

    for (const position of positions) {
        const positionId = position.id;
        const name = position.name?.trim() ?? "";
        if (!nameById.has(positionId)) {
            nameById.set(positionId, name);
        } else if (name && !nameById.get(positionId)) {
            nameById.set(positionId, name);
        }
    }

    return positions.map((position) => ({
        ...position,
        name: nameById.get(position.id) ?? position.name ?? "",
    }));
}
