import { useEffect, useMemo, useRef, useState } from "react";
import { fetchMarkers, fetchSettings, saveSettingsSection } from "../api/client";
import { ScannerSettingsSection } from "../components/ScannerSettingsSection";
import { SettingsCollapsibleSection } from "../components/SettingsCollapsibleSection";
import { SettingsPathField } from "../components/SettingsPathField";
import { RadioGroupField } from "../components/RadioGroupField";
import { MARKERS_DIR } from "../constants/fixedPaths";
import {
    defaultRuntimeSettings,
    defaultPipelineSettings,
    defaultScannerExposureSettings,
    defaultScannerSettings,
} from "../constants/scannerDefaults";
import type { MarkerFileEntry, RuntimeSettings, SettingsUpdateResponse } from "../types/api";
import { useI18n } from "../i18n/useI18n";
import { useProjectSaveRegistry } from "../project/ProjectSaveContext";
import { formatApplyErrorPresentation, buildApplyErrorDetail } from "../utils/applyErrorFormat";
import { migrateLegacyExposureSettings } from "../utils/exposureWire";
import {
    SAVE_ONLY_SECTIONS,
    SETTINGS_SECTION_AXIS_TELEMETRY,
    SETTINGS_SECTION_EXPOSURE_SETTINGS,
    SETTINGS_SECTION_LOGGING,
    SETTINGS_SECTION_PIPELINE,
    SETTINGS_SECTION_ROBOT_PATH,
    SETTINGS_SECTION_SCANNER_CONNECTION,
    isScannerNestedSection,
    validateSettingsSection,
    type SettingsSectionId,
} from "../utils/settingsSections";
import { normalizeRuntimeSettings, isMarkersOnlyScanMode } from "../utils/scannerParamConstraints";
import { looksLikeCycleScanExport } from "../utils/markerFrameworkPath";

const EXPOSURE_AUTO_SAVE_DELAY_MS = 400;

const defaultSettings: RuntimeSettings = defaultRuntimeSettings;

const LOG_LEVEL_OPTIONS = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] as const;

type HostField = "sender_host" | "axis_forward_host" | "robot_host" | "scanner_host";

type FieldErrors = Partial<Record<HostField, string>>;

type SectionStatus = {
    error?: string;
    errorSummary?: string;
    errorDetail?: string;
    success?: string;
};

type OpenSectionKey = SettingsSectionId | "scanner";

