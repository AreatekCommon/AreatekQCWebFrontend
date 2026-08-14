import type {
    PathDocument,
    PathNode,
    PathPoint,
    PathPosition,
    PathPositionMotion,
    PathPositionTurntable,
    PathPositionType,
} from "../types/api";
import {
    axesKey,
    catalogOrderIds,
    migratePositionMatrixToIdMatrix,
    normalizeIdSafeRoutes,
    remapIdMatrix,
} from "./positionIds";

const DEFAULT_MOTION: PathPositionMotion = { speed: 50, acceleration: 50 };
const DEFAULT_TURNTABLE: PathPositionTurntable = { angle: 0, speed: 50, acceleration: 50 };

function pointName(source: { id: string; name?: string; comment?: string }): string {
    const name = source.name?.trim();
    if (name) {
        return name;
    }
    const comment = source.comment?.trim();
    if (comment) {
        return comment;
    }
    return source.id;
}

function catalogPoint(source: PathPosition | PathPoint & Partial<PathPosition>): PathPoint {
    return {
        id: source.id,
        name: pointName(source),
        axes: structuredClone(source.axes),
    };
}

function nodeSettings(source: PathPosition | Partial<PathNode>): Pick<PathNode, "turntable" | "motion" | "exposure"> {
    const settings: Pick<PathNode, "turntable" | "motion" | "exposure"> = {
        turntable: structuredClone(source.turntable ?? DEFAULT_TURNTABLE),
        motion: structuredClone(source.motion ?? DEFAULT_MOTION),
    };
    if (source.exposure) {
        settings.exposure = structuredClone(source.exposure);
    }
    return settings;
}

function buildNode(entry: PathPosition, nodeId: string, pointId: string): PathNode {
    return {
        id: nodeId,
        type: entry.type,
        point_id: pointId,
        ...nodeSettings(entry),
    };
}

export function linkNodeChain(nodes: PathNode[]): PathNode[] {
    return nodes.map((node, index) => {
        const linked: PathNode = { ...node };
        if (index === 0) {
            delete linked.prev_node_id;
        } else {
            linked.prev_node_id = nodes[index - 1].id;
        }
        if (index === nodes.length - 1) {
            delete linked.next_node_id;
        } else {
            linked.next_node_id = nodes[index + 1].id;
        }
        return linked;
    });
}

export function hasExplicitNodeLinks(nodes: PathNode[]): boolean {
    return nodes.some((node) => node.next_node_id || node.prev_node_id);
}

export function layoutNodesLinear(nodes: PathNode[], startX = 40, startY = 40): PathNode[] {
    const xStep = 220;
    const yStep = 120;
    return nodes.map((node, index) => ({
        ...node,
        x: node.x ?? startX + (index % 4) * xStep,
        y: node.y ?? startY + Math.floor(index / 4) * yStep,
    }));
}

const LEGACY_TRANSITION_TYPE = "transition";

function isLegacyTransitionType(type: string): boolean {
    return type === LEGACY_TRANSITION_TYPE;
}

export function migrateLegacyPositions(positions: PathPosition[]): { points: PathPoint[]; nodes: PathNode[] } {
    const points: PathPoint[] = [];
    const nodes: PathNode[] = [];
    const axesToPointIndex = new Map<string, number>();

    positions.forEach((entry, index) => {
        const key = axesKey(entry.axes);
        if (!axesToPointIndex.has(key)) {
            axesToPointIndex.set(key, points.length);
            points.push(catalogPoint(entry));
        } else {
            const pointIndex = axesToPointIndex.get(key)!;
            const incoming = pointName(entry);
            if (incoming && points[pointIndex].name === points[pointIndex].id) {
                points[pointIndex] = { ...points[pointIndex], name: incoming };
            }
        }
        const pointId = points[axesToPointIndex.get(key)!].id;
        if (isLegacyTransitionType(entry.type)) {
            return;
        }
        nodes.push(buildNode(entry, String(index), pointId));
    });

    return {
        points,
        nodes: layoutNodesLinear(linkNodeChain(nodes)),
    };
}

export function splitSettingsFromPoints(points: PathPoint[], nodes: PathNode[]): PathNode[] {
    const pointById = new Map(points.map((point) => [point.id, point]));

    return nodes.map((node) => {
        const legacyPoint = pointById.get(node.point_id) as PathPoint & Partial<PathPosition> | undefined;
        const next: PathNode = {
            ...node,
            turntable: node.turntable ?? legacyPoint?.turntable ?? DEFAULT_TURNTABLE,
            motion: node.motion ?? legacyPoint?.motion ?? DEFAULT_MOTION,
        };
        if (!node.exposure && legacyPoint?.exposure) {
            next.exposure = structuredClone(legacyPoint.exposure);
        }
        return next;
    });
}

