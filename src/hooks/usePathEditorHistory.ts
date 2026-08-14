import { useCallback, useMemo, useRef, useState } from "react";
import type { PathNode, PathPoint } from "../types/api";

export type PathEditorSnapshot = {
    points: PathPoint[];
    nodes: PathNode[];
    safeRouteIds: string[];
    safeRoutes: boolean[][];
    perPointExposure: boolean;
    perPointMarkerExposure: boolean;
    uniformAdvancedScanRotations: boolean;
    uniformAdvancedScanCount: number | null;
};

const MAX_HISTORY = 50;

function cloneSnapshot(snapshot: PathEditorSnapshot): PathEditorSnapshot {
    return structuredClone(snapshot);
}

export function usePathEditorHistory() {
    const undoStackRef = useRef<PathEditorSnapshot[]>([]);
    const redoStackRef = useRef<PathEditorSnapshot[]>([]);
    const [revision, setRevision] = useState(0);

    const bump = useCallback(() => {
        setRevision((value) => value + 1);
    }, []);

    const clear = useCallback(() => {
        undoStackRef.current = [];
        redoStackRef.current = [];
        bump();
    }, [bump]);

    const pushSnapshot = useCallback(
        (snapshot: PathEditorSnapshot) => {
            const stack = undoStackRef.current;
            stack.push(cloneSnapshot(snapshot));
            if (stack.length > MAX_HISTORY) {
                stack.shift();
            }
            redoStackRef.current = [];
            bump();
        },
        [bump],
    );

    const undo = useCallback((current: PathEditorSnapshot): PathEditorSnapshot | null => {
        const stack = undoStackRef.current;
        if (!stack.length) {
            return null;
        }
        const previous = stack.pop()!;
        redoStackRef.current.push(cloneSnapshot(current));
        bump();
        return previous;
    }, [bump]);

    const redo = useCallback((current: PathEditorSnapshot): PathEditorSnapshot | null => {
        const stack = redoStackRef.current;
        if (!stack.length) {
            return null;
        }
        const next = stack.pop()!;
        undoStackRef.current.push(cloneSnapshot(current));
        bump();
        return next;
    }, [bump]);

    const canUndo = revision >= 0 && undoStackRef.current.length > 0;
    const canRedo = revision >= 0 && redoStackRef.current.length > 0;

    return useMemo(
        () => ({
            pushSnapshot,
            undo,
            redo,
            clear,
            canUndo,
            canRedo,
        }),
        [pushSnapshot, undo, redo, clear, canUndo, canRedo],
    );
}
