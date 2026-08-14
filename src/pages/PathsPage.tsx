import { useCallback, useEffect, useRef, useState } from "react";
import {
    copyPath,
    createPath,
    deletePath,
    fetchActivePath,
    fetchAxis,
    fetchPaths,
    fetchPipelineStatus,
    fetchSettings,
    isLocalApiServer,
    moveToPathPosition,
    pickServerFolder,
    renamePath,
    saveActivePath,
    saveSettingsSection,
    selectPath,
} from "../api/client";
import { defaultRuntimeSettings } from "../constants/scannerDefaults";
import { applyNodeInspectorChange, NodeInspector } from "../components/NodeInspector";
import { PathNodeGraph } from "../components/PathNodeGraph";
import { createDefaultPointExposure, isScanPositionType } from "../components/PointExposureFields";
import { SafeRoutesMatrix } from "../components/SafeRoutesMatrix";
import { TravelRouteTable } from "../components/TravelRouteTable";
import { usePathEditorHistory, type PathEditorSnapshot } from "../hooks/usePathEditorHistory";
import { useI18n } from "../i18n/useI18n";
import { useProjectSaveRegistry } from "../project/ProjectSaveContext";
import type {
    PathNode,
    PathPoint,
    PathTravelStep,
    PathsListResponse,
    PipelineStatus,
    RuntimeSettings,
} from "../types/api";
import {
    buildCopyTargetStem,
    ensureJsonExtension,
    formatPathDisplayName,
    validatePathBasename,
} from "../utils/pathFilenames";
import { SETTINGS_SECTION_PATHS } from "../utils/settingsSections";
import { normalizeIdSafeRoutes } from "../utils/positionIds";
import { optimizePathNodes } from "../utils/pathOptimize";
import {
    applyUniformScanCount,
    buildDocumentState,
    createEmptyNode,
    createEmptyPoint,
    generateNodesFromPoints,
    layoutNodesLinear,
    linkNodeChain,
    nextFreeNodeId,
    nodeIndexInChain,
    normalizePathDocument,
    orderedNodes,
    updatePointById,
    validatePointNames,
} from "../utils/pathNodes";

const AUTOSAVE_DELAY_MS = 400;

function seedScanNodesExposure(
    nodes: PathNode[],
    settings: RuntimeSettings["scanner"]["exposure_settings"],
): PathNode[] {
    const defaults = {
        val1: settings.val1,
        val2: settings.val2,
        val3: settings.val3,
        marker_exp: settings.marker_exp,
    };

    return nodes.map((node) => {
        if (!isScanPositionType(node.type)) {
            return node;
        }
        return {
            ...node,
            exposure: createDefaultPointExposure(defaults, node.exposure),
        };
    });
}

