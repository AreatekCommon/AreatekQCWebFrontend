import type {
    ActivePathResponse,
    AxisSnapshot,
    CycleHistoryResponse,
    HealthResponse,
    LogsResponse,
    PathDocument,
    PathMoveToResponse,
    PathsListResponse,
    PipelineStatus,
    ProjectExistsResponse,
    ProjectListResponse,
    ProjectLoadResponse,
    ProjectFromTrajectoryRequest,
    ProjectFromTrajectoryResponse,
    ProjectCreateRequest,
    ProjectCreateResponse,
    ProjectDeleteRequest,
    ProjectRenameRequest,
    ProjectSaveRequest,
    ProjectSaveResponse,
    ActiveProjectResponse,
    RuntimeSettings,
    SettingsUpdateResponse,
    MarkerListResponse,
    TrajectoryResponse,
} from "../types/api";
import type { SettingsSectionId } from "../utils/settingsSections";

const API_BASE_URL = "http://127.0.0.1:8000";

export function isLocalApiServer(): boolean {
    try {
        const hostname = new URL(API_BASE_URL).hostname.toLowerCase();
        return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
    } catch {
        return false;
    }
}

export type HostInfoResponse = {
    hostname: string;
    platform: string;
};

export type PickFolderResponse = {
    cancelled: boolean;
    path: string | null;
};

export async function fetchHostInfo(): Promise<HostInfoResponse> {
    const response = await fetch(`${API_BASE_URL}/system/host-info`);
    if (!response.ok) {
        throw new Error(`Host info request failed: ${response.status}`);
    }
    return response.json();
}

export async function pickServerFolder(): Promise<PickFolderResponse> {
    const response = await fetch(`${API_BASE_URL}/system/pick-folder`, { method: "POST" });
    if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(body?.detail ?? `Folder picker failed: ${response.status}`);
    }
    return response.json();
}

export async function pickServerFile(): Promise<PickFolderResponse> {
    const response = await fetch(`${API_BASE_URL}/system/pick-file`, { method: "POST" });
    if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(body?.detail ?? `File picker failed: ${response.status}`);
    }
    return response.json();
}

export async function setUiLocale(locale: "en" | "ru"): Promise<{ locale: string }> {
    const response = await fetch(`${API_BASE_URL}/system/ui-locale`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
    });

    if (!response.ok) {
        throw new Error(`UI locale update failed: ${response.status}`);
    }

    return response.json();
}

export async function fetchHealth(): Promise<HealthResponse> {
    const response = await fetch(`${API_BASE_URL}/health`);

    if (!response.ok) {
        throw new Error(`Health request failed: ${response.status}`);
    }

    return response.json();
}

export async function fetchSettings(): Promise<RuntimeSettings> {
    const response = await fetch(`${API_BASE_URL}/settings`);

    if (!response.ok) {
        throw new Error(`Settings request failed: ${response.status}`);
    }

    return response.json();
}

export async function saveSettings(
    payload: RuntimeSettings
): Promise<RuntimeSettings> {
    const response = await saveSettingsSection(payload, null);
    return response.settings;
}

export async function saveSettingsSection(
    settings: RuntimeSettings,
    applySection: SettingsSectionId | null
): Promise<SettingsUpdateResponse> {
    const response = await fetch(`${API_BASE_URL}/settings`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            settings,
            apply_section: applySection,
        }),
    });

    if (!response.ok) {
        throw new Error(`Settings save failed: ${response.status}`);
    }

    return response.json();
}
export async function fetchLogs(limit = 150): Promise<LogsResponse> {
    const response = await fetch(`${API_BASE_URL}/logs?limit=${limit}`);

    if (!response.ok) {
        throw new Error(`Logs request failed: ${response.status}`);
    }

    return response.json();
}

export async function fetchAxis(): Promise<AxisSnapshot> {
    const response = await fetch(`${API_BASE_URL}/axis`);

    if (!response.ok) {
        throw new Error(`Axis request failed: ${response.status}`);
    }

    return response.json();
}

