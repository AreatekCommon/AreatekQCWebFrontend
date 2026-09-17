import type { RuntimeSettings, ScannerScanParams, ScannerSettings } from "../types/api";
import {
    isValidMarkerRadius,
    normalizeMarkerRadiusValue,
} from "./markerRadius";

export const WORK_RANGE_SMALL = 0;
export const WORK_RANGE_LARGE = 1;
export const ALIGN_MOD_GLOBAL_MARKER = 8;
export const ALIGN_MOD_MARKER = 4;

export const RESOLUTION_LOW = 1;
export const RESOLUTION_MID = 2;
export const RESOLUTION_HIGH = 3;

export const LARGE_RANGE_MARKER_RADII = [2, 4] as const;
export const SMALL_RANGE_MARKER_RADII = [1, 2, 4] as const;

export type ScanTargetMode = "pointCloud" | "markers";

export type ScannerConstraintMessages = {
    invalidMarkerRadiusForWorkRange: string;
    invalidScanTargetForGlobalAlign: string;
};

export function getAllowedMarkerRadii(
    workRange: number,
    resolution?: number
): readonly number[] {
    if (workRange === WORK_RANGE_LARGE) {
        // Large range allows 2/4 mm for all resolutions; low/mid resolution (isHD 0)
        // still rejects disallowed radii at the SDK — bulk apply sends resolution with radius.
        void resolution;
        return LARGE_RANGE_MARKER_RADII;
    }
    return SMALL_RANGE_MARKER_RADII;
}

export function shouldShowMarkerRadiusResolutionHint(
    workRange: number,
    resolution: number
): boolean {
    return (
        workRange === WORK_RANGE_LARGE &&
        (resolution === RESOLUTION_LOW || resolution === RESOLUTION_MID)
    );
}

export function normalizeMarkerRadius(
    workRange: number,
    radius: number,
    resolution?: number
): number {
    void resolution;
    return normalizeMarkerRadiusValue(workRange, radius);
}

export function normalizeScanTarget(scan: ScannerScanParams): ScannerScanParams {
    if (scan.scan_markers && scan.scan_point_cloud) {
        return {
            ...scan,
            scan_point_cloud: true,
            scan_markers: false,
        };
    }
    return scan;
}

export function getScanTargetHint(scanTargetExclusiveHint: string): string {
    return scanTargetExclusiveHint;
}

export function getScanTargetMode(scan: ScannerScanParams): ScanTargetMode {
    if (scan.scan_markers && !scan.scan_point_cloud) {
        return "markers";
    }
    return "pointCloud";
}

export function applyScanTargetMode(
    scan: ScannerScanParams,
    mode: ScanTargetMode
): ScannerScanParams {
    if (mode === "markers") {
        return {
            ...scan,
            scan_markers: true,
            scan_point_cloud: false,
        };
    }

    const leavingMarkers = scan.scan_markers && !scan.scan_point_cloud;
    return {
        ...scan,
        scan_markers: false,
        scan_point_cloud: true,
        align_mod: leavingMarkers ? ALIGN_MOD_MARKER : scan.align_mod,
    };
}

export function isMarkersOnlyScanMode(scan: ScannerScanParams): boolean {
    return scan.scan_markers && !scan.scan_point_cloud;
}

export function applyPointCloudScannerSettings(scanner: ScannerSettings): ScannerSettings {
    if (isMarkersOnlyScanMode(scanner.scan)) {
        return scanner;
    }

    if (scanner.save_type === "p3") {
        return {
            ...scanner,
            save_type: "stl",
        };
    }

    return scanner;
}

export function applyMarkersOnlyScannerSettings(scanner: ScannerSettings): ScannerSettings {
    if (!isMarkersOnlyScanMode(scanner.scan)) {
        return scanner;
    }

    return {
        ...scanner,
        save_type: "p3",
        scan: {
            ...scanner.scan,
            align_mod: ALIGN_MOD_GLOBAL_MARKER,
        },
    };
}

export function normalizeScannerSettings(scanner: ScannerSettings): ScannerSettings {
    const marker_radius = normalizeMarkerRadius(
        scanner.work_range,
        scanner.scan.marker_radius,
        scanner.scan.resolution
    );
    const scanWithRadius = { ...scanner.scan, marker_radius };
    const scan = normalizeScanTarget(scanWithRadius);

    const withScanTarget = isMarkersOnlyScanMode(scan)
        ? applyMarkersOnlyScannerSettings({ ...scanner, scan })
        : applyPointCloudScannerSettings({ ...scanner, scan });

    return withScanTarget;
}

export function applyMarkersOnlyRuntimeSettings(settings: RuntimeSettings): RuntimeSettings {
    const scanner = normalizeScannerSettings(settings.scanner);
    if (!isMarkersOnlyScanMode(scanner.scan)) {
        return {
            ...settings,
            scanner,
        };
    }

    return {
        ...settings,
        scanner,
        pipeline: {
            ...settings.pipeline,
            import_markers: false,
        },
    };
}

export function normalizeRuntimeSettings(settings: RuntimeSettings): RuntimeSettings {
    return applyMarkersOnlyRuntimeSettings(settings);
}

export function validateScannerConstraints(
    scanner: ScannerSettings,
    messages: ScannerConstraintMessages
): string | null {
    if (!isValidMarkerRadius(scanner.work_range, scanner.scan.marker_radius)) {
        return messages.invalidMarkerRadiusForWorkRange;
    }

    if (scanner.scan.scan_markers && scanner.scan.scan_point_cloud) {
        return messages.invalidScanTargetForGlobalAlign;
    }

    return null;
}

export function markerRadiusOptionLabelKey(
    radius: number
): "markerRadius1mm" | "markerRadius2mm" | "markerRadius4mm" {
    if (radius === 1) {
        return "markerRadius1mm";
    }
    if (radius === 2) {
        return "markerRadius2mm";
    }
    return "markerRadius4mm";
}
