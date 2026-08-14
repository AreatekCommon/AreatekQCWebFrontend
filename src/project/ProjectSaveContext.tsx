import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { fetchActiveProject } from "../api/client";
import type { PathDocument, RuntimeSettings } from "../types/api";

type SettingsGetter = () => RuntimeSettings | null;
type PathDocumentGetter = () => PathDocument | null;
type ProjectReloadListener = () => void | Promise<void>;

type ProjectSaveContextValue = {
    activeProjectName: string | null;
    setActiveProjectName: (name: string | null) => void;
    registerSettingsGetter: (getter: SettingsGetter | null) => void;
    registerPathDocumentGetter: (getter: PathDocumentGetter | null) => void;
    registerProjectReloadListener: (listener: ProjectReloadListener) => () => void;
    getSettings: () => RuntimeSettings | null;
    getPathDocument: () => PathDocument | null;
    notifyProjectReload: () => Promise<void>;
};

const ProjectSaveContext = createContext<ProjectSaveContextValue | null>(null);

export function ProjectSaveProvider({ children }: { children: ReactNode }) {
    const settingsGetterRef = useRef<SettingsGetter | null>(null);
    const pathGetterRef = useRef<PathDocumentGetter | null>(null);
    const reloadListenersRef = useRef<Set<ProjectReloadListener>>(new Set());
    const [activeProjectName, setActiveProjectName] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function hydrateActiveProject() {
            try {
                const active = await fetchActiveProject();
                if (!cancelled) {
                    setActiveProjectName(active.name);
                }
            } catch {
                // Keep null when backend is unavailable.
            }
        }

        void hydrateActiveProject();
        return () => {
            cancelled = true;
        };
    }, []);

    const registerSettingsGetter = useCallback((getter: SettingsGetter | null) => {
        settingsGetterRef.current = getter;
    }, []);

    const registerPathDocumentGetter = useCallback((getter: PathDocumentGetter | null) => {
        pathGetterRef.current = getter;
    }, []);

    const registerProjectReloadListener = useCallback((listener: ProjectReloadListener) => {
        reloadListenersRef.current.add(listener);
        return () => {
            reloadListenersRef.current.delete(listener);
        };
    }, []);

    const getSettings = useCallback(() => settingsGetterRef.current?.() ?? null, []);
    const getPathDocument = useCallback(() => pathGetterRef.current?.() ?? null, []);

    const notifyProjectReload = useCallback(async () => {
        await Promise.all(
            Array.from(reloadListenersRef.current).map((listener) => Promise.resolve(listener())),
        );
    }, []);

    const value = useMemo(
        () => ({
            activeProjectName,
            setActiveProjectName,
            registerSettingsGetter,
            registerPathDocumentGetter,
            registerProjectReloadListener,
            getSettings,
            getPathDocument,
            notifyProjectReload,
        }),
        [
            activeProjectName,
            registerSettingsGetter,
            registerPathDocumentGetter,
            registerProjectReloadListener,
            getSettings,
            getPathDocument,
            notifyProjectReload,
        ],
    );

    return <ProjectSaveContext.Provider value={value}>{children}</ProjectSaveContext.Provider>;
}

export function useProjectSaveRegistry() {
    const context = useContext(ProjectSaveContext);
    if (!context) {
        throw new Error("useProjectSaveRegistry must be used inside ProjectSaveProvider");
    }
    return context;
}