export async function fetchTrajectory(): Promise<TrajectoryResponse> {
    const response = await fetch(`${API_BASE_URL}/trajectory`);

    if (!response.ok) {
        throw new Error(`Trajectory request failed: ${response.status}`);
    }

    return response.json();
}

export async function fetchPipelineStatus(): Promise<PipelineStatus> {
    const response = await fetch(`${API_BASE_URL}/pipeline/status`);

    if (!response.ok) {
        throw new Error(`Pipeline status request failed: ${response.status}`);
    }

    return response.json();
}

export async function fetchCycleHistory(): Promise<CycleHistoryResponse> {
    const response = await fetch(`${API_BASE_URL}/pipeline/cycle-history`);

    if (!response.ok) {
        throw new Error(`Cycle history request failed: ${response.status}`);
    }

    return response.json();
}

export async function startPipeline(): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/pipeline/start`, {
        method: "POST",
    });

    if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(body?.detail ?? `Pipeline start failed: ${response.status}`);
    }
}

export async function startCalibrationPipeline(): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/pipeline/calibration/start`, {
        method: "POST",
    });

    if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(body?.detail ?? `Calibration start failed: ${response.status}`);
    }
}

export async function stopPipeline(): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/pipeline/stop`, {
        method: "POST",
    });

    if (!response.ok) {
        throw new Error(`Pipeline stop failed: ${response.status}`);
    }
}

export async function continuePipeline(): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/pipeline/continue`, {
        method: "POST",
    });

    if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(body?.detail ?? `Pipeline continue failed: ${response.status}`);
    }
}

export async function reloadScannerSdk(): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/pipeline/scanner/reload`, {
        method: "POST",
    });

    if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(body?.detail ?? `Scanner SDK reload failed: ${response.status}`);
    }
}

export async function reconnectScanner(): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/pipeline/scanner/reconnect`, {
        method: "POST",
    });

    if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(body?.detail ?? `Scanner reconnect failed: ${response.status}`);
    }
}

export async function fetchPaths(): Promise<PathsListResponse> {
    const response = await fetch(`${API_BASE_URL}/paths`);

    if (!response.ok) {
        throw new Error(`Paths request failed: ${response.status}`);
    }

    return response.json();
}

export async function selectPath(filename: string): Promise<ActivePathResponse> {
    const response = await fetch(`${API_BASE_URL}/paths/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename }),
    });

    if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(body?.detail ?? `Path select failed: ${response.status}`);
    }

    return response.json();
}

export async function fetchActivePath(): Promise<ActivePathResponse> {
    const response = await fetch(`${API_BASE_URL}/paths/active`);

    if (!response.ok) {
        throw new Error(`Active path request failed: ${response.status}`);
    }

    return response.json();
}

export async function saveActivePath(document: PathDocument): Promise<ActivePathResponse> {
    const response = await fetch(`${API_BASE_URL}/paths/active`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document }),
    });

    if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(body?.detail ?? `Path save failed: ${response.status}`);
    }

    return response.json();
}

export async function copyPath(
    sourceFilename: string,
    targetFilename: string
): Promise<{ filename: string }> {
    const response = await fetch(`${API_BASE_URL}/paths/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            source_filename: sourceFilename,
            target_filename: targetFilename,
        }),
    });

    if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(body?.detail ?? `Path copy failed: ${response.status}`);
    }

    return response.json();
}

