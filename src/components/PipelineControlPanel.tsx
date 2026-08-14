import { useCallback, useEffect, useRef, useState } from "react";
import {
    continuePipeline,
    fetchPipelineStatus,
    fetchSettings,
    reconnectScanner,
    reloadScannerSdk,
    saveSettings,
    startPipeline,
    stopPipeline,
} from "../api/client";
import { defaultPipelineSettings } from "../constants/scannerDefaults";
import type { PipelineStatus, RuntimeSettings } from "../types/api";
import { useI18n } from "../i18n/useI18n";
import { useProjectSaveRegistry } from "../project/ProjectSaveContext";

type PipelineControlPanelProps = {
    onStatusChange?: (status: PipelineStatus | null) => void;
};

export function PipelineControlPanel({ onStatusChange }: PipelineControlPanelProps) {
    const { t } = useI18n();
    const { activeProjectName } = useProjectSaveRegistry();
    const [status, setStatus] = useState<PipelineStatus | null>(null);
    const [delayInput, setDelayInput] = useState(String(defaultPipelineSettings.error_turntable_delay_sec));
    const [settingsSaving, setSettingsSaving] = useState(false);
    const settingsRef = useRef<RuntimeSettings | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [actionPending, setActionPending] = useState(false);

    const loadStatus = useCallback(async () => {
        try {
            const data = await fetchPipelineStatus();
            setStatus(data);
            setError(null);
            onStatusChange?.(data);
        } catch (err) {
            const message = err instanceof Error ? err.message : t.common.unknownError;
            setError(message);
        }
    }, [onStatusChange, t.common.unknownError]);

    const loadSettings = useCallback(async () => {
        try {
            const data = await fetchSettings();
            settingsRef.current = data;
            setDelayInput(String(data.pipeline.error_turntable_delay_sec));
        } catch (err) {
            const message = err instanceof Error ? err.message : t.common.unknownError;
            setError(message);
        }
    }, [t.common.unknownError]);

    useEffect(() => {
        void loadSettings();
    }, [loadSettings]);

    useEffect(() => {
        void loadStatus();
        const intervalMs = status?.state === "running" || status?.state === "stopping" ? 1000 : 2000;
        const timer = window.setInterval(() => {
            void loadStatus();
        }, intervalMs);
        return () => window.clearInterval(timer);
    }, [loadStatus, status?.state]);

    const isRunning = status?.state === "running" || status?.state === "stopping";
    const isReadyToRun = Boolean(
        status?.trajectory_ready &&
            status?.scanner_connected &&
            status?.robot_path_connected &&
            status?.turntable_connected &&
            !status?.initializing
    );
    const canReloadSdk = status?.scanner_connected
        ? !actionPending
        : !isRunning && !actionPending && !status?.initializing;
    const canReconnectScanner = !isRunning && !actionPending;
    const showResumeActions = Boolean(status?.can_resume && !isRunning);
    const canStart = Boolean(isReadyToRun && !isRunning && !actionPending);
    const canContinue = Boolean(showResumeActions && isReadyToRun && !actionPending);
    const canStop = Boolean(isRunning);
    const canEditDelay = !isRunning && !actionPending && !status?.initializing && !settingsSaving;

    async function savePipelineSettings(nextPipeline: RuntimeSettings["pipeline"]) {
        const current = settingsRef.current;
        if (!current) {
            return;
        }

        const nextSettings: RuntimeSettings = {
            ...current,
            pipeline: nextPipeline,
        };

        try {
            setSettingsSaving(true);
            const saved = await saveSettings(nextSettings);
            settingsRef.current = saved;
            setDelayInput(String(saved.pipeline.error_turntable_delay_sec));
            setError(null);
        } catch (err) {
            const message = err instanceof Error ? err.message : t.common.unknownError;
            setError(message);
        } finally {
            setSettingsSaving(false);
        }
    }

    async function saveTurntableDelay(rawValue: string) {
        const parsed = Number.parseFloat(rawValue);
        if (!Number.isFinite(parsed) || parsed < 0) {
            setDelayInput(
                String(
                    settingsRef.current?.pipeline.error_turntable_delay_sec ??
                        defaultPipelineSettings.error_turntable_delay_sec
                )
            );
            return;
        }

        const current = settingsRef.current;
        if (!current || current.pipeline.error_turntable_delay_sec === parsed) {
            setDelayInput(String(parsed));
            return;
        }

        await savePipelineSettings({
            ...current.pipeline,
            error_turntable_delay_sec: parsed,
        });
    }

    function formatPipelineError(message: string): string {
        const normalized = message.toLowerCase();
        if (
            normalized.includes("no_global_markers") ||
            normalized.includes("no global markers")
        ) {
            return t.pipeline.errors.noGlobalMarkersInP3;
        }
        if (
            normalized.includes("retcode=56") ||
            normalized.includes("retcode 56") ||
            normalized.includes("marker alignment failed") ||
            normalized.includes("marker align")
        ) {
            return t.pipeline.errors.markerAlignFailed;
        }
        if (normalized.includes("not at a known position")) {
            return t.pipeline.errors.notAtKnownPosition;
        }
        if (normalized.includes("no safe route to first scan")) {
            return t.pipeline.errors.noSafeRouteToFirstScan;
        }
        if (normalized.includes("axis telemetry is not connected")) {
            return t.pipeline.errors.axisNotConnected;
        }
        if (normalized.includes("no scan position") || normalized.includes("no scan point")) {
            return t.pipeline.errors.noScanPosition;
        }
        if (normalized.includes("scanexception") || normalized.includes("scan failed")) {
            return message;
        }
        return message;
    }

    async function handleStart() {
        try {
            setActionPending(true);
            setError(null);
            setSuccess(null);
            await startPipeline();
            await loadStatus();
        } catch (err) {
            const message = err instanceof Error ? err.message : t.common.unknownError;
            setError(formatPipelineError(message));
        } finally {
            setActionPending(false);
        }
    }

    async function handleContinue() {
        try {
            setActionPending(true);
            setError(null);
            setSuccess(null);
            await continuePipeline();
            setSuccess(t.pipeline.continueSuccess);
            await loadStatus();
        } catch (err) {
            const message =
                err instanceof Error ? err.message : t.pipeline.continueError;
            setError(formatPipelineError(message));
        } finally {
            setActionPending(false);
        }
    }

    async function handleStop() {
        try {
            setActionPending(true);
            setError(null);
            setSuccess(null);
            await stopPipeline();
            await loadStatus();
        } catch (err) {
            setError(err instanceof Error ? err.message : t.common.unknownError);
        } finally {
            setActionPending(false);
        }
    }

    async function handleReloadSdk() {
        try {
            setActionPending(true);
            setError(null);
            setSuccess(null);
            await reloadScannerSdk();
            setSuccess(t.pipeline.reloadSdkSuccess);
            await loadStatus();
        } catch (err) {
            setError(err instanceof Error ? err.message : t.pipeline.reloadSdkError);
        } finally {
            setActionPending(false);
        }
    }

    async function handleReconnectScanner() {
        try {
            setActionPending(true);
            setError(null);
            setSuccess(null);
            await reconnectScanner();
            setSuccess(t.pipeline.reconnectScannerSuccess);
            await loadStatus();
        } catch (err) {
            setError(err instanceof Error ? err.message : t.pipeline.reconnectScannerError);
        } finally {
            setActionPending(false);
        }
    }

    const stateLabel = status
        ? status.initializing
            ? t.pipeline.initializing
            : t.pipeline.states[status.state]
        : t.common.empty;

    return (
        <div className="card pipeline-control-card">
            <div className="pipeline-control-header">
                <div className="card-title">{t.pipeline.title}</div>
                <div className="pipeline-control-actions">
                    {showResumeActions ? (
                        <>
                            <button
                                type="button"
                                className="pipeline-btn pipeline-btn-start"
                                disabled={!canContinue}
                                onClick={() => void handleContinue()}
                            >
                                {t.pipeline.continue}
                            </button>
                            <button
                                type="button"
                                className="pipeline-btn pipeline-btn-start"
                                disabled={!canStart}
                                onClick={() => void handleStart()}
                            >
                                {t.pipeline.restart}
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            className="pipeline-btn pipeline-btn-start"
                            disabled={!canStart}
                            onClick={() => void handleStart()}
                        >
                            {activeProjectName
                                ? t.pipeline.startWithProject.replace(
                                      "{projectName}",
                                      activeProjectName,
                                  )
                                : t.pipeline.start}
                        </button>
                    )}
                    <button
                        type="button"
                        className="pipeline-btn"
                        disabled={!canReloadSdk}
                        onClick={() => void handleReloadSdk()}
                    >
                        {t.pipeline.reloadSdk}
                    </button>
                    <button
                        type="button"
                        className="pipeline-btn"
                        disabled={!canReconnectScanner}
                        onClick={() => void handleReconnectScanner()}
                    >
                        {t.pipeline.reconnectScanner}
                    </button>
                    {!status?.scanner_connected && !isRunning && (
                        <span className="pipeline-control-hint">
                            {t.pipeline.reconnectScannerHint}
                        </span>
                    )}
                    {status?.scanner_connected && isRunning && (
                        <span className="pipeline-control-hint">
                            {t.pipeline.reloadSdkStopsRunningHint}
                        </span>
                    )}
                    <button
                        type="button"
                        className="pipeline-btn pipeline-btn-stop"
                        disabled={!canStop}
                        onClick={() => void handleStop()}
                    >
                        {t.pipeline.stop}
                    </button>
                </div>
            </div>

            <div className="pipeline-control-meta">
                <span>
                    {t.pipeline.state}: <strong>{stateLabel}</strong>
                </span>
                <span className={status?.scanner_connected ? "pipeline-ok" : "pipeline-warn"}>
                    {status?.scanner_connected ? t.pipeline.scannerConnected : t.pipeline.scannerDisconnected}
                </span>
                <span className={status?.robot_path_connected ? "pipeline-ok" : "pipeline-warn"}>
                    {status?.robot_path_connected ? t.pipeline.robotPathConnected : t.pipeline.robotPathDisconnected}
                </span>
                <span className={status?.turntable_connected ? "pipeline-ok" : "pipeline-warn"}>
                    {status?.turntable_connected ? t.pipeline.turntableConnected : t.pipeline.turntableDisconnected}
                </span>
                <span className={status?.project_ready ? "pipeline-ok" : "pipeline-warn"}>
                    {status?.project_ready ? t.pipeline.projectReady : t.pipeline.projectNotReady}
                </span>
                <span className={status?.trajectory_ready ? "pipeline-ok" : "pipeline-warn"}>
                    {status?.trajectory_ready ? t.pipeline.trajectoryReady : t.pipeline.trajectoryNotReady}
                </span>
                {status?.cycle_mode === "production" && (
                    <span>{t.pipeline.cycleModeProduction}</span>
                )}
            </div>

            <div className="pipeline-control-meta">
                <span>
                    {t.pipeline.currentStep}: {status?.current_step_index !== null && status?.current_step_index !== undefined ? status.current_step_index + 1 : t.common.empty}
                </span>
                <span>
                    {t.pipeline.scanCount}: {status?.scan_count ?? 0}
                </span>
                <span>
                    {t.pipeline.projectName}: {status?.project_name ?? t.common.empty}
                </span>
                {(status?.position_resend_step_indices?.length ?? 0) > 0 && (
                    <span className="pipeline-resend-count">
                        {t.pipeline.resendStepsCount}:{" "}
                        {status?.position_resend_step_indices.length ?? 0}
                    </span>
                )}
                <label className="pipeline-delay-field">
                    <span>{t.pipeline.errorTurntableDelaySec}</span>
                    <input
                        type="number"
                        className="pipeline-delay-input"
                        min={0}
                        step={0.1}
                        value={delayInput}
                        disabled={!canEditDelay}
                        title={t.pipeline.errorTurntableDelayHint}
                        onChange={(event) => setDelayInput(event.target.value)}
                        onBlur={() => void saveTurntableDelay(delayInput)}
                    />
                </label>
            </div>

            {status?.last_error && (
                <div className="error-text">{formatPipelineError(status.last_error)}</div>
            )}
            {success && <div className="accent-text">{success}</div>}
            {error && <div className="error-text">{error}</div>}
        </div>
    );
}