export function stripPointsCatalog(points: Array<PathPoint & Partial<PathPosition>>): PathPoint[] {
    return points.map((point) => ({
        id: point.id,
        name: point.name?.trim() ?? point.comment?.trim() ?? "",
        axes: point.axes,
    }));
}

export function stripTransitionNodes(nodes: PathNode[]): PathNode[] {
    const hadTransitions = nodes.some((node) => isLegacyTransitionType(node.type));
    const kept = nodes.filter((node) => !isLegacyTransitionType(node.type));
    if (hadTransitions || !hasExplicitNodeLinks(kept)) {
        return layoutNodesLinear(linkNodeChain(kept));
    }
    return layoutNodesLinear(kept);
}

export function removeOrphanCatalogPoints(
    points: PathPoint[],
    nodes: PathNode[],
    safeRouteIds: string[],
): PathPoint[] {
    const referenced = new Set(nodes.map((node) => node.point_id).filter(Boolean));
    const safeIds = new Set(safeRouteIds);
    return points.filter((point) => referenced.has(point.id) || safeIds.has(point.id));
}

export function dropUnreferencedPoints(points: PathPoint[], nodes: PathNode[]): PathPoint[] {
    const referenced = new Set(nodes.map((node) => node.point_id).filter(Boolean));
    return points.filter((point) => referenced.has(point.id));
}

export function orderedNodes(nodes: PathNode[]): PathNode[] {
    if (!nodes.length) {
        return [];
    }

    const byId = new Map(nodes.map((node) => [node.id, node]));
    const start = nodes.find((node) => node.type === "home") ?? nodes[0];
    const ordered: PathNode[] = [];
    const visited = new Set<string>();
    let current: PathNode | undefined = start;

    while (current) {
        if (visited.has(current.id)) {
            break;
        }
        visited.add(current.id);
        ordered.push(current);
        current = current.next_node_id ? byId.get(current.next_node_id) : undefined;
    }

    for (const node of nodes) {
        if (!visited.has(node.id)) {
            ordered.push(node);
        }
    }

    return ordered;
}

export function connectNodes(nodes: PathNode[], fromId: string, toId: string): PathNode[] {
    if (fromId === toId) {
        return nodes;
    }

    const byId = new Map(nodes.map((node) => [node.id, node]));
    const from = byId.get(fromId);
    const to = byId.get(toId);
    if (!from || !to) {
        return nodes;
    }

    return nodes.map((node) => {
        const next = { ...node };

        if (node.id === fromId) {
            next.next_node_id = toId;
        } else if (node.next_node_id === toId && node.id !== fromId) {
            delete next.next_node_id;
        }

        if (node.id === toId) {
            next.prev_node_id = fromId;
        } else if (node.prev_node_id === fromId && node.id !== toId) {
            delete next.prev_node_id;
        }

        if (from.next_node_id && from.next_node_id !== toId) {
            const oldNext = byId.get(from.next_node_id);
            if (oldNext && node.id === oldNext.id) {
                delete next.prev_node_id;
            }
        }

        return next;
    });
}

export function disconnectNode(nodes: PathNode[], nodeId: string, direction: "prev" | "next"): PathNode[] {
    const target = nodes.find((node) => node.id === nodeId);
    if (!target) {
        return nodes;
    }

    const linkedId = direction === "next" ? target.next_node_id : target.prev_node_id;
    if (!linkedId) {
        return nodes;
    }

    return nodes.map((node) => {
        const next = { ...node };
        if (node.id === nodeId) {
            if (direction === "next") {
                delete next.next_node_id;
            } else {
                delete next.prev_node_id;
            }
        }
        if (node.id === linkedId) {
            if (direction === "next") {
                delete next.prev_node_id;
            } else {
                delete next.next_node_id;
            }
        }
        return next;
    });
}

export function ensureNeighborSafeRoutes(
    nodes: PathNode[],
    safeRouteIds: string[],
    safeRoutes: boolean[][],
): boolean[][] {
    const next = safeRoutes.map((row) => [...row]);
    const idToIndex = new Map(safeRouteIds.map((id, index) => [id, index]));
    const chain = orderedNodes(nodes);

    for (let index = 0; index < chain.length - 1; index += 1) {
        const leftId = chain[index].point_id;
        const rightId = chain[index + 1].point_id;
        if (!leftId || !rightId || leftId === rightId) {
            continue;
        }
        const row = idToIndex.get(leftId);
        const col = idToIndex.get(rightId);
        if (row === undefined || col === undefined) {
            continue;
        }
        if (!next[row][col]) {
            next[row][col] = true;
            next[col][row] = true;
        }
    }

    return next;
}