export function PathsPage() {
    const { t } = useI18n();
    const { registerPathDocumentGetter, registerProjectReloadListener } = useProjectSaveRegistry();
    const history = usePathEditorHistory();
    const clearHistoryRef = useRef(history.clear);
    clearHistoryRef.current = history.clear;
    const initialLoadCompleteRef = useRef(false);
    const historyApplyingRef = useRef(false);
    const autosaveTimerRef = useRef<number | null>(null);
    const autosavePendingRef = useRef(false);

    const [pathsList, setPathsList] = useState<PathsListResponse | null>(null);
    const [points, setPoints] = useState<PathPoint[]>([]);
    const [nodes, setNodes] = useState<PathNode[]>([]);
    const [safeRouteIds, setSafeRouteIds] = useState<string[]>([]);
    const [safeRoutes, setSafeRoutes] = useState<boolean[][]>([]);
    const [expandedCount, setExpandedCount] = useState<number | null>(null);
    const [sourceCount, setSourceCount] = useState<number | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [selecting, setSelecting] = useState(false);
    const [copying, setCopying] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [renaming, setRenaming] = useState(false);
    const [creating, setCreating] = useState(false);
    const [savingFolder, setSavingFolder] = useState(false);
    const [pickingFolder, setPickingFolder] = useState(false);
    const [pathsFolderInput, setPathsFolderInput] = useState("");
    const [newFileName, setNewFileName] = useState("new_path");
    const [copyFileName, setCopyFileName] = useState("");
    const [newFileNameError, setNewFileNameError] = useState<string | null>(null);
    const [copyFileNameError, setCopyFileNameError] = useState<string | null>(null);
    const [renameFileName, setRenameFileName] = useState("");
    const [renameFileNameError, setRenameFileNameError] = useState<string | null>(null);
    const [runtimeSettings, setRuntimeSettings] = useState<RuntimeSettings>(defaultRuntimeSettings);
    const [perPointExposure, setPerPointExposure] = useState(false);
    const [perPointMarkerExposure, setPerPointMarkerExposure] = useState(false);
    const [uniformAdvancedScanRotations, setUniformAdvancedScanRotations] = useState(false);
    const [uniformAdvancedScanCount, setUniformAdvancedScanCount] = useState<number | null>(1);
    const [rotationCountInput, setRotationCountInput] = useState("1");
    const [rotationCountError, setRotationCountError] = useState(false);
    const [emptyNamePointIds, setEmptyNamePointIds] = useState<Set<string>>(new Set());
    const [movingIndex, setMovingIndex] = useState<number | null>(null);
    const [touchUpPointId, setTouchUpPointId] = useState<string | null>(null);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);
    const [travelSteps, setTravelSteps] = useState<PathTravelStep[]>([]);
    const [autosaveTick, setAutosaveTick] = useState(0);

    const isLocked =
        pipelineStatus?.state === "running" || pipelineStatus?.state === "stopping";
    const exposureSettings = runtimeSettings.scanner.exposure_settings;
    const manualExposureMode = exposureSettings.mode !== "auto";
    const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;
    const isLocalServer = isLocalApiServer();

    const buildSnapshot = useCallback((): PathEditorSnapshot => ({
        points,
        nodes,
        safeRouteIds,
        safeRoutes,
        perPointExposure,
        perPointMarkerExposure,
        uniformAdvancedScanRotations,
        uniformAdvancedScanCount,
    }), [
        points,
        nodes,
        safeRouteIds,
        safeRoutes,
        perPointExposure,
        perPointMarkerExposure,
        uniformAdvancedScanRotations,
        uniformAdvancedScanCount,
    ]);

    const applySnapshot = useCallback((snapshot: PathEditorSnapshot) => {
        historyApplyingRef.current = true;
        setPoints(snapshot.points);
        setNodes(snapshot.nodes);
        setSafeRouteIds(snapshot.safeRouteIds);
        setSafeRoutes(snapshot.safeRoutes);
        setPerPointExposure(snapshot.perPointExposure);
        setPerPointMarkerExposure(snapshot.perPointMarkerExposure);
        setUniformAdvancedScanRotations(snapshot.uniformAdvancedScanRotations);
        setUniformAdvancedScanCount(snapshot.uniformAdvancedScanCount);
        setRotationCountInput(
            snapshot.uniformAdvancedScanCount != null ? String(snapshot.uniformAdvancedScanCount) : "",
        );
        setEmptyNamePointIds(validatePointNames(snapshot.points));
        window.setTimeout(() => {
            historyApplyingRef.current = false;
        }, 0);
    }, []);

    const pushHistory = useCallback(() => {
        if (historyApplyingRef.current) {
            return;
        }
        history.pushSnapshot(buildSnapshot());
    }, [buildSnapshot, history]);

    const hasValidationErrors = useCallback(() => {
        if (emptyNamePointIds.size > 0) {
            return true;
        }
        if (uniformAdvancedScanRotations && uniformAdvancedScanCount == null) {
            return true;
        }
        return false;
    }, [emptyNamePointIds, uniformAdvancedScanRotations, uniformAdvancedScanCount]);

    const buildCurrentDocument = useCallback(() => {
        return buildDocumentState(
            points,
            nodes,
            safeRouteIds,
            safeRoutes,
            perPointExposure,
            perPointMarkerExposure,
            uniformAdvancedScanRotations,
            uniformAdvancedScanCount,
        );
    }, [
        points,
        nodes,
        safeRouteIds,
        safeRoutes,
        perPointExposure,
        perPointMarkerExposure,
        uniformAdvancedScanRotations,
        uniformAdvancedScanCount,
    ]);

    useEffect(() => {
        registerPathDocumentGetter(() => buildCurrentDocument());
        return () => registerPathDocumentGetter(null);
    }, [buildCurrentDocument, registerPathDocumentGetter]);

    const applyActivePath = useCallback((data: Awaited<ReturnType<typeof fetchActivePath>>) => {
        const normalized = normalizePathDocument(data.document);
        setPoints(normalized.points);
        setNodes(normalized.nodes);
        setSafeRouteIds(normalized.safeRouteIds);
        setSafeRoutes(normalized.safeRoutes);
        setPerPointExposure(normalized.perPointExposure);
        setPerPointMarkerExposure(normalized.perPointMarkerExposure);
        setUniformAdvancedScanRotations(normalized.uniformAdvancedScanRotations);
        setUniformAdvancedScanCount(normalized.uniformAdvancedScanCount);
        setRotationCountInput(
            normalized.uniformAdvancedScanCount != null
                ? String(normalized.uniformAdvancedScanCount)
                : normalized.uniformAdvancedScanRotations
                  ? ""
                  : "1",
        );
        setEmptyNamePointIds(validatePointNames(normalized.points));
        setExpandedCount(data.expanded_point_count);
        setSourceCount(data.source_position_count);
        setSelectedNodeId(null);
        setTravelSteps([]);
    }, []);

    const persistDocument = useCallback(
        async (options: { silent?: boolean } = {}) => {
            if (isLocked || hasValidationErrors()) {
                return false;
            }
            try {
                if (!options.silent) {
                    setSaving(true);
                }
                setActionError(null);
                if (!options.silent) {
                    setSuccess(null);
                }
                const document = buildCurrentDocument();
                const previousSelectedNodeId = selectedNodeId;
                const data = await saveActivePath(document);
                applyActivePath(data);
                const restoredId =
                    previousSelectedNodeId != null &&
                    data.document.nodes?.some((node) => node.id === previousSelectedNodeId)
                        ? previousSelectedNodeId
                        : null;
                setSelectedNodeId(restoredId);
                if (data.load_error) {
                    setLoadError(data.load_error);
                } else {
                    setLoadError(null);
                }
                if (options.silent) {
                    setSuccess(t.pathsPage.autosaveSuccess);
                } else {
                    setSuccess(t.pathsPage.saveSuccess);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                }
                return true;
            } catch (err) {
                const message = err instanceof Error ? err.message : t.pathsPage.saveError;
                setActionError(options.silent ? t.pathsPage.autosaveError : message);
                return false;
            } finally {
                if (!options.silent) {
                    setSaving(false);
                }
            }
        },
        [applyActivePath, buildCurrentDocument, hasValidationErrors, isLocked, selectedNodeId, t.pathsPage],
    );

    const loadPipelineStatus = useCallback(async () => {
        try {
            const status = await fetchPipelineStatus();
            setPipelineStatus(status);
        } catch {
            setPipelineStatus(null);
        }
    }, []);

    const loadPaths = useCallback(async () => {
        try {
            const list = await fetchPaths();
            setPathsList(list);
            return list;
        } catch {
            setLoadError(t.pathsPage.loadError);
            return null;
        }
    }, [t.pathsPage.loadError]);

    const loadActivePath = useCallback(async () => {
        try {
            const data = await fetchActivePath();
            applyActivePath(data);
            if (data.load_error) {
                setLoadError(data.load_error);
            } else {
                setLoadError(null);
            }
            return data;
        } catch {
            setLoadError(t.pathsPage.loadError);
            return null;
        }
    }, [applyActivePath, t.pathsPage.loadError]);

    const reloadAll = useCallback(async () => {
        const isInitialLoad = !initialLoadCompleteRef.current;
        if (isInitialLoad) {
            setLoading(true);
        } else {
            setReloading(true);
        }
        setActionError(null);
        setSuccess(null);
        clearHistoryRef.current();
        await loadPipelineStatus();
        try {
            const settings = await fetchSettings();
            setRuntimeSettings(settings);
            setPathsFolderInput(settings.paths_folder);
        } catch {
            // Keep previous folder input if settings cannot be loaded.
        }
        await loadPaths();
        await loadActivePath();
        if (isInitialLoad) {
            setLoading(false);
            initialLoadCompleteRef.current = true;
        } else {
            setReloading(false);
        }
    }, [loadActivePath, loadPaths, loadPipelineStatus]);

    useEffect(() => {
        return registerProjectReloadListener(() => reloadAll());
    }, [registerProjectReloadListener, reloadAll]);

    useEffect(() => {
        void reloadAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only initial load; Reload button calls reloadAll directly
    }, []);

    useEffect(() => {
        const timer = window.setInterval(() => {
            void loadPipelineStatus();
        }, 2000);
        return () => window.clearInterval(timer);
    }, [loadPipelineStatus]);

    useEffect(() => {
        const activeFile = pathsList?.active_file;
        if (activeFile) {
            setCopyFileName(buildCopyTargetStem(activeFile));
            setRenameFileName(formatPathDisplayName(activeFile));
        }
    }, [pathsList?.active_file]);

    useEffect(() => {
        if (!autosavePendingRef.current || autosaveTick === 0) {
            return;
        }
        if (autosaveTimerRef.current != null) {
            window.clearTimeout(autosaveTimerRef.current);
        }
        autosaveTimerRef.current = window.setTimeout(() => {
            autosavePendingRef.current = false;
            void persistDocument({ silent: true });
        }, AUTOSAVE_DELAY_MS);
        return () => {
            if (autosaveTimerRef.current != null) {
                window.clearTimeout(autosaveTimerRef.current);
            }
        };
    }, [autosaveTick, persistDocument]);

    function scheduleAutosave() {
        autosavePendingRef.current = true;
        setAutosaveTick((value) => value + 1);
    }

    function handleSafeRoutesChange(nextRoutes: boolean[][]) {
        pushHistory();
        setSafeRoutes(normalizeIdSafeRoutes(safeRouteIds, nextRoutes));
    }

    function updatePointsCatalog(nextPoints: PathPoint[], options: { autosave?: boolean; history?: boolean } = {}) {
        const { autosave = false, history = true } = options;
        if (history) {
            pushHistory();
        }
        if (nextPoints.length < points.length) {
            const removed = points.find((point) => !nextPoints.some((candidate) => candidate.id === point.id));
            if (removed && nodes.some((node) => node.point_id === removed.id)) {
                setActionError(t.pathsPage.pointInUseCannotDelete);
                return;
            }
        }
        setActionError(null);
        const normalized = normalizePathDocument(
            {
                points: nextPoints,
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
        setPoints(normalized.points);
        setSafeRouteIds(normalized.safeRouteIds);
        setSafeRoutes(normalized.safeRoutes);
        if (autosave) {
            scheduleAutosave();
        }
    }

    function syncState(
        nextPoints: PathPoint[],
        nextNodes: PathNode[],
        options: { autosave?: boolean; history?: boolean } = {},
    ) {
        const { autosave = false, history: withHistory = true } = options;
        if (withHistory) {
            pushHistory();
        }
        const normalized = normalizePathDocument(
            {
                points: nextPoints,
                nodes: nextNodes,
                safe_route_ids: safeRouteIds,
                safe_routes: safeRoutes,
                per_point_exposure: perPointExposure,
                per_point_marker_exposure: perPointMarkerExposure,
                uniform_advanced_scan_rotations: uniformAdvancedScanRotations,
                uniform_advanced_scan_count: uniformAdvancedScanCount,
            },
            { preserveOrphanPoints: true },
        );
        setPoints(normalized.points);
        setNodes(normalized.nodes);
        setSafeRouteIds(normalized.safeRouteIds);
        setSafeRoutes(normalized.safeRoutes);
        if (autosave) {
            scheduleAutosave();
        }
    }

    function syncGraphState(nextNodes: PathNode[]) {
        const normalized = normalizePathDocument(
            {
                points,
                nodes: nextNodes,
                safe_route_ids: safeRouteIds,
                safe_routes: safeRoutes,
                per_point_exposure: perPointExposure,
                per_point_marker_exposure: perPointMarkerExposure,
                uniform_advanced_scan_rotations: uniformAdvancedScanRotations,
                uniform_advanced_scan_count: uniformAdvancedScanCount,
            },
            { preserveOrphanPoints: true },
        );
        setPoints(normalized.points);
        setNodes(normalized.nodes);
        setSafeRouteIds(normalized.safeRouteIds);
        setSafeRoutes(normalized.safeRoutes);
    }

    function handlePerPointExposureChange(checked: boolean) {
        pushHistory();
        setPerPointExposure(checked);
        if (checked) {
            setNodes((current) => seedScanNodesExposure(current, exposureSettings));
        }
    }

    function handlePerPointMarkerExposureChange(checked: boolean) {
        pushHistory();
        setPerPointMarkerExposure(checked);
        if (checked) {
            setNodes((current) => seedScanNodesExposure(current, exposureSettings));
        }
    }

    function handleUniformRotationsChange(checked: boolean) {
        pushHistory();
        setUniformAdvancedScanRotations(checked);
        if (!checked) {
            setRotationCountError(false);
        }
    }

    function applyRotationCountValue(raw: string) {
        const trimmed = raw.trim();
        if (!trimmed) {
            setUniformAdvancedScanCount(null);
            return;
        }
        const parsed = Number.parseInt(trimmed, 10);
        if (Number.isNaN(parsed) || parsed < 1) {
            setUniformAdvancedScanCount(null);
            return;
        }
        setUniformAdvancedScanCount(parsed);
        pushHistory();
        syncState(points, applyUniformScanCount(nodes, parsed), { history: false });
    }

    function handleRotationCountBlur() {
        if (!uniformAdvancedScanRotations) {
            setRotationCountError(false);
            return;
        }
        const trimmed = rotationCountInput.trim();
        if (!trimmed) {
            setRotationCountError(true);
            setUniformAdvancedScanCount(null);
            return;
        }
        setRotationCountError(false);
        applyRotationCountValue(trimmed);
    }

    function handlePointNameBlur(pointId: string, name: string) {
        const next = new Set(emptyNamePointIds);
        if (!name.trim()) {
            next.add(pointId);
        } else {
            next.delete(pointId);
        }
        setEmptyNamePointIds(next);
    }

    function handlePointChange(pointId: string, patch: Partial<PathPoint>) {
        updatePointsCatalog(updatePointById(points, pointId, patch));
    }

    function handleOptimize() {
        if (isLocked || !nodes.length) {
            return;
        }
        pushHistory();
        setActionError(null);
        syncState(points, layoutNodesLinear(linkNodeChain(optimizePathNodes(orderedNodes(nodes)))), {
            history: false,
        });
        setSuccess(t.pathsPage.optimizeSuccess);
    }

    async function handleSelectFile(filename: string) {
        if (!filename || isLocked) {
            return;
        }

        try {
            setSelecting(true);
            setActionError(null);
            setSuccess(null);
            history.clear();
            const data = await selectPath(filename);
            applyActivePath(data);
            setPathsList((prev) => (prev ? { ...prev, active_file: data.filename } : prev));
        } catch (err) {
            const message = err instanceof Error ? err.message : t.pathsPage.selectError;
            setActionError(message);
        } finally {
            setSelecting(false);
        }
    }

    async function handleSave() {
        if (isLocked || hasValidationErrors()) {
            if (hasValidationErrors()) {
                setActionError(t.pathsPage.emptyPointNameError);
            }
            return;
        }
        await persistDocument();
    }

    function handleUndo() {
        const snapshot = history.undo(buildSnapshot());
        if (snapshot) {
            applySnapshot(snapshot);
        }
    }

    function handleRedo() {
        const snapshot = history.redo(buildSnapshot());
        if (snapshot) {
            applySnapshot(snapshot);
        }
    }

    function handleAddPoint() {
        if (isLocked) {
            return;
        }
        const newPoint = createEmptyPoint(points);
        updatePointsCatalog([...points, newPoint], { history: true });
    }

    function handleAddNode() {
        if (isLocked || points.length === 0) {
            return;
        }
        pushHistory();
        const node = createEmptyNode(points, nodes, points[0].id);
        syncState(points, layoutNodesLinear(linkNodeChain([...nodes, node])), { history: false });
        setSelectedNodeId(node.id);
    }

    function handleGenerateNodes() {
        if (isLocked || points.length === 0) {
            return;
        }
        pushHistory();
        const nextNodes = generateNodesFromPoints(points);
        syncState(points, nextNodes, { history: false });
        setSelectedNodeId(nextNodes[0]?.id ?? null);
    }

    function handleNodeChange(updated: PathNode) {
        const nextNodes = applyNodeInspectorChange(nodes, updated);
        syncState(points, nextNodes, { autosave: true, history: true });
    }

    async function handleTouchUpPoint(pointId: string) {
        if (isLocked || touchUpPointId !== null) {
            return;
        }

        const point = points.find((item) => item.id === pointId);
        if (!point) {
            return;
        }

        try {
            setTouchUpPointId(pointId);
            setActionError(null);
            pushHistory();
            const axis = await fetchAxis();
            if (!axis.axes_available) {
                setActionError(t.pathsPage.touchUpNoData);
                return;
            }
            updatePointsCatalog(
                updatePointById(points, point.id, {
                    axes: {
                        J1: axis.a1!,
                        J2: axis.a2!,
                        J3: axis.a3!,
                        J4: axis.a4!,
                        J5: axis.a5!,
                        J6: axis.a6!,
                    },
                }),
                { history: false, autosave: true },
            );
            setSuccess(
                axis.connected ? t.pathsPage.touchUpSuccess : t.pathsPage.touchUpStaleSuccess,
            );
        } catch {
            setActionError(t.pathsPage.touchUpError);
        } finally {
            setTouchUpPointId(null);
        }
    }

    function handleDeleteNode(nodeId: string) {
        pushHistory();
        const nextNodes = nodes.filter((node) => node.id !== nodeId);
        syncState(points, nextNodes, { history: false });
        if (selectedNodeId === nodeId) {
            setSelectedNodeId(null);
        }
    }

    function handleDeletePoint(pointId: string) {
        if (!selectedNode) {
            return;
        }

        const usedByOtherNode = nodes.some(
            (node) => node.id !== selectedNode.id && node.point_id === pointId,
        );
        if (usedByOtherNode) {
            setActionError(t.pathsPage.pointInUseCannotDelete);
            return;
        }

        setActionError(null);
        pushHistory();

        const nextPoints = points.filter((point) => point.id !== pointId);
        if (nextPoints.length > 0) {
            const replacementId = nextPoints[0].id;
            const nextNodes = nodes.map((node) =>
                node.point_id === pointId ? { ...node, point_id: replacementId } : node,
            );
            syncState(nextPoints, nextNodes, { history: false });
            return;
        }

        const nextNodes = nodes.filter((node) => node.id !== selectedNode.id);
        syncState(nextPoints, nextNodes, { history: false });
        setSelectedNodeId(null);
    }

    function handleCopyNode(nodeId: string) {
        if (isLocked) {
            return;
        }
        pushHistory();
        const source = nodes.find((node) => node.id === nodeId);
        if (!source) {
            return;
        }
        const clone: PathNode = {
            ...structuredClone(source),
            id: nextFreeNodeId(nodes),
        };
        const chain = orderedNodes(nodes);
        const index = chain.findIndex((node) => node.id === nodeId);
        const nextNodes = [...chain.slice(0, index + 1), clone, ...chain.slice(index + 1)];
        syncState(points, nextNodes, { history: false });
        setSelectedNodeId(clone.id);
    }

    async function handleBrowseFolder() {
        if (isLocked || pickingFolder) {
            return;
        }
        try {
            setPickingFolder(true);
            setActionError(null);
            const result = await pickServerFolder();
            if (!result.cancelled && result.path) {
                setPathsFolderInput(result.path);
            }
        } catch {
            setActionError(t.pathsPage.browseFolderError);
        } finally {
            setPickingFolder(false);
        }
    }

    async function handleSaveFolder() {
        if (isLocked || !pathsFolderInput.trim()) {
            return;
        }
        try {
            setSavingFolder(true);
            setActionError(null);
            const nextSettings: RuntimeSettings = { ...runtimeSettings, paths_folder: pathsFolderInput.trim() };
            const saved = await saveSettingsSection(nextSettings, SETTINGS_SECTION_PATHS);
            setRuntimeSettings(saved.settings);
            setPathsFolderInput(saved.settings.paths_folder);
            await loadPaths();
            setSuccess(t.pathsPage.saveFolderSuccess);
        } catch (err) {
            setActionError(err instanceof Error ? err.message : t.pathsPage.saveFolderError);
        } finally {
            setSavingFolder(false);
        }
    }

    function resolveFilenameInput(raw: string): string | null {
        const error = validatePathBasename(raw);
        if (error) {
            return null;
        }
        return ensureJsonExtension(raw);
    }

    async function handleCreateFile() {
        const validation = validatePathBasename(newFileName);
        if (validation) {
            setNewFileNameError(t.pathsPage.invalidFileNameError);
            return;
        }
        setNewFileNameError(null);
        const targetFilename = resolveFilenameInput(newFileName);
        if (!targetFilename || isLocked) {
            return;
        }
        try {
            setCreating(true);
            history.clear();
            await createPath(targetFilename);
            await loadPaths();
            await handleSelectFile(targetFilename);
            setSuccess(t.pathsPage.createFileSuccess);
        } catch (err) {
            const message = err instanceof Error ? err.message : t.pathsPage.createFileError;
            setActionError(message.toLowerCase().includes("already exists") ? t.pathsPage.createFileExists : message);
        } finally {
            setCreating(false);
        }
    }

    async function handleCopyFile() {
        const activeFile = pathsList?.active_file;
        const validation = validatePathBasename(copyFileName);
        if (validation) {
            setCopyFileNameError(t.pathsPage.invalidFileNameError);
            return;
        }
        setCopyFileNameError(null);
        const targetFilename = resolveFilenameInput(copyFileName);
        if (!activeFile || !targetFilename || isLocked) {
            return;
        }
        try {
            setCopying(true);
            await copyPath(activeFile, targetFilename);
            await loadPaths();
            setSuccess(t.pathsPage.copyFileSuccess);
        } catch (err) {
            const message = err instanceof Error ? err.message : t.pathsPage.copyFileError;
            setActionError(message.toLowerCase().includes("already exists") ? t.pathsPage.copyFileExists : message);
        } finally {
            setCopying(false);
        }
    }

    async function handleDeleteFile() {
        const activeFile = pathsList?.active_file;
        if (!activeFile || isLocked) {
            return;
        }
        if (!window.confirm(t.pathsPage.deleteConfirm)) {
            return;
        }

        try {
            setDeleting(true);
            setActionError(null);
            setSuccess(null);
            await deletePath(activeFile);
            history.clear();
            await loadPaths();
            await applyActivePath(await fetchActivePath());
            setSuccess(t.pathsPage.deleteSuccess);
        } catch (err) {
            setActionError(err instanceof Error ? err.message : t.pathsPage.deleteError);
        } finally {
            setDeleting(false);
        }
    }

    async function handleRenameFile() {
        const activeFile = pathsList?.active_file;
        const validation = validatePathBasename(renameFileName);
        if (validation) {
            setRenameFileNameError(t.pathsPage.invalidFileNameError);
            return;
        }
        setRenameFileNameError(null);
        const targetFilename = resolveFilenameInput(renameFileName);
        if (!activeFile || !targetFilename || isLocked) {
            return;
        }
        if (targetFilename === activeFile) {
            return;
        }

        try {
            setRenaming(true);
            setActionError(null);
            setSuccess(null);
            await renamePath(activeFile, targetFilename);
            await loadPaths();
            await applyActivePath(await fetchActivePath());
            setRenameFileName(formatPathDisplayName(targetFilename));
            setSuccess(t.pathsPage.renameSuccess);
        } catch (err) {
            const message = err instanceof Error ? err.message : t.pathsPage.renameError;
            setActionError(message.toLowerCase().includes("already exists") ? t.pathsPage.renameExists : message);
        } finally {
            setRenaming(false);
        }
    }

    function formatTravelError(message: string): string {
        const lower = message.toLowerCase();
        if (lower.includes("not at a known position")) {
            return t.pathsPage.notAtKnownPosition;
        }
        if (lower.includes("no safe route")) {
            return t.pathsPage.noSafeRoute;
        }
        return message;
    }

    async function handleTravelToNode(nodeId: string) {
        if (isLocked || movingIndex !== null) {
            return;
        }
        const index = nodeIndexInChain(nodes, nodeId);
        if (index < 0) {
            return;
        }
        try {
            setMovingIndex(index);
            setActionError(null);
            setTravelSteps([]);
            const document = buildCurrentDocument();
            const result = await moveToPathPosition(index, document, nodeId);
            setTravelSteps(result.travel_steps ?? []);
            if (result.hops_executed > 1) {
                setSuccess(`${t.pathsPage.travelRouteSuccess}: ${result.route.join(" → ")}`);
            } else {
                setSuccess(t.pathsPage.travelToPositionSuccess);
            }
        } catch (err) {
            setTravelSteps([]);
            setActionError(formatTravelError(err instanceof Error ? err.message : t.pathsPage.travelToPositionError));
        } finally {
            setMovingIndex(null);
        }
    }

    if (loading && pathsList === null && points.length === 0) {
        return <div className="page">{t.dashboard.loading}</div>;
    }

    return (
        <div className="page paths-page">
            <div className="card">
                <div className="card-title">{t.pathsPage.title}</div>

                {loadError && <div className="error-text">{loadError}</div>}
                {actionError && <div className="error-text">{actionError}</div>}
                {success && <div className="accent-text">{success}</div>}
                {isLocked && <div className="paths-locked-banner">{t.pathsPage.lockedWhileRunning}</div>}

                <div className="paths-toolbar">
                    <div className="paths-meta">
                        <div><span className="paths-meta-label">{t.pathsPage.activeFile}</span><span className="paths-meta-value">{pathsList?.active_file ? formatPathDisplayName(pathsList.active_file) : "-"}</span></div>
                        <div><span className="paths-meta-label">{t.pathsPage.sourceNodes}</span><span className="paths-meta-value">{sourceCount ?? "-"}</span></div>
                        <div><span className="paths-meta-label">{t.pathsPage.expandedSteps}</span><span className="paths-meta-value">{expandedCount ?? "-"}</span></div>
                    </div>
                    <div className="paths-toolbar-row">
                        <label className="form-field paths-folder-field"><span>{t.pathsPage.pathsFolder}</span><input type="text" value={pathsFolderInput} disabled={isLocked || savingFolder} onChange={(e) => setPathsFolderInput(e.target.value)} /></label>
                        {isLocalServer && (
                            <button type="button" className="nav-btn" disabled={isLocked || savingFolder || pickingFolder} onClick={() => void handleBrowseFolder()}>{pickingFolder ? "…" : t.pathsPage.browseFolder}</button>
                        )}
                        <button type="button" className="nav-btn" disabled={isLocked || savingFolder || !pathsFolderInput.trim()} onClick={() => void handleSaveFolder()}>{t.pathsPage.saveFolder}</button>
                    </div>
                    {isLocalServer && <div className="paths-folder-hint">{t.pathsPage.browseFolderHint}</div>}
                    <div className="paths-toolbar-row">
                        <label className="form-field paths-file-select"><span>{t.pathsPage.selectFile}</span><select value={pathsList?.active_file ?? ""} disabled={isLocked || selecting || !pathsList?.files.length} onChange={(e) => void handleSelectFile(e.target.value)}>{!pathsList?.files.length ? <option value="">{t.pathsPage.noFiles}</option> : pathsList.files.map((file) => (<option key={file.name} value={file.name}>{formatPathDisplayName(file.name)}{file.source_position_count != null ? ` (${file.source_position_count})` : ""}</option>))}</select></label>
                        <button type="button" className="nav-btn" disabled={isLocked || deleting || renaming || !pathsList?.active_file} onClick={() => void handleDeleteFile()}>{t.pathsPage.deleteFile}</button>
                    </div>
                    <div className="paths-toolbar-row">
                        <label className="form-field paths-file-name-field"><span>{t.pathsPage.renameFileName}</span><input type="text" value={renameFileName} disabled={isLocked || renaming || !pathsList?.active_file} onChange={(e) => { setRenameFileName(e.target.value); setRenameFileNameError(null); }} onBlur={() => { if (validatePathBasename(renameFileName)) setRenameFileNameError(t.pathsPage.invalidFileNameError); }} />{renameFileNameError && <div className="field-error-text">{renameFileNameError}</div>}</label>
                        <button type="button" className="nav-btn" disabled={isLocked || renaming || !pathsList?.active_file || !renameFileName.trim()} onClick={() => void handleRenameFile()}>{t.pathsPage.renameFile}</button>
                    </div>
                    <div className="paths-toolbar-row">
                        <label className="form-field paths-file-name-field"><span>{t.pathsPage.newFileName}</span><input type="text" value={newFileName} disabled={isLocked || creating} onChange={(e) => { setNewFileName(e.target.value); setNewFileNameError(null); }} onBlur={() => { if (validatePathBasename(newFileName)) setNewFileNameError(t.pathsPage.invalidFileNameError); }} />{newFileNameError && <div className="field-error-text">{newFileNameError}</div>}</label>
                        <button type="button" className="nav-btn" disabled={isLocked || creating || !newFileName.trim()} onClick={() => void handleCreateFile()}>{t.pathsPage.createFile}</button>
                    </div>
                    <div className="paths-toolbar-row">
                        <label className="form-field paths-file-name-field"><span>{t.pathsPage.copyFileName}</span><input type="text" value={copyFileName} disabled={isLocked || copying || !pathsList?.active_file} onChange={(e) => { setCopyFileName(e.target.value); setCopyFileNameError(null); }} onBlur={() => { if (validatePathBasename(copyFileName)) setCopyFileNameError(t.pathsPage.invalidFileNameError); }} />{copyFileNameError && <div className="field-error-text">{copyFileNameError}</div>}</label>
                        <button type="button" className="nav-btn" disabled={isLocked || copying || !pathsList?.active_file || !copyFileName.trim()} onClick={() => void handleCopyFile()}>{t.pathsPage.copyFile}</button>
                    </div>
                </div>

                {manualExposureMode && (
                    <div className="paths-exposure-options">
                        <label className="checkbox-field">
                            <input type="checkbox" checked={perPointExposure} disabled={isLocked} onChange={(e) => handlePerPointExposureChange(e.target.checked)} />
                            <span>{t.pathsPage.perPointExposure}</span>
                        </label>
                        <label className="checkbox-field">
                            <input type="checkbox" checked={perPointMarkerExposure} disabled={isLocked} onChange={(e) => handlePerPointMarkerExposureChange(e.target.checked)} />
                            <span>{t.pathsPage.perPointMarkerExposure}</span>
                        </label>
                        <label className="checkbox-field">
                            <input type="checkbox" checked={uniformAdvancedScanRotations} disabled={isLocked} onChange={(e) => handleUniformRotationsChange(e.target.checked)} />
                            <span>{t.pathsPage.uniformAdvancedScanRotations}</span>
                        </label>
                        {uniformAdvancedScanRotations && (
                            <label className="form-field paths-exposure-count-field">
                                <span>{t.pathsPage.uniformAdvancedScanCount}</span>
                                <input
                                    type="number"
                                    min={1}
                                    step={1}
                                    className={rotationCountError ? "input-invalid" : ""}
                                    value={rotationCountInput}
                                    disabled={isLocked}
                                    onChange={(e) => {
                                        setRotationCountInput(e.target.value);
                                        setRotationCountError(false);
                                    }}
                                    onBlur={handleRotationCountBlur}
                                />
                                {rotationCountError && <div className="field-error-text">{t.pathsPage.emptyRotationCountError}</div>}
                            </label>
                        )}
                    </div>
                )}

                <SafeRoutesMatrix
                    points={points}
                    safeRouteIds={safeRouteIds}
                    safeRoutes={safeRoutes}
                    disabled={isLocked}
                    onChange={handleSafeRoutesChange}
                />

                <div className="path-workspace">
                    <PathNodeGraph
                        points={points}
                        nodes={nodes}
                        disabled={isLocked}
                        selectedNodeId={selectedNodeId}
                        onNodesChange={(nextNodes) => syncGraphState(nextNodes)}
                        onSelectNode={setSelectedNodeId}
                        historyControls={
                            <div className="path-history-controls">
                                <button
                                    type="button"
                                    className="path-history-btn"
                                    aria-label={t.pathsPage.undo}
                                    disabled={!history.canUndo || isLocked}
                                    onClick={handleUndo}
                                >
                                    ←
                                </button>
                                <button
                                    type="button"
                                    className="path-history-btn"
                                    aria-label={t.pathsPage.redo}
                                    disabled={!history.canRedo || isLocked}
                                    onClick={handleRedo}
                                >
                                    →
                                </button>
                            </div>
                        }
                    />
                    <div className="node-inspector-column">
                        <NodeInspector
                            node={selectedNode}
                            points={points}
                            disabled={isLocked}
                            movingIndex={movingIndex}
                            touchUpPointId={touchUpPointId}
                            emptyNamePointIds={emptyNamePointIds}
                            exposureMode={exposureSettings.mode}
                            customizedSlots={exposureSettings.customized_slots}
                            globalExposureDefaults={exposureSettings}
                            perPointExposure={perPointExposure}
                            perPointMarkerExposure={perPointMarkerExposure}
                            uniformAdvancedScanRotations={uniformAdvancedScanRotations}
                            onChange={handleNodeChange}
                            onPointChange={handlePointChange}
                            onPointNameBlur={handlePointNameBlur}
                            onDelete={selectedNode ? () => handleDeleteNode(selectedNode.id) : undefined}
                            onDeletePoint={
                                selectedNode
                                    ? () => handleDeletePoint(selectedNode.point_id)
                                    : undefined
                            }
                            onCopy={selectedNode ? () => handleCopyNode(selectedNode.id) : undefined}
                            onMoveTo={selectedNode ? () => void handleTravelToNode(selectedNode.id) : undefined}
                            onTouchUp={
                                selectedNode
                                    ? () => void handleTouchUpPoint(selectedNode.point_id)
                                    : undefined
                            }
                        />
                        <TravelRouteTable steps={travelSteps} />
                    </div>
                </div>

                <div className="actions-row">
                    <button type="button" className="nav-btn" disabled={isLocked} onClick={handleAddPoint}>{t.pathsPage.addPoint}</button>
                    <button type="button" className="nav-btn" disabled={isLocked || points.length === 0} onClick={handleAddNode}>{t.pathsPage.addNode}</button>
                    <button type="button" className="nav-btn" disabled={isLocked || points.length === 0} onClick={handleGenerateNodes}>{t.pathsPage.generateNodes}</button>
                    <button type="button" className="nav-btn" disabled={loading || reloading || saving || selecting} onClick={() => void reloadAll()}>{reloading ? t.dashboard.loading : t.pathsPage.reload}</button>
                    <button type="button" className="nav-btn" disabled={isLocked || !nodes.length} onClick={handleOptimize}>{t.pathsPage.optimize}</button>
                    <button type="button" className="nav-btn active" disabled={isLocked || saving || selecting || !nodes.length || hasValidationErrors()} onClick={() => void handleSave()}>{t.pathsPage.save}</button>
                </div>
            </div>
        </div>
    );
}
