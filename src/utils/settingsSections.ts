import type { RuntimeSettings } from "../types/api";
import { validateScannerConstraints } from "./scannerParamConstraints";
import { validateExposureSettings } from "./exposureWire";

export const SETTINGS_SECTION_AXIS_TELEMETRY = "axisTelemetry";
export const SETTINGS_SECTION_ROBOT_PATH = "robotPath";
export const SETTINGS_SECTION_SCANNER_CONNECTION = "scannerConnection";
export const SETTINGS_SECTION_SDK_PATHS = "sdkPaths";
export const SETTINGS_SECTION_DEVICE_PARAMS = "deviceParams";
export const SETTINGS_SECTION_EXPOSURE_SETTINGS = "exposureSettings";
export const SETTINGS_SECTION_SCAN_PARAMS = "scanParams";
export const SETTINGS_SECTION_EXPOSURE_RANGE = "exposureRange";
export const SETTINGS_SECTION_PIPELINE_BEHAVIOR = "pipelineBehavior";
export const SETTINGS_SECTION_MESH_PARAMS = "meshParams";
export const SETTINGS_SECTION_PATHS = "paths";
export const SETTINGS_SECTION_PIPELINE = "pipeline";
export const SETTINGS_SECTION_LOGGING = "logging";

export type SettingsSectionId =
    | typeof SETTINGS_SECTION_AXIS_TELEMETRY
    | typeof SETTINGS_SECTION_ROBOT_PATH
    | typeof SETTINGS_SECTION_SCANNER_CONNECTION
    | typeof SETTINGS_SECTION_SDK_PATHS
    | typeof SETTINGS_SECTION_DEVICE_PARAMS
    | typeof SETTINGS_SECTION_EXPOSURE_SETTINGS
    | typeof SETTINGS_SECTION_SCAN_PARAMS
    | typeof SETTINGS_SECTION_EXPOSURE_RANGE
    | typeof SETTINGS_SECTION_PIPELINE_BEHAVIOR
    | typeof SETTINGS_SECTION_MESH_PARAMS
    | typeof SETTINGS_SECTION_PATHS
    | typeof SETTINGS_SECTION_PIPELINE
    | typeof SETTINGS_SECTION_LOGGING;

export const SAVE_ONLY_SECTIONS: ReadonlySet<SettingsSectionId> = new Set([
    SETTINGS_SECTION_PIPELINE_BEHAVIOR,
    SETTINGS_SECTION_MESH_PARAMS,
]);

export const SCANNER_NESTED_SECTIONS: ReadonlySet<SettingsSectionId> = new Set([
    SETTINGS_SECTION_SDK_PATHS,
    SETTINGS_SECTION_DEVICE_PARAMS,
    SETTINGS_SECTION_EXPOSURE_SETTINGS,
    SETTINGS_SECTION_SCAN_PARAMS,
    SETTINGS_SECTION_EXPOSURE_RANGE,
    SETTINGS_SECTION_PIPELINE_BEHAVIOR,
    SETTINGS_SECTION_MESH_PARAMS,
]);

export function isScannerNestedSection(sectionId: SettingsSectionId): boolean {
    return SCANNER_NESTED_SECTIONS.has(sectionId);
}

const LOG_LEVEL_OPTIONS = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] as const;

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

function hostError(value: string, hostHint: string): string | undefined {
    const trimmed = value.trim();

    if (!trimmed) {
        return hostHint;
    }

    if (!isValidHost(trimmed)) {
        return hostHint;
    }

    return undefined;
}

export function validateSettingsSection(
    form: RuntimeSettings,
    sectionId: SettingsSectionId,
    hostHint: string,
    markerPathRequired: string,
    scanImportMonitoredFolderRequired: string,
    invalidMarkerRadiusForWorkRange: string,
    invalidScanTargetForGlobalAlign: string,
    invalidMarkerExposureRange: string,
    invalidPointCloudExposureRange: string
): string | undefined {
    const scannerConstraintMessages = {
        invalidMarkerRadiusForWorkRange,
        invalidScanTargetForGlobalAlign,
    };

    switch (sectionId) {
        case SETTINGS_SECTION_AXIS_TELEMETRY: {
            const hostErr = hostError(form.sender_host, hostHint);
            if (hostErr) {
                return hostErr;
            }
            if (!isValidPort(form.sender_port)) {
                return "Invalid port";
            }
            if (form.axis_forward_enabled) {
                const forwardHostErr = hostError(form.axis_forward_host, hostHint);
                if (forwardHostErr) {
                    return forwardHostErr;
                }
                if (!isValidPort(form.axis_forward_port)) {
                    return "Invalid port";
                }
            }
            return undefined;
        }
        case SETTINGS_SECTION_ROBOT_PATH: {
            const hostErr = hostError(form.robot_host, hostHint);
            if (hostErr) {
                return hostErr;
            }
            if (!isValidPort(form.robot_port) || !isValidPort(form.turntable_port)) {
                return "Invalid port";
            }
            return undefined;
        }
        case SETTINGS_SECTION_SCANNER_CONNECTION: {
            const hostErr = hostError(form.scanner_host, hostHint);
            if (hostErr) {
                return hostErr;
            }
            if (!isValidPort(form.scanner_port)) {
                return "Invalid port";
            }
            return undefined;
        }
        case SETTINGS_SECTION_SDK_PATHS: {
            const scanner = form.scanner;
            if (
                !scanner.process_path.trim() ||
                !scanner.project_root.trim() ||
                !scanner.export_root.trim()
            ) {
                return "Required path fields must not be empty";
            }
            return validateScannerConstraints(scanner, scannerConstraintMessages) ?? undefined;
        }
        case SETTINGS_SECTION_DEVICE_PARAMS: {
            return validateScannerConstraints(form.scanner, scannerConstraintMessages) ?? undefined;
        }
        case SETTINGS_SECTION_EXPOSURE_SETTINGS: {
            const exposureError = validateExposureSettings(form.scanner.exposure_settings);
            if (exposureError === "invalid_marker_exposure_range") {
                return invalidMarkerExposureRange;
            }
            if (exposureError === "invalid_point_cloud_exposure_range") {
                return invalidPointCloudExposureRange;
            }
            return validateScannerConstraints(form.scanner, scannerConstraintMessages) ?? undefined;
        }
        case SETTINGS_SECTION_SCAN_PARAMS: {
            return validateScannerConstraints(form.scanner, scannerConstraintMessages) ?? undefined;
        }
        case SETTINGS_SECTION_PATHS: {
            if (!form.paths_folder.trim()) {
                return "Paths folder must not be empty";
            }
            return undefined;
        }
        case SETTINGS_SECTION_PIPELINE: {
            if (
                form.pipeline.import_markers &&
                form.pipeline.marker_framework_path.trim().length === 0
            ) {
                return markerPathRequired;
            }
            if (
                form.pipeline.scan_folder_watcher_enabled &&
                form.pipeline.scan_import_monitored_folder.trim().length === 0
            ) {
                return scanImportMonitoredFolderRequired;
            }
            return undefined;
        }
        case SETTINGS_SECTION_LOGGING: {
            if (!form.log_file_path.trim()) {
                return "Log file path must not be empty";
            }
            if (!LOG_LEVEL_OPTIONS.includes(form.log_level as (typeof LOG_LEVEL_OPTIONS)[number])) {
                return "Invalid log level";
            }
            if (!Number.isInteger(form.poll_interval_ms) || form.poll_interval_ms <= 0) {
                return "Invalid poll interval";
            }
            return undefined;
        }
        default:
            return undefined;
    }
}