export function resolveSafeRoutesForPoints(
    points: PathPoint[],
    safeRouteIds?: string[],
    safeRoutes?: boolean[][],
    legacyPositions?: PathPosition[],
): { ids: string[]; matrix: boolean[][] } {
    const ids = catalogOrderIds(points);

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

    if (legacyPositions && safeRoutes && safeRoutes.length === legacyPositions.length) {
        return migratePositionMatrixToIdMatrix(legacyPositions, safeRoutes);
    }

    return { ids, matrix: normalizeIdSafeRoutes(ids) };
}

export type NormalizePathDocumentOptions = {
    preserveOrphanPoints?: boolean;
};

export function normalizePathDocument(
    document: PathDocument,
    options: NormalizePathDocumentOptions = {},
): {
    points: PathPoint[];
    nodes: PathNode[];
    safeRouteIds: string[];
    safeRoutes: boolean[][];
    perPointExposure: boolean;
    perPointMarkerExposure: boolean;
    uniformAdvancedScanRotations: boolean;
    uniformAdvancedScanCount: number | null;
} {
    let points: PathPoint[];
    let nodes: PathNode[];
    let legacyPositions: PathPosition[] | undefined;

    if (document.points?.length && document.nodes?.length) {
        points = stripPointsCatalog(structuredClone(document.points));
        nodes = splitSettingsFromPoints(points, structuredClone(document.nodes));
    } else if (document.positions?.length) {
        legacyPositions = document.positions;
        const migrated = migrateLegacyPositions(document.positions);
        points = migrated.points;
        nodes = migrated.nodes;
    } else {
        points = [];
        nodes = [];
    }

    nodes = stripTransitionNodes(nodes);
    let ordered = orderedNodes(nodes);
    if (!hasExplicitNodeLinks(nodes)) {
        ordered = linkNodeChain(ordered);
    }
    nodes = layoutNodesLinear(ordered);

    const rawSafeIds = Array.isArray(document.safe_route_ids)
        ? document.safe_route_ids.map(String)
        : [];
    if (!options.preserveOrphanPoints) {
        points = removeOrphanCatalogPoints(points, nodes, rawSafeIds);
    }

    const resolved = resolveSafeRoutesForPoints(
        points,
        document.safe_route_ids,
        document.safe_routes,
        legacyPositions,
    );
    const hasExplicitMatrix = Array.isArray(document.safe_routes) && document.safe_routes.length > 0;
    const safeRoutes = hasExplicitMatrix
        ? resolved.matrix
        : ensureNeighborSafeRoutes(nodes, resolved.ids, resolved.matrix);

    return {
        points,
        nodes,
        safeRouteIds: resolved.ids,
        safeRoutes,
        perPointExposure: document.per_point_exposure ?? false,
        perPointMarkerExposure: document.per_point_marker_exposure ?? false,
        uniformAdvancedScanRotations: document.uniform_advanced_scan_rotations ?? false,
        uniformAdvancedScanCount: document.uniform_advanced_scan_count ?? null,
    };
}

export function applyUniformScanCount(nodes: PathNode[], count: number): PathNode[] {
    return nodes.map((node) =>
        node.type === "advanced_scan"
            ? {
                  ...node,
                  turntable: {
                      ...node.turntable,
                      scan_count: count,
                  },
              }
            : node,
    );
}

export function validatePointNames(points: PathPoint[]): Set<string> {
    const emptyIds = new Set<string>();
    for (const point of points) {
        if (!point.name.trim()) {
            emptyIds.add(point.id);
        }
    }
    return emptyIds;
}

export function buildDocumentState(
    points: PathPoint[],
    nodes: PathNode[],
    safeRouteIds: string[],
    safeRoutes: boolean[][],
    perPointExposure: boolean,
    perPointMarkerExposure: boolean,
    uniformAdvancedScanRotations: boolean,
    uniformAdvancedScanCount: number | null,
): PathDocument {
    const normalized = normalizePathDocument(
        {
            points,
            nodes,
            safe_route_ids: safeRouteIds,
            safe_routes: safeRoutes,
            per_point_exposure: perPointExposure,
            per_point_marker_exposure: perPointMarkerExposure,
            uniform_advanced_scan_rotations: uniformAdvancedScanRotations,
            uniform_advanced_scan_count: uniformAdvancedScanCount,
        },
        { preserveOrphanPoints: true },
    );

    return {
        points: normalized.points,
        nodes: normalized.nodes,
        safe_route_ids: normalized.safeRouteIds,
        safe_routes: normalized.safeRoutes,
        per_point_exposure: perPointExposure,
        per_point_marker_exposure: perPointMarkerExposure,
        uniform_advanced_scan_rotations: uniformAdvancedScanRotations,
        uniform_advanced_scan_count: uniformAdvancedScanCount,
    };
}

