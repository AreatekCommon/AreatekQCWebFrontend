export const WORK_RANGE_LARGE = 1;

export const MARKER_RADIUS_1MM = 1;
export const MARKER_RADIUS_2MM = 2;
export const MARKER_RADIUS_4MM = 4;

export const LARGE_RANGE_ALLOWED_MASK = MARKER_RADIUS_2MM | MARKER_RADIUS_4MM;
export const SMALL_RANGE_ALLOWED_MASK = MARKER_RADIUS_1MM | MARKER_RADIUS_2MM | MARKER_RADIUS_4MM;

export const DEFAULT_MARKER_RADIUS = MARKER_RADIUS_4MM;

export const ALL_MM_SIZES = [MARKER_RADIUS_1MM, MARKER_RADIUS_2MM, MARKER_RADIUS_4MM] as const;

export function allowedMask(workRange: number): number {
    if (workRange === WORK_RANGE_LARGE) {
        return LARGE_RANGE_ALLOWED_MASK;
    }
    return SMALL_RANGE_ALLOWED_MASK;
}

export function encodeMmSizes(sizes: Iterable<number>): number {
    let value = 0;
    for (const size of sizes) {
        value |= size;
    }
    return value;
}

export function selectedMmSizes(value: number): number[] {
    return ALL_MM_SIZES.filter((mm) => (value & mm) !== 0);
}

export function normalizeMarkerRadiusValue(workRange: number, value: number): number {
    const mask = allowedMask(workRange);
    const masked = value & mask;
    if (masked === 0) {
        return DEFAULT_MARKER_RADIUS & mask ? DEFAULT_MARKER_RADIUS : mask;
    }
    return masked;
}

export function isValidMarkerRadius(workRange: number, value: number): boolean {
    if (value === 0) {
        return false;
    }
    const mask = allowedMask(workRange);
    return (value & ~mask) === 0;
}

export function toggleMarkerRadiusMm(current: number, mm: number): number | null {
    if (current & mm) {
        const next = current & ~mm;
        return next === 0 ? null : next;
    }
    return current | mm;
}

export function isMarkerRadiusMmSelected(value: number, mm: number): boolean {
    return (value & mm) !== 0;
}