export async function createPath(filename: string): Promise<{ filename: string }> {
    const response = await fetch(`${API_BASE_URL}/paths/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename }),
    });

    if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(body?.detail ?? `Path create failed: ${response.status}`);
    }

    return response.json();
}

export async function deletePath(filename: string): Promise<{ filename: string; active_file: string }> {
    const response = await fetch(`${API_BASE_URL}/paths/${encodeURIComponent(filename)}`, {
        method: "DELETE",
    });

    if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(body?.detail ?? `Path delete failed: ${response.status}`);
    }

    return response.json();
}

export async function renamePath(
    sourceFilename: string,
    targetFilename: string,
): Promise<{ filename: string; active_file: string }> {
    const response = await fetch(`${API_BASE_URL}/paths/rename`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            source_filename: sourceFilename,
            target_filename: targetFilename,
        }),
    });

    if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(body?.detail ?? `Path rename failed: ${response.status}`);
    }

    return response.json();
}

export async function moveToPathPosition(
    positionIndex: number,
    document: PathDocument,
    nodeId?: string,
    startPointId?: string,
): Promise<PathMoveToResponse> {
    const response = await fetch(`${API_BASE_URL}/paths/active/move-to`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            position_index: positionIndex,
            node_id: nodeId ?? null,
            document,
            start_point_id: startPointId ?? null,
        }),
    });

    if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(body?.detail ?? `Travel to position failed: ${response.status}`);
    }

    return response.json();
}

export async function fetchMarkers(): Promise<MarkerListResponse> {
    const response = await fetch(`${API_BASE_URL}/markers`);

    if (!response.ok) {
        throw new Error(`Markers list failed: ${response.status}`);
    }

    return response.json();
}

export async function fetchProjects(): Promise<ProjectListResponse> {
    const response = await fetch(`${API_BASE_URL}/projects`);

    if (!response.ok) {
        throw new Error(`Projects list failed: ${response.status}`);
    }

    return response.json();
}

export async function fetchProjectExists(name: string): Promise<ProjectExistsResponse> {
    const response = await fetch(`${API_BASE_URL}/projects/${encodeURIComponent(name)}`);

    if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(body?.detail ?? `Project exists check failed: ${response.status}`);
    }

    return response.json();
}

export async function saveProject(payload: ProjectSaveRequest): Promise<ProjectSaveResponse> {
    const response = await fetch(`${API_BASE_URL}/projects/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        if (response.status === 409) {
            throw new Error(body?.detail ?? "Project already exists");
        }
        throw new Error(body?.detail ?? `Project save failed: ${response.status}`);
    }

    return response.json();
}

export async function createProject(
    payload: ProjectCreateRequest,
): Promise<ProjectCreateResponse> {
    const response = await fetch(`${API_BASE_URL}/projects/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        if (response.status === 409) {
            throw new Error(body?.detail ?? "Project already exists");
        }
        throw new Error(body?.detail ?? `Project create failed: ${response.status}`);
    }

    return response.json();
}

export async function deleteProject(
    name: string,
    payload: ProjectDeleteRequest,
): Promise<{ status: string; name: string }> {
    const response = await fetch(`${API_BASE_URL}/projects/${encodeURIComponent(name)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(body?.detail ?? `Project delete failed: ${response.status}`);
    }

    return response.json();
}

export async function renameProject(
    name: string,
    payload: ProjectRenameRequest,
): Promise<ProjectCreateResponse> {
    const response = await fetch(
        `${API_BASE_URL}/projects/${encodeURIComponent(name)}/rename`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        },
    );

    if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(body?.detail ?? `Project rename failed: ${response.status}`);
    }

    return response.json();
}

export async function createProjectFromTrajectory(
    payload: ProjectFromTrajectoryRequest,
): Promise<ProjectFromTrajectoryResponse> {
    const response = await fetch(`${API_BASE_URL}/projects/from-trajectory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        if (response.status === 409) {
            throw new Error(body?.detail ?? "Project already exists");
        }
        throw new Error(body?.detail ?? `Project create failed: ${response.status}`);
    }

    return response.json();
}

export async function fetchActiveProject(): Promise<ActiveProjectResponse> {
    const response = await fetch(`${API_BASE_URL}/projects/active`);

    if (!response.ok) {
        throw new Error(`Active project fetch failed: ${response.status}`);
    }

    return response.json();
}

export async function setActiveProject(name: string | null): Promise<ActiveProjectResponse> {
    const response = await fetch(`${API_BASE_URL}/projects/active`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
    });

    if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(body?.detail ?? `Active project update failed: ${response.status}`);
    }

    return response.json();
}

export async function loadProject(name: string): Promise<ProjectLoadResponse> {
    const response = await fetch(
        `${API_BASE_URL}/projects/${encodeURIComponent(name)}/load`,
        { method: "POST" },
    );

    if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(body?.detail ?? `Project load failed: ${response.status}`);
    }

    return response.json();
}