function scrollToSectionFooter(sectionId: string) {
    requestAnimationFrame(() => {
        const section = document.getElementById(`settings-section-${sectionId}`);
        const footer =
            section?.querySelector(".settings-section-footer") ??
            (section?.classList.contains("settings-section-footer") ? section : null);
        footer?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
}

function isValidHost(value: string): boolean {
    const trimmed = value.trim();

    if (trimmed === "localhost") {
        return true;
    }

    const parts = trimmed.split(".");
    if (parts.length !== 4) {
        return false;
    }

    return parts.every((part) => {
        if (!/^\d+$/.test(part)) {
            return false;
        }

        const num = Number(part);
        return num >= 0 && num <= 255;
    });
}

function isValidPort(value: number): boolean {
    return Number.isInteger(value) && value >= 1 && value <= 65535;
}

function mergeSettings(data: RuntimeSettings): RuntimeSettings {
    const legacyDevice = data.scanner?.device as
        | (RuntimeSettings["scanner"]["device"] & {
              exp_type?: number;
              exp_obj?: number;
              marker_exp?: number;
              val1?: number;
              val2?: number;
              val3?: number;
          })
        | undefined;

    const exposureSettings =
        data.scanner?.exposure_settings ??
        (legacyDevice ? migrateLegacyExposureSettings(legacyDevice) : defaultScannerExposureSettings);

    const merged: RuntimeSettings = {
        ...defaultSettings,
        ...data,
        scanner: {
            ...defaultScannerSettings,
            ...data.scanner,
            device: { ...defaultScannerSettings.device, ...data.scanner?.device },
            exposure_settings: {
                ...defaultScannerExposureSettings,
                ...exposureSettings,
            },
            scan: { ...defaultScannerSettings.scan, ...data.scanner?.scan },
            exposure_range: {
                ...defaultScannerSettings.exposure_range,
                ...data.scanner?.exposure_range,
            },
            mesh: { ...defaultScannerSettings.mesh, ...data.scanner?.mesh },
            project_name: {
                parts: data.scanner?.project_name?.parts ?? defaultScannerSettings.project_name.parts,
            },
            project_name_counter:
                data.scanner?.project_name_counter ?? defaultScannerSettings.project_name_counter,
        },
        pipeline: {
            ...defaultPipelineSettings,
            ...data.pipeline,
            cycle_run_mode:
                data.pipeline?.cycle_run_mode ??
                ((data.pipeline as { stop_after_last_scan?: boolean } | undefined)
                    ?.stop_after_last_scan
                    ? "single_last_scan"
                    : defaultPipelineSettings.cycle_run_mode),
        },
    };

    return normalizeRuntimeSettings(merged);
}

export function SettingsPage() {
    const { t } = useI18n();
    const { registerSettingsGetter, registerProjectReloadListener } = useProjectSaveRegistry();
    const [form, setForm] = useState<RuntimeSettings>(defaultSettings);
    const [loading, setLoading] = useState(false);
    const [initialized, setInitialized] = useState(false);
    const [saving, setSaving] = useState(false);
    const [savingSection, setSavingSection] = useState<SettingsSectionId | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [errorSummary, setErrorSummary] = useState<string | null>(null);
    const [errorDetail, setErrorDetail] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [sectionStatus, setSectionStatus] = useState<Partial<Record<SettingsSectionId, SectionStatus>>>({});
    const [openSections, setOpenSections] = useState<Partial<Record<OpenSectionKey, boolean>>>({});
    const [markerFiles, setMarkerFiles] = useState<MarkerFileEntry[]>([]);
    const exposureSaveTimerRef = useRef<number | null>(null);
    const pendingExposureSettingsRef = useRef<RuntimeSettings | null>(null);
    const formRef = useRef(form);
    formRef.current = form;

    useEffect(() => {
        let cancelled = false;

        async function loadMarkerFiles() {
            try {
                const markers = await fetchMarkers();
                if (!cancelled) {
                    setMarkerFiles(markers.files);
                }
            } catch {
                if (!cancelled) {
                    setMarkerFiles([]);
                }
            }
        }

        void loadMarkerFiles();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        registerSettingsGetter(() => formRef.current);
        return () => registerSettingsGetter(null);
    }, [registerSettingsGetter]);

    useEffect(() => {
        return () => {
            if (exposureSaveTimerRef.current !== null) {
                window.clearTimeout(exposureSaveTimerRef.current);
            }
        };
    }, []);

    async function loadSettings() {
        try {
            setLoading(true);
            setError(null);
            setErrorSummary(null);
            setErrorDetail(null);
            setSuccess(null);
            setFieldErrors({});
            setSectionStatus({});
            const data = await fetchSettings();
            setForm(mergeSettings(data));
        } catch {
            setError(t.settings.loadError);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void loadSettings().finally(() => {
                setInitialized(true);
            });
        }, 0);

        return () => window.clearTimeout(timer);
    }, []);

    useEffect(() => {
        return registerProjectReloadListener(() => loadSettings());
    }, [registerProjectReloadListener]);

    function updateField<K extends keyof RuntimeSettings>(
        key: K,
        value: RuntimeSettings[K]
    ) {
        setForm((prev) => ({
            ...prev,
            [key]: value,
        }));

        if (
            key === "sender_host" ||
            key === "axis_forward_host" ||
            key === "robot_host" ||
            key === "scanner_host"
        ) {
            setFieldErrors((prev) => ({
                ...prev,
                [key]: undefined,
            }));
        }
    }

    function getHostError(value: string): string | undefined {
        const trimmed = value.trim();

        if (!trimmed) {
            return t.settings.validation.hostHint;
        }

        if (!isValidHost(trimmed)) {
            return t.settings.validation.hostHint;
        }

        return undefined;
    }

    function validateSingleHost(key: HostField, value: string): boolean {
        const nextError = getHostError(value);

        setFieldErrors((prev) => ({
            ...prev,
            [key]: nextError,
        }));

        return !nextError;
    }

    function validateHosts(): boolean {
        const nextErrors: FieldErrors = {
            sender_host: getHostError(form.sender_host),
            robot_host: getHostError(form.robot_host),
            scanner_host: getHostError(form.scanner_host),
        };

        setFieldErrors(nextErrors);

        return !nextErrors.sender_host && !nextErrors.robot_host && !nextErrors.scanner_host;
    }

    const markersOnlyMode = isMarkersOnlyScanMode(form.scanner.scan);

    const isFormValid = useMemo(() => {
        const hostsValid =
            !getHostError(form.sender_host) &&
            (!form.axis_forward_enabled || !getHostError(form.axis_forward_host)) &&
            !getHostError(form.robot_host) &&
            !getHostError(form.scanner_host);

        const portsValid =
            isValidPort(form.sender_port) &&
            (!form.axis_forward_enabled || isValidPort(form.axis_forward_port)) &&
            isValidPort(form.robot_port) &&
            isValidPort(form.turntable_port) &&
            isValidPort(form.scanner_port);

        const pollIntervalValid =
            Number.isInteger(form.poll_interval_ms) &&
            form.poll_interval_ms > 0;

        const logFilePathValid = form.log_file_path.trim().length > 0;

        const logLevelValid = LOG_LEVEL_OPTIONS.includes(
            form.log_level as (typeof LOG_LEVEL_OPTIONS)[number]
        );

        const pathsFolderValid = form.paths_folder.trim().length > 0;

        const markerPathValid =
            !form.pipeline.import_markers ||
            form.pipeline.marker_framework_path.trim().length > 0;

        return (
            hostsValid &&
            portsValid &&
            pollIntervalValid &&
            logFilePathValid &&
            logLevelValid &&
            pathsFolderValid &&
            markerPathValid
        );
    }, [form, t.settings.validation.hostHint]);

    function applyErrorLabels() {
        return {
            failedTitle: t.settings.sectionApplyFailed,
            summary: t.settings.sectionApplyErrorSummary,
            deferred: t.settings.sectionApplyDeferred,
        };
    }

    function openSectionForSave(sectionId: SettingsSectionId) {
        setOpenSections((prev) => {
            const next = { ...prev, [sectionId]: true };
            if (isScannerNestedSection(sectionId) || sectionId === SETTINGS_SECTION_SCANNER_CONNECTION) {
                next.scanner = true;
            }
            return next;
        });
    }

    function setSectionOpen(sectionId: OpenSectionKey, open: boolean) {
        setOpenSections((prev) => ({ ...prev, [sectionId]: open }));
    }

    function sectionProps(sectionId: SettingsSectionId) {
        const status = sectionStatus[sectionId];
        return {
            sectionId,
            open: openSections[sectionId] ?? false,
            onOpenChange: (open: boolean) => setSectionOpen(sectionId, open),
            onSave: () => void saveSection(sectionId),
            saveLabel: t.settings.sectionSaveButton,
            saving: savingSection === sectionId,
            sectionError: status?.error ?? null,
            sectionErrorSummary: status?.errorSummary ?? null,
            sectionErrorDetail: status?.errorDetail ?? null,
            sectionSuccess: status?.success ?? null,
        };
    }

    function formatSectionResult(
        sectionId: SettingsSectionId,
        response: SettingsUpdateResponse
    ): SectionStatus {
        const applyError = formatApplyErrorPresentation(response, applyErrorLabels());
        if (applyError) {
            const structuredDetail = buildApplyErrorDetail(response.apply_error_detail);
            const detailParts = [t.settings.sectionApplyErrorSummary, structuredDetail].filter(
                (part): part is string => Boolean(part && part.trim())
            );

            return {
                error: applyError.title,
                errorSummary: response.apply_error ?? applyError.summary ?? undefined,
                errorDetail: detailParts.length > 0 ? detailParts.join("\n\n") : undefined,
            };
        }

        if (SAVE_ONLY_SECTIONS.has(sectionId)) {
            return { success: t.settings.sectionSaveOnlySuccess };
        }

        if (response.applied) {
            return { success: t.settings.sectionApplySuccess };
        }

        return { error: t.settings.sectionApplyDeferred };
    }

    async function saveSection(
        sectionId: SettingsSectionId,
        settingsOverride?: RuntimeSettings
    ) {
        const settings = settingsOverride ?? form;
        const validationError = validateSettingsSection(
            settings,
            sectionId,
            t.settings.validation.hostHint,
            t.settings.validation.markerPathRequired,
            t.settings.validation.scanImportMonitoredFolderRequired,
            t.settings.validation.invalidMarkerRadiusForWorkRange,
            t.settings.validation.invalidScanTargetForGlobalAlign,
            t.settings.validation.invalidMarkerExposureRange,
            t.settings.validation.invalidPointCloudExposureRange
        );

        if (validationError) {
            openSectionForSave(sectionId);
            setSectionStatus((prev) => ({
                ...prev,
                [sectionId]: { error: validationError },
            }));
            scrollToSectionFooter(sectionId);
            return;
        }

        if (
            sectionId === SETTINGS_SECTION_AXIS_TELEMETRY &&
            !validateSingleHost("sender_host", settings.sender_host)
        ) {
            return;
        }

        if (
            sectionId === SETTINGS_SECTION_AXIS_TELEMETRY &&
            settings.axis_forward_enabled &&
            !validateSingleHost("axis_forward_host", settings.axis_forward_host)
        ) {
            return;
        }

        if (
            sectionId === SETTINGS_SECTION_ROBOT_PATH &&
            !validateSingleHost("robot_host", settings.robot_host)
        ) {
            return;
        }

        if (
            sectionId === SETTINGS_SECTION_SCANNER_CONNECTION &&
            !validateSingleHost("scanner_host", settings.scanner_host)
        ) {
            return;
        }

        try {
            setSavingSection(sectionId);
            openSectionForSave(sectionId);
            setSectionStatus((prev) => ({
                ...prev,
                [sectionId]: {},
            }));

            const response = await saveSettingsSection(settings, sectionId);
            setForm(mergeSettings(response.settings));
            const result = formatSectionResult(sectionId, response);
            setSectionStatus((prev) => ({
                ...prev,
                [sectionId]: result,
            }));

            if (result.error || result.errorSummary || result.errorDetail) {
                scrollToSectionFooter(sectionId);
            }
        } catch {
            setSectionStatus((prev) => ({
                ...prev,
                [sectionId]: { error: t.settings.saveError },
            }));
            scrollToSectionFooter(sectionId);
        } finally {
            setSavingSection(null);
        }
    }

    function scheduleExposureAutoSave(next: RuntimeSettings) {
        pendingExposureSettingsRef.current = next;
        if (exposureSaveTimerRef.current !== null) {
            window.clearTimeout(exposureSaveTimerRef.current);
        }
        exposureSaveTimerRef.current = window.setTimeout(() => {
            const pending = pendingExposureSettingsRef.current;
            if (pending) {
                void saveSection(SETTINGS_SECTION_EXPOSURE_SETTINGS, pending);
            }
        }, EXPOSURE_AUTO_SAVE_DELAY_MS);
    }

    function handleScannerChange(next: RuntimeSettings) {
        const exposureChanged =
            JSON.stringify(next.scanner.exposure_settings) !==
            JSON.stringify(form.scanner.exposure_settings);
        setForm(next);
        if (exposureChanged) {
            scheduleExposureAutoSave(next);
        }
    }

    async function handleSave() {
        setError(null);
        setErrorSummary(null);
        setErrorDetail(null);
        setSuccess(null);

        const hostsValid = validateHosts();
        if (!hostsValid || !isFormValid) {
            setError(t.settings.saveError);
            return;
        }

        try {
            setSaving(true);
            const response = await saveSettingsSection(form, null);
            setForm(mergeSettings(response.settings));

            const applyError = formatApplyErrorPresentation(response, applyErrorLabels());
            if (applyError) {
                setError(applyError.title);
                setErrorSummary(applyError.summary);
                setErrorDetail(applyError.detailLog);
            } else {
                setSuccess(t.settings.saveSuccess);
            }
        } catch {
            setError(t.settings.saveError);
        } finally {
            setSaving(false);
        }
    }

    async function handleReload() {
        await loadSettings();
        setInitialized(true);
    }

    if (!initialized || loading) {
        return <div className="page">{t.dashboard.loading}</div>;
    }

    return (
        <div className="page">
            <div className="card">
                <div className="card-title">{t.settings.title}</div>

                {error && <div className="error-text settings-section-error-title">{error}</div>}
                {errorSummary && (
                    <div className="error-text settings-section-error-summary">{errorSummary}</div>
                )}
                {errorDetail && <pre className="settings-section-error-log">{errorDetail}</pre>}
                {success && <div className="accent-text">{success}</div>}

                <div className="form-grid">
                    <SettingsCollapsibleSection
                        title={t.settings.sections.axisTelemetry}
                        {...sectionProps(SETTINGS_SECTION_AXIS_TELEMETRY)}
                    >
                        <label className="form-field">
                            <span>{t.settings.fields.axisHost}</span>
                            <input
                                type="text"
                                value={form.sender_host}
                                onChange={(e) => updateField("sender_host", e.target.value)}
                                onBlur={() => validateSingleHost("sender_host", form.sender_host)}
                            />
                            {fieldErrors.sender_host && (
                                <small className="field-error">{fieldErrors.sender_host}</small>
                            )}
                        </label>

                        <label className="form-field">
                            <span>{t.settings.fields.axisPort}</span>
                            <input
                                type="number"
                                min={1}
                                max={65535}
                                value={form.sender_port}
                                onChange={(e) => updateField("sender_port", Number(e.target.value))}
                            />
                        </label>

                        <label className="form-field checkbox-field">
                            <input
                                type="checkbox"
                                checked={form.axis_forward_enabled}
                                onChange={(e) =>
                                    updateField("axis_forward_enabled", e.target.checked)
                                }
                            />
                            <span>{t.settings.fields.axisForwardEnabled}</span>
                        </label>
                        <small className="field-hint">{t.settings.fields.axisForwardEnabledHint}</small>

                        {form.axis_forward_enabled && (
                            <>
                                <label className="form-field">
                                    <span>{t.settings.fields.axisForwardHost}</span>
                                    <input
                                        type="text"
                                        value={form.axis_forward_host}
                                        onChange={(e) =>
                                            updateField("axis_forward_host", e.target.value)
                                        }
                                        onBlur={() =>
                                            validateSingleHost(
                                                "axis_forward_host",
                                                form.axis_forward_host
                                            )
                                        }
                                    />
                                    {fieldErrors.axis_forward_host && (
                                        <small className="field-error">
                                            {fieldErrors.axis_forward_host}
                                        </small>
                                    )}
                                </label>

                                <label className="form-field">
                                    <span>{t.settings.fields.axisForwardPort}</span>
                                    <input
                                        type="number"
                                        min={1}
                                        max={65535}
                                        value={form.axis_forward_port}
                                        onChange={(e) =>
                                            updateField("axis_forward_port", Number(e.target.value))
                                        }
                                    />
                                </label>
                            </>
                        )}
                    </SettingsCollapsibleSection>

                    <SettingsCollapsibleSection
                        title={t.settings.sections.robotPath}
                        hint={t.settings.hints.robotDuringRun}
                        {...sectionProps(SETTINGS_SECTION_ROBOT_PATH)}
                    >
                        <label className="form-field">
                            <span>{t.settings.fields.robotHost}</span>
                            <input
                                type="text"
                                value={form.robot_host}
                                onChange={(e) => updateField("robot_host", e.target.value)}
                                onBlur={() => validateSingleHost("robot_host", form.robot_host)}
                            />
                            {fieldErrors.robot_host && (
                                <small className="field-error">{fieldErrors.robot_host}</small>
                            )}
                        </label>

                        <label className="form-field">
                            <span>{t.settings.fields.robotPort}</span>
                            <input
                                type="number"
                                min={1}
                                max={65535}
                                value={form.robot_port}
                                onChange={(e) => updateField("robot_port", Number(e.target.value))}
                            />
                        </label>

                        <label className="form-field">
                            <span>{t.settings.fields.turntablePort}</span>
                            <input
                                type="number"
                                min={1}
                                max={65535}
                                value={form.turntable_port}
                                onChange={(e) => updateField("turntable_port", Number(e.target.value))}
                            />
                        </label>

                        <div className="form-field">
                            <span>{t.settings.fields.turntableWireFormat}</span>
                            <small className="field-hint">{t.settings.hints.turntableWireFormat}</small>
                            <div className="settings-toggle-group">
                                <button
                                    type="button"
                                    className={
                                        form.turntable_wire_format === "integer"
                                            ? "nav-btn active"
                                            : "nav-btn"
                                    }
                                    onClick={() => updateField("turntable_wire_format", "integer")}
                                >
                                    {t.settings.fields.turntableWireFormatInteger}
                                </button>
                                <button
                                    type="button"
                                    className={
                                        form.turntable_wire_format === "decimal_2"
                                            ? "nav-btn active"
                                            : "nav-btn"
                                    }
                                    onClick={() => updateField("turntable_wire_format", "decimal_2")}
                                >
                                    {t.settings.fields.turntableWireFormatDecimal2}
                                </button>
                            </div>
                        </div>
                    </SettingsCollapsibleSection>

                    <SettingsCollapsibleSection
                        title={t.settings.sections.scanner}
                        sectionId="scanner"
                        open={openSections.scanner ?? false}
                        onOpenChange={(open) => setSectionOpen("scanner", open)}
                    >
                        <label className="form-field">
                            <span>{t.settings.fields.scannerHost}</span>
                            <input
                                type="text"
                                value={form.scanner_host}
                                onChange={(e) => updateField("scanner_host", e.target.value)}
                                onBlur={() => validateSingleHost("scanner_host", form.scanner_host)}
                            />
                            {fieldErrors.scanner_host && (
                                <small className="field-error">{fieldErrors.scanner_host}</small>
                            )}
                        </label>

                        <label className="form-field">
                            <span>{t.settings.fields.scannerPort}</span>
                            <input
                                type="number"
                                min={1}
                                max={65535}
                                value={form.scanner_port}
                                onChange={(e) => updateField("scanner_port", Number(e.target.value))}
                            />
                        </label>

                        <div
                            id={`settings-section-${SETTINGS_SECTION_SCANNER_CONNECTION}`}
                            className={
                                sectionStatus[SETTINGS_SECTION_SCANNER_CONNECTION]?.error ||
                                sectionStatus[SETTINGS_SECTION_SCANNER_CONNECTION]?.errorSummary ||
                                sectionStatus[SETTINGS_SECTION_SCANNER_CONNECTION]?.errorDetail
                                    ? "settings-section-footer settings-section-footer--has-error"
                                    : "settings-section-footer"
                            }
                        >
                            <button
                                type="button"
                                className="nav-btn active"
                                onClick={() => void saveSection(SETTINGS_SECTION_SCANNER_CONNECTION)}
                                disabled={savingSection === SETTINGS_SECTION_SCANNER_CONNECTION}
                            >
                                {t.settings.sectionSaveButton}
                            </button>
                            {sectionStatus[SETTINGS_SECTION_SCANNER_CONNECTION]?.success && (
                                <div className="accent-text">
                                    {sectionStatus[SETTINGS_SECTION_SCANNER_CONNECTION]?.success}
                                </div>
                            )}
                            {sectionStatus[SETTINGS_SECTION_SCANNER_CONNECTION]?.error && (
                                <div className="error-text settings-section-error-title">
                                    {sectionStatus[SETTINGS_SECTION_SCANNER_CONNECTION]?.error}
                                </div>
                            )}
                            {sectionStatus[SETTINGS_SECTION_SCANNER_CONNECTION]?.errorSummary && (
                                <div className="error-text settings-section-error-summary">
                                    {sectionStatus[SETTINGS_SECTION_SCANNER_CONNECTION]?.errorSummary}
                                </div>
                            )}
                            {sectionStatus[SETTINGS_SECTION_SCANNER_CONNECTION]?.errorDetail && (
                                <pre className="settings-section-error-log">
                                    {sectionStatus[SETTINGS_SECTION_SCANNER_CONNECTION]?.errorDetail}
                                </pre>
                            )}
                        </div>

                        <div className="settings-inner-group">
                            <ScannerSettingsSection
                                form={form}
                                onChange={handleScannerChange}
                                savingSection={savingSection}
                                sectionStatus={sectionStatus}
                                onSaveSection={(sectionId) => void saveSection(sectionId)}
                                openSections={openSections}
                                onSectionOpenChange={(sectionId, open) =>
                                    setSectionOpen(sectionId, open)
                                }
                            />
                        </div>
                    </SettingsCollapsibleSection>

                    <SettingsCollapsibleSection
                        title={t.settings.sections.pipeline}
                        {...sectionProps(SETTINGS_SECTION_PIPELINE)}
                    >
                        <label className="form-field checkbox-field full-width-field">
                            <span>{t.settings.fields.importMarkers}</span>
                            <input
                                type="checkbox"
                                checked={form.pipeline.import_markers}
                                disabled={markersOnlyMode}
                                onChange={(e) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        pipeline: {
                                            ...prev.pipeline,
                                            import_markers: e.target.checked,
                                        },
                                    }))
                                }
                            />
                        </label>
                        {markersOnlyMode && (
                            <p className="settings-section-hint">
                                {t.settings.fields.markersOnlyImportDisabledHint}
                            </p>
                        )}

                        <label className="form-field checkbox-field full-width-field">
                            <span>{t.settings.fields.scanFolderWatcherEnabled}</span>
                            <input
                                type="checkbox"
                                checked={form.pipeline.scan_folder_watcher_enabled}
                                onChange={(e) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        pipeline: {
                                            ...prev.pipeline,
                                            scan_folder_watcher_enabled: e.target.checked,
                                        },
                                    }))
                                }
                            />
                        </label>

                        {form.pipeline.scan_folder_watcher_enabled && (
                            <>
                                <SettingsPathField
                                    label={t.settings.fields.scanImportMonitoredFolder}
                                    value={form.pipeline.scan_import_monitored_folder}
                                    mode="folder"
                                    placeholder="C:\\Path\\To\\MonitoredFolder"
                                    onChange={(value) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            pipeline: {
                                                ...prev.pipeline,
                                                scan_import_monitored_folder: value,
                                            },
                                        }))
                                    }
                                />
                                <p className="settings-section-hint">
                                    {t.settings.fields.scanImportMonitoredFolderHint}
                                </p>
                                {form.pipeline.scan_import_monitored_folder.trim().length === 0 && (
                                    <p className="settings-section-hint error-text">
                                        {t.settings.validation.scanImportMonitoredFolderRequired}
                                    </p>
                                )}
                            </>
                        )}

                        <RadioGroupField
                            className="form-field radio-group-field full-width-field"
                            label={t.settings.fields.cycleRunMode}
                            name="cycle_run_mode"
                            value={form.pipeline.cycle_run_mode}
                            options={[
                                {
                                    value: "single_last_scan",
                                    label: t.settings.fields.cycleRunModeSingleLastScan,
                                },
                                {
                                    value: "single_full",
                                    label: t.settings.fields.cycleRunModeSingleFull,
                                },
                                {
                                    value: "repeat_on_success",
                                    label: t.settings.fields.cycleRunModeRepeatOnSuccess,
                                },
                            ]}
                            hint={
                                form.pipeline.cycle_run_mode === "single_last_scan"
                                    ? t.settings.fields.cycleRunModeSingleLastScanHint
                                    : form.pipeline.cycle_run_mode === "single_full"
                                      ? t.settings.fields.cycleRunModeSingleFullHint
                                      : t.settings.fields.cycleRunModeRepeatOnSuccessHint
                            }
                            onChange={(value) =>
                                setForm((prev) => ({
                                    ...prev,
                                    pipeline: {
                                        ...prev.pipeline,
                                        cycle_run_mode: value,
                                    },
                                }))
                            }
                        />

                        <label className="form-field checkbox-field full-width-field">
                            <span>{t.settings.fields.skipFailedScans}</span>
                            <input
                                type="checkbox"
                                checked={form.pipeline.skip_failed_scans}
                                onChange={(e) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        pipeline: {
                                            ...prev.pipeline,
                                            skip_failed_scans: e.target.checked,
                                        },
                                    }))
                                }
                            />
                        </label>
                        <p className="settings-section-hint">{t.settings.fields.skipFailedScansHint}</p>

                        <div className="form-field full-width-field">
                            <span>{t.settings.fields.markersFolder}</span>
                            <div className="fixed-path-value">{MARKERS_DIR}</div>
                        </div>

                        <label className="form-field full-width-field">
                            <span>{t.settings.fields.markerFrameworkPath}</span>
                            <select
                                value={form.pipeline.marker_framework_path}
                                disabled={!form.pipeline.import_markers}
                                onChange={(event) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        pipeline: {
                                            ...prev.pipeline,
                                            marker_framework_path: event.target.value,
                                        },
                                    }))
                                }
                            >
                                <option value="">
                                    {markerFiles.length === 0
                                        ? t.settings.fields.noMarkerFiles
                                        : t.common.empty}
                                </option>
                                {markerFiles.map((file) => (
                                    <option key={file.path} value={file.path}>
                                        {file.name}
                                    </option>
                                ))}
                            </select>
                            {form.pipeline.import_markers &&
                                form.pipeline.marker_framework_path.trim().length === 0 && (
                                    <small className="field-error">
                                        {t.settings.validation.markerPathRequired}
                                    </small>
                                )}
                        </label>
                        {form.pipeline.import_markers && (
                            <p className="settings-section-hint">
                                {t.settings.fields.markerFrameworkPathHint}
                            </p>
                        )}
                        {form.pipeline.import_markers &&
                            looksLikeCycleScanExport(form.pipeline.marker_framework_path) && (
                                <p className="settings-section-hint settings-section-hint--warning">
                                    {t.settings.validation.markerFrameworkPathCycleExportHint}
                                </p>
                            )}
                    </SettingsCollapsibleSection>

                    <SettingsCollapsibleSection
                        title={t.settings.sections.logging}
                        {...sectionProps(SETTINGS_SECTION_LOGGING)}
                    >
                        <label className="form-field checkbox-field">
                            <span>{t.settings.fields.logToConsole}</span>
                            <input
                                type="checkbox"
                                checked={form.log_to_console}
                                onChange={(e) => updateField("log_to_console", e.target.checked)}
                            />
                        </label>

                        <label className="form-field checkbox-field">
                            <span>{t.settings.fields.logToFile}</span>
                            <input
                                type="checkbox"
                                checked={form.log_to_file}
                                onChange={(e) => updateField("log_to_file", e.target.checked)}
                            />
                        </label>

                        <label className="form-field">
                            <span>{t.settings.fields.logLevel}</span>
                            <select
                                value={form.log_level}
                                onChange={(e) => updateField("log_level", e.target.value)}
                            >
                                {LOG_LEVEL_OPTIONS.map((level) => (
                                    <option key={level} value={level}>
                                        {level}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <SettingsPathField
                            label={t.settings.fields.logFilePath}
                            value={form.log_file_path}
                            mode="file"
                            onChange={(value) => updateField("log_file_path", value)}
                        />

                        <label className="form-field checkbox-field">
                            <span>{t.settings.fields.sdkLogEnabled}</span>
                            <input
                                type="checkbox"
                                checked={form.sdk_log_enabled}
                                onChange={(e) => updateField("sdk_log_enabled", e.target.checked)}
                            />
                        </label>

                        <SettingsPathField
                            label={t.settings.fields.sdkLogDir}
                            value={form.sdk_log_dir}
                            mode="folder"
                            onChange={(value) => updateField("sdk_log_dir", value)}
                        />

                        <SettingsPathField
                            label={t.settings.fields.sdkNativeLogSource}
                            value={form.sdk_native_log_source}
                            mode="folder"
                            placeholder="C:\\Program Files\\OptimScan Q\\log"
                            onChange={(value) => updateField("sdk_native_log_source", value)}
                        />

                        <label className="form-field checkbox-field">
                            <span>{t.settings.fields.sdkTcpLogToConsole}</span>
                            <input
                                type="checkbox"
                                checked={form.sdk_tcp_log_to_console}
                                onChange={(e) =>
                                    updateField("sdk_tcp_log_to_console", e.target.checked)
                                }
                            />
                        </label>

                        <label className="form-field">
                            <span>{t.settings.fields.pollIntervalMs}</span>
                            <input
                                type="number"
                                min={1}
                                value={form.poll_interval_ms}
                                onChange={(e) =>
                                    updateField("poll_interval_ms", Number(e.target.value))
                                }
                            />
                        </label>
                    </SettingsCollapsibleSection>
                </div>

                <div className="actions-row">
                    <button className="nav-btn" onClick={handleReload} disabled={loading || saving}>
                        {t.settings.reloadButton}
                    </button>
                    <button
                        className="nav-btn active"
                        onClick={handleSave}
                        disabled={!isFormValid || loading || saving}
                    >
                        {t.settings.saveButton}
                    </button>
                </div>
            </div>
        </div>
    );
}
