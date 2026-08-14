import type { PathPosition } from "../types/api";

const COUNTS_PER_REV = 300000;

export function quantizeTurntableAngle(angleDeg: number): number {
    const counts = Math.round((angleDeg / 360.0) * COUNTS_PER_REV);
    const clamped = Math.max(0, Math.min(COUNTS_PER_REV, counts));
    return (clamped / COUNTS_PER_REV) * 360.0;
}

export function angularDistance(a: number, b: number): number {
    const qa = quantizeTurntableAngle(a);
    const qb = quantizeTurntableAngle(b);
    let diff = Math.abs(qa - qb) % 360;
    if (diff > 180) {
        diff = 360 - diff;
    }
    return diff;
}

export function shouldSwapAdvancedScan(
    lastScanExitAngle: number,
    startAngle: number,
    endAngle: number,
): boolean {
    const distToStart = angularDistance(lastScanExitAngle, startAngle);
    const distToEnd = angularDistance(lastScanExitAngle, endAngle);

    if (distToEnd < distToStart) {
        return true;
    }

    return (
        distToEnd === distToStart &&
        distToStart === 0 &&
        startAngle !== lastScanExitAngle
    );
}

/** @deprecated Use optimizePathNodes instead. */
export function optimizePathPositions(positions: PathPosition[]): PathPosition[] {
    let lastScanExitAngle: number | null = null;

    return positions.map((position) => {
        if (position.type === "basic_scan") {
            const angle = quantizeTurntableAngle(position.turntable.angle ?? 0);
            lastScanExitAngle = angle;
            return {
                ...position,
                turntable: { ...position.turntable, angle },
            };
        }

        if (position.type === "advanced_scan") {
            const scanMode = position.turntable.advanced_scan_mode ?? "range";
            let startAngle = position.turntable.start_angle ?? 0;

            if (scanMode === "step") {
                const stepAngle = position.turntable.step_angle ?? 90;
                const scanCount = position.turntable.scan_count ?? 1;
                startAngle = quantizeTurntableAngle(startAngle);
                lastScanExitAngle =
                    scanCount <= 1
                        ? startAngle
                        : quantizeTurntableAngle(startAngle + (scanCount - 1) * stepAngle);

                return {
                    ...position,
                    turntable: {
                        ...position.turntable,
                        start_angle: startAngle,
                    },
                };
            }

            let endAngle = position.turntable.end_angle ?? 360;

            if (lastScanExitAngle !== null) {
                if (shouldSwapAdvancedScan(lastScanExitAngle, startAngle, endAngle)) {
                    [startAngle, endAngle] = [endAngle, startAngle];
                }
            }

            startAngle = quantizeTurntableAngle(startAngle);
            endAngle = quantizeTurntableAngle(endAngle);
            lastScanExitAngle = endAngle;

            return {
                ...position,
                turntable: {
                    ...position.turntable,
                    start_angle: startAngle,
                    end_angle: endAngle,
                },
            };
        }

        return position;
    });
}
