import type { ScannerExposureSettings } from "../types/api";

export type ExposureMode = ScannerExposureSettings["mode"];
export type CustomizedSlots = ScannerExposureSettings["customized_slots"];

export const MARKER_EXP_MIN = 1;
export const MARKER_EXP_MAX = 25;
export const POINT_CLOUD_EXP_MIN = 1;
export const POINT_CLOUD_EXP_MAX = 60;

export type WireExposurePayload = {
    exp_type: number;
    marker_exp: number;
    val1: number;
    val2: number;
    val3: number;
};

function clamp(value: number, minimum: number, maximum: number): number {
    return Math.max(minimum, Math.min(maximum, value));
}

export function activePointCloudSlots(
    mode: ExposureMode,
    customizedSlots: CustomizedSlots
): ReadonlySet<number> {
    if (mode === "auto") {
        return new Set();
    }
    if (mode === "first") {
        return new Set([1]);
    }
    if (mode === "second") {
        return new Set([2]);
    }
    if (mode === "third") {
        return new Set([3]);
    }
    if (customizedSlots === "first") {
        return new Set([1]);
    }
    if (customizedSlots === "first_second") {
        return new Set([1, 2]);
    }
    return new Set([1, 2, 3]);
}

export function isMarkerEditable(mode: ExposureMode): boolean {
    return mode !== "auto";
}

export function isPointCloudSlotEditable(
    mode: ExposureMode,
    customizedSlots: CustomizedSlots,
    slot: number
): boolean {
    return activePointCloudSlots(mode, customizedSlots).has(slot);
}

export function inferExposureModeFromLegacy(
    expType: number,
    val1: number,
    val2: number,
    val3: number
): { mode: ExposureMode; customizedSlots: CustomizedSlots } {
    if (expType === 1) {
        return { mode: "auto", customizedSlots: "first" };
    }

    const active = [1, 2, 3].filter((index) => [val1, val2, val3][index - 1] > 1);
    if (active.length === 0) {
        return { mode: "first", customizedSlots: "first" };
    }
    if (active.length === 1) {
        const slot = active[0];
        if (slot === 1) {
            return { mode: "first", customizedSlots: "first" };
        }
        if (slot === 2) {
            return { mode: "second", customizedSlots: "first" };
        }
        return { mode: "third", customizedSlots: "first" };
    }
    if (active.length === 2 && active[0] === 1 && active[1] === 2) {
        return { mode: "customized", customizedSlots: "first_second" };
    }
    return { mode: "customized", customizedSlots: "all" };
}

type LegacyDeviceExposure = {
    exp_type?: number;
    marker_exp?: number;
    val1?: number;
    val2?: number;
    val3?: number;
};

export function migrateLegacyExposureSettings(
    device: LegacyDeviceExposure
): ScannerExposureSettings {
    const expType = device.exp_type ?? 1;
    const markerExp = device.marker_exp ?? 8;
    const val1 = device.val1 ?? 22;
    const val2 = device.val2 ?? 1;
    const val3 = device.val3 ?? 1;
    const { mode, customizedSlots } = inferExposureModeFromLegacy(expType, val1, val2, val3);

    return {
        mode,
        customized_slots: customizedSlots,
        marker_exp: clamp(markerExp, MARKER_EXP_MIN, MARKER_EXP_MAX),
        val1: clamp(val1, POINT_CLOUD_EXP_MIN, POINT_CLOUD_EXP_MAX),
        val2: clamp(val2, POINT_CLOUD_EXP_MIN, POINT_CLOUD_EXP_MAX),
        val3: clamp(val3, POINT_CLOUD_EXP_MIN, POINT_CLOUD_EXP_MAX),
    };
}

export function encodeExposureWire(settings: ScannerExposureSettings): WireExposurePayload {
    if (settings.mode === "auto") {
        return {
            exp_type: 1,
            marker_exp: 1,
            val1: 1,
            val2: 1,
            val3: 1,
        };
    }

    const active = activePointCloudSlots(settings.mode, settings.customized_slots);
    return {
        exp_type: 0,
        marker_exp: settings.marker_exp,
        val1: active.has(1) ? settings.val1 : 1,
        val2: active.has(2) ? settings.val2 : 1,
        val3: active.has(3) ? settings.val3 : 1,
    };
}

export function validateExposureSettings(settings: ScannerExposureSettings): string | null {
    if (
        settings.marker_exp < MARKER_EXP_MIN ||
        settings.marker_exp > MARKER_EXP_MAX
    ) {
        return "invalid_marker_exposure_range";
    }

    for (const value of [settings.val1, settings.val2, settings.val3]) {
        if (value < POINT_CLOUD_EXP_MIN || value > POINT_CLOUD_EXP_MAX) {
            return "invalid_point_cloud_exposure_range";
        }
    }

    return null;
}
