import { useCallback, useEffect, useState } from "react";
import {
    fetchActiveProject,
    fetchProjectExists,
    fetchProjects,
    loadProject,
    saveProject,
    setActiveProject,
} from "../api/client";
import { useI18n } from "../i18n/useI18n";
import { useProjectSaveRegistry } from "../project/ProjectSaveContext";

export function SavedProjectSection() {
    const { t } = useI18n();
    const { getSettings, notifyProjectReload, setActiveProjectName } =
        useProjectSaveRegistry();

    const [projects, setProjects] = useState<string[]>([]);
    const [selectedName, setSelectedName] = useState<string | null>(null);
    const [nameInput, setNameInput] = useState("");
    const [message, setMessage] = useState<string | null>(null);
    const [isError, setIsError] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loadingProject, setLoadingProject] = useState(false);
    const [pendingOverwrite, setPendingOverwrite] = useState(false);

    const refreshProjects = useCallback(async () => {
        const list = await fetchProjects();
        setProjects(list.projects);
    }, []);

    useEffect(() => {
        let cancelled = false;

        async function init() {
            try {
                const [list, active] = await Promise.all([fetchProjects(), fetchActiveProject()]);
                if (cancelled) {
                    return;
                }
                setProjects(list.projects);
                setSelectedName(active.name);
                setNameInput(active.name ?? "");
                setActiveProjectName(active.name);
            } catch {
                if (!cancelled) {
                    setMessage(t.project.loadError);
                    setIsError(true);
                }
            }
        }

        void init();
        return () => {
            cancelled = true;
        };
    }, [setActiveProjectName, t.project.loadError]);

    async function handleLoadClick() {
        setMessage(null);
        setIsError(false);
        setPendingOverwrite(false);

        if (!selectedName) {
            try {
                setLoadingProject(true);
                await setActiveProject(null);
                setNameInput("");
                setActiveProjectName(null);
                setMessage(t.project.unloadSuccess);
            } catch (err) {
                setMessage(err instanceof Error ? err.message : t.project.loadError);
                setIsError(true);
            } finally {
                setLoadingProject(false);
            }
            return;
        }

        try {
            setLoadingProject(true);
            await loadProject(selectedName);
            await notifyProjectReload();
            setNameInput(selectedName);
            setActiveProjectName(selectedName);
            await refreshProjects();
            setMessage(t.project.loadSuccess);
        } catch (err) {
            setMessage(err instanceof Error ? err.message : t.project.loadError);
            setIsError(true);
        } finally {
            setLoadingProject(false);
        }
    }

    async function performSave(overwrite: boolean) {
        const name = nameInput.trim();
        if (!name) {
            setMessage(t.project.nameRequired);
            setIsError(true);
            return;
        }

        const settings = getSettings();
        if (!settings) {
            setMessage(t.project.settingsUnavailable);
            setIsError(true);
            return;
        }

        try {
            setSaving(true);
            setMessage(null);
            setIsError(false);
            setPendingOverwrite(false);

            await saveProject({
                name,
                overwrite,
                settings,
            });

            setSelectedName(name);
            setActiveProjectName(name);
            await refreshProjects();
            setMessage(t.project.saveSuccess);
        } catch (err) {
            setMessage(err instanceof Error ? err.message : t.project.saveError);
            setIsError(true);
        } finally {
            setSaving(false);
        }
    }

    async function handleSaveAsClick() {
        const name = nameInput.trim();
        if (!name) {
            setMessage(t.project.nameRequired);
            setIsError(true);
            return;
        }

        try {
            const existing = await fetchProjectExists(name);
            if (existing.exists) {
                setPendingOverwrite(true);
                setMessage(t.project.overwriteConfirm);
                setIsError(false);
                return;
            }
        } catch (err) {
            setMessage(err instanceof Error ? err.message : t.project.saveError);
            setIsError(true);
            return;
        }

        await performSave(false);
    }

    return (
        <section className="saved-project-section">
            <div className="saved-project-section-header">
                <span className="saved-project-section-title">{t.project.sectionTitle}</span>
            </div>

            <div className="project-load-row">
                <label className="form-field project-load-field">
                    <span>{t.project.selectProjectLabel}</span>
                    <select
                        value={selectedName ?? ""}
                        disabled={loadingProject || saving}
                        onChange={(event) => {
                            setSelectedName(event.target.value || null);
                            setMessage(null);
                            setIsError(false);
                            setPendingOverwrite(false);
                        }}
                    >
                        <option value="">{t.project.noProject}</option>
                        {projects.map((projectName) => (
                            <option key={projectName} value={projectName}>
                                {projectName}
                            </option>
                        ))}
                    </select>
                </label>

                <button
                    type="button"
                    className="nav-btn active project-load-button"
                    disabled={loadingProject || saving}
                    onClick={() => void handleLoadClick()}
                >
                    {t.project.loadProject}
                </button>
            </div>

            <label className="form-field saved-project-name-field">
                <span>{t.project.nameField}</span>
                <input
                    type="text"
                    className="saved-project-name-input"
                    value={nameInput}
                    disabled={loadingProject || saving}
                    onChange={(event) => {
                        setNameInput(event.target.value);
                        setPendingOverwrite(false);
                    }}
                    placeholder={t.project.namePrompt}
                />
            </label>

            <div className="saved-project-actions">
                <button
                    type="button"
                    className="nav-btn active"
                    disabled={saving || loadingProject}
                    onClick={() => void handleSaveAsClick()}
                >
                    {t.project.saveAs}
                </button>

                {pendingOverwrite && (
                    <div className="saved-project-overwrite-row">
                        <button
                            type="button"
                            className="nav-btn active"
                            disabled={saving || loadingProject}
                            onClick={() => void performSave(true)}
                        >
                            {t.project.overwriteConfirmAction}
                        </button>
                        <button
                            type="button"
                            className="nav-btn"
                            disabled={saving || loadingProject}
                            onClick={() => {
                                setPendingOverwrite(false);
                                setMessage(null);
                            }}
                        >
                            {t.project.overwriteCancel}
                        </button>
                    </div>
                )}
            </div>

            {message && (
                <div className={isError ? "error-text saved-project-message" : "accent-text saved-project-message"}>
                    {message}
                </div>
            )}
        </section>
    );
}