export function pointById(points: PathPoint[], pointId: string): PathPoint | undefined {
    return points.find((point) => point.id === pointId);
}

export function nameForPoint(points: PathPoint[], pointId: string): string {
    return pointById(points, pointId)?.name ?? pointId;
}

export function mergeNodePoint(node: PathNode, point: PathPoint): PathPosition {
    return {
        id: point.id,
        type: node.type,
        comment: point.name,
        axes: point.axes,
        turntable: node.turntable,
        motion: node.motion,
        exposure: node.exposure,
    };
}

export function nextFreeNodeId(nodes: PathNode[]): string {
    const used = new Set(nodes.map((node) => node.id));
    let candidate = 0;
    while (used.has(String(candidate))) {
        candidate += 1;
    }
    return String(candidate);
}

export function nextFreePointId(points: PathPoint[]): string {
    const used = new Set(points.map((point) => point.id));
    let candidate = 0;
    while (used.has(String(candidate))) {
        candidate += 1;
    }
    return String(candidate);
}

export function createEmptyPoint(points: PathPoint[]): PathPoint {
    return {
        id: nextFreePointId(points),
        name: "",
        axes: { J1: 0, J2: 0, J3: 0, J4: 0, J5: 0, J6: 0 },
    };
}

export function createEmptyNode(
    points: PathPoint[],
    nodes: PathNode[],
    pointId?: string,
): PathNode {
    const resolvedPointId = pointId ?? points[0]?.id;
    if (!resolvedPointId) {
        throw new Error("Cannot create a node without an existing catalog point");
    }
    return {
        id: nextFreeNodeId(nodes),
        type: "basic_scan",
        point_id: resolvedPointId,
        turntable: { ...DEFAULT_TURNTABLE },
        motion: { ...DEFAULT_MOTION },
    };
}

export function generateNodesFromPoints(points: PathPoint[]): PathNode[] {
    if (points.length === 0) {
        return [];
    }

    const nodes: PathNode[] = [];

    function appendNode(type: PathPositionType, pointId: string): void {
        nodes.push({
            id: nextFreeNodeId(nodes),
            type,
            point_id: pointId,
            turntable: { ...DEFAULT_TURNTABLE },
            motion: { ...DEFAULT_MOTION },
        });
    }

    if (points.length === 1) {
        appendNode("home", points[0].id);
        appendNode("end", points[0].id);
        return layoutNodesLinear(linkNodeChain(nodes));
    }

    appendNode("home", points[0].id);
    for (let index = 1; index < points.length - 1; index += 1) {
        appendNode("basic_scan", points[index].id);
    }
    appendNode("end", points[points.length - 1].id);
    return layoutNodesLinear(linkNodeChain(nodes));
}

export function updatePointById(
    points: PathPoint[],
    pointId: string,
    patch: Partial<PathPoint>,
): PathPoint[] {
    return points.map((point) => (point.id === pointId ? { ...point, ...patch } : point));
}

export function updateNodeById(nodes: PathNode[], nodeId: string, patch: Partial<PathNode>): PathNode[] {
    return nodes.map((node) => (node.id === nodeId ? { ...node, ...patch } : node));
}

export function normalizeTurntableForType(
    type: PathPositionType,
    turntable: PathPositionTurntable,
): PathPositionTurntable {
    if (type === "advanced_scan") {
        const mode = turntable.advanced_scan_mode ?? "range";
        const base = {
            start_angle: turntable.start_angle ?? 0,
            scan_count: turntable.scan_count ?? 1,
            advanced_scan_mode: mode,
            speed: turntable.speed ?? 50,
            acceleration: turntable.acceleration ?? 50,
        };

        if (mode === "step") {
            return {
                ...base,
                step_angle: turntable.step_angle ?? 90,
            };
        }

        return {
            ...base,
            advanced_scan_mode: "range",
            end_angle: turntable.end_angle ?? 360,
        };
    }

    return {
        angle: turntable.angle ?? 0,
        speed: turntable.speed ?? 50,
        acceleration: turntable.acceleration ?? 50,
    };
}

export function nodeIndexInChain(nodes: PathNode[], nodeId: string): number {
    return orderedNodes(nodes).findIndex((node) => node.id === nodeId);
}
