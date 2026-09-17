import { useCallback, useEffect, useState } from "react";
import {
    createProject,
    deleteProject,
    fetchActiveProject,
    fetchProjects,
    loadProject,
    renameProject,
    saveProject,
    setActiveProject,
} from "../api/client";
import { useI18n } from "../i18n/useI18n";
import { useProjectSaveRegistry } from "../project/ProjectSaveContext";

export function SavedProjectSection() {
    const { t } = useI18n();
    const { activeProjectName, getSettings, notifyProjectReload, setActiveProjectName } =
        useProjectSaveRegistry();

    const [projects, setProjects] = useState<string[]>([]);
    const [selectedProject, setSelectedProject] = useState<string | null>(null);
    const [nameInput, setNameInput] = useState("");
    const [renameInput, setRenameInput] = useState("");
    const [message, setMessage] = useState<string | null>(null);
    const [isError, setIsError] = useState(false);
    const [saving, setSaving] = useState(false);
    const [creating, setCreating] = useState(false);
    const [loadingProject, setLoadingProject] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [renaming, setRenaming] = useState(false);
    const [pendingCreateOverwrite, setPendingCreateOverwrite] = useState(false);
    const [pendingDelete, setPendingDelete] = useState(false);
    const [deleteTrajectory, setDeleteTrajectory] = useState(false);

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
                setSelectedProject(active.name);
                setNameInput(active.name ?? "");
                setRenameInput(active.name ?? "");
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
        setPendingCreateOverwrite(false);
        setPendingDelete(false);

        if (!selectedProject) {
            try {
                setLoadingProject(true);
                await setActiveProject(null);
                setNameInput("");
                setRenameInput("");
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
            await loadProject(selectedProject);
            await notifyProjectReload();
            setNameInput(selectedProject);
            setRenameInput(selectedProject);
            setActiveProjectName(selectedProject);
            await refreshProjects();
            setMessage(t.project.loadSuccess);
        } catch (err) {
            setMessage(err instanceof Error ? err.message : t.project.loadError);
            setIsError(true);
        } finally {
            setLoadingProject(false);
        }
    }

    async function performCreate(overwrite: boolean) {
        const name = nameInput.trim();
        if (!name) {
            setMessage(t.project.nameRequired);
            setIsError(true);
            return;
        }

        try {
            setCreating(true);
            setMessage(null);
            setIsError(false);
            setPendingCreateOverwrite(false);

            const created = await createProject({ name, overwrite });

            setSelectedProject(created.name);
            setNameInput(created.name);
            setRenameInput(created.name);
            setActiveProjectName(created.name);
            await refreshProjects();
            await notifyProjectReload();
            setMessage(t.project.createSuccess);
        } catch (err) {
            const text = err instanceof Error ? err.message : t.project.createError;
            if (!overwrite && text.toLowerCase().includes("already exists")) {
                setPendingCreateOverwrite(true);
                setMessage(t.project.overwriteConfirm);
                setIsError(false);
                return;
            }
            setMessage(text);
            setIsError(true);
        } finally {
            setCreating(false);
        }
    }

    async function performSaveSettings() {
        const name = activeProjectName ?? selectedProject;
        if (!name) {
            setMessage(t.project.noActiveProject);
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

            await saveProject({
                name,
                overwrite: true,
                settings,
            });

            setSelectedProject(name);
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

    async function performDelete() {
        const name = selectedProject ?? activeProjectName;
        if (!name) {
            return;
        }

        try {
            setDeleting(true);
            setMessage(null);
            setIsError(false);
            setPendingDelete(false);

            await deleteProject(name, { delete_trajectory: deleteTrajectory });

            if (activeProjectName === name) {
                setActiveProjectName(null);
            }
            if (selectedProject === name) {
                setSelectedProject(null);
                setNameInput("");
                setRenameInput("");
            }
            setDeleteTrajectory(false);
            await refreshProjects();
            await notifyProjectReload();
            setMessage(t.project.deleteSuccess);
        } catch (err) {
            setMessage(err instanceof Error ? err.message : t.project.deleteError);
            setIsError(true);
        } finally {
            setDeleting(false);
        }
    }

    async function performRename() {
        const name = selectedProject ?? activeProjectName;
        const newName = renameInput.trim();
        if (!name) {
            setMessage(t.project.noActiveProject);
            setIsError(true);
            return;
        }
        if (!newName) {
            setMessage(t.project.renameRequired);
            setIsError(true);
            return;
        }
        if (newName === name) {
            return;
        }

        try {
            setRenaming(true);
            setMessage(null);
            setIsError(false);

            const renamed = await renameProject(name, { new_name: newName });

            setSelectedProject(renamed.name);
            setNameInput(renamed.name);
            setRenameInput(renamed.name);
            if (activeProjectName === name) {
                setActiveProjectName(renamed.name);
            }
            await refreshProjects();
            await notifyProjectReload();
            setMessage(t.project.renameSuccess);
        } catch (err) {
            setMessage(err instanceof Error ? err.message : t.project.renameError);
            setIsError(true);
        } finally {
            setRenaming(false);
        }
    }

    const busy = saving || creating || loadingProject || deleting || renaming;

    return (
        <section className="saved-project-section">
            <div className="saved-project-section-header">
                <span className="saved-project-section-title">{t.project.sectionTitle}</span>
            </div>

            <label className="form-field saved-project-name-field">
                <span>{t.project.nameField}</span>
                <input
                    type="text"
                    className="saved-project-name-input"
                    value={nameInput}
                    disabled={busy}
                    onChange={(event) => {
                        setNameInput(event.target.value);
                        setPendingCreateOverwrite(false);
                    }}
                    placeholder={t.project.namePrompt}
                />
            </label>

            <div className="saved-project-actions">
                <button
                    type="button"
                    className="nav-btn active"
                    disabled={busy || !nameInput.trim()}
                    onClick={() => void performCreate(false)}
                >
                    {t.project.createProject}
                </button>

                {pendingCreateOverwrite && (
                    <div className="saved-project-overwrite-row">
                        <button
                            type="button"
                            className="nav-btn active"
                            disabled={busy}
                            onClick={() => void performCreate(true)}
                        >
                            {t.project.overwriteConfirmAction}
                        </button>
                        <button
                            type="button"
                            className="nav-btn"
                            disabled={busy}
                            onClick={() => {
                                setPendingCreateOverwrite(false);
                                setMessage(null);
                            }}
                        >
                            {t.project.overwriteCancel}
                        </button>
                    </div>
                )}
            </div>

            <div className="project-load-row">
                <label className="form-field project-load-field">
                    <span>{t.project.selectProjectLabel}</span>
                    <select
                        value={selectedProject ?? ""}
                        disabled={busy}
                        onChange={(event) => {
                            const value = event.target.value || null;
                            setSelectedProject(value);
                            setRenameInput(value ?? "");
                            setPendingDelete(false);
                            setMessage(null);
                            setIsError(false);
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
                    disabled={busy}
                    onClick={() => void handleLoadClick()}
                >
                    {t.project.loadProject}
                </button>
            </div>

            <div className="saved-project-actions">
                <button
                    type="button"
                    className="nav-btn active"
                    disabled={busy || !(activeProjectName ?? selectedProject)}
                    onClick={() => void performSaveSettings()}
                >
                    {t.project.saveProject}
                </button>
            </div>

            <label className="form-field saved-project-name-field">
                <span>{t.project.renameProject}</span>
                <input
                    type="text"
                    className="saved-project-name-input"
                    value={renameInput}
                    disabled={busy || !(selectedProject ?? activeProjectName)}
                    onChange={(event) => setRenameInput(event.target.value)}
                    placeholder={t.project.namePrompt}
                />
            </label>

            <div className="saved-project-actions">
                <button
                    type="button"
                    className="nav-btn"
                    disabled={busy || !(selectedProject ?? activeProjectName)}
                    onClick={() => void performRename()}
                >
                    {t.project.renameProject}
                </button>

                <button
                    type="button"
                    className="nav-btn"
                    disabled={busy || !(selectedProject ?? activeProjectName)}
                    onClick={() => {
                        setPendingDelete(true);
                        setDeleteTrajectory(false);
                        setMessage(t.project.deleteConfirm);
                        setIsError(false);
                    }}
                >
                    {t.project.deleteProject}
                </button>
            </div>

            {pendingDelete && (
                <div className="saved-project-overwrite-row">
                    <label className="checkbox-field">
                        <input
                            type="checkbox"
                            checked={deleteTrajectory}
                            disabled={busy}
                            onChange={(event) => setDeleteTrajectory(event.target.checked)}
                        />
                        <span>{t.project.deleteTrajectoryCheckbox}</span>
                    </label>
                    <button
                        type="button"
                        className="nav-btn active"
                        disabled={busy}
                        onClick={() => void performDelete()}
                    >
                        {t.project.overwriteConfirmAction}
                    </button>
                    <button
                        type="button"
                        className="nav-btn"
                        disabled={busy}
                        onClick={() => {
                            setPendingDelete(false);
                            setDeleteTrajectory(false);
                            setMessage(null);
                        }}
                    >
                        {t.project.overwriteCancel}
                    </button>
                </div>
            )}

            {message && (
                <div className={isError ? "error-text saved-project-message" : "accent-text saved-project-message"}>
                    {message}
                </div>
            )}
        </section>
    );
}
