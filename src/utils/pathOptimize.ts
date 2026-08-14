import type { PathNode } from "../types/api";
import { quantizeTurntableAngle, shouldSwapAdvancedScan } from "./pathOptimizeCore";

export { quantizeTurntableAngle, shouldSwapAdvancedScan } from "./pathOptimizeCore";

export function optimizePathNodes(nodes: PathNode[]): PathNode[] {
    let lastScanExitAngle: number | null = null;

    return nodes.map((node) => {
        const next = { ...node, turntable: { ...node.turntable } };

        if (node.type === "basic_scan") {
            const angle = quantizeTurntableAngle(next.turntable.angle ?? 0);
            next.turntable = { ...next.turntable, angle };
            lastScanExitAngle = angle;
            return next;
        }

        if (node.type === "advanced_scan") {
            const scanMode = next.turntable.advanced_scan_mode ?? "range";
            let startAngle = next.turntable.start_angle ?? 0;

            if (scanMode === "step") {
                const stepAngle = next.turntable.step_angle ?? 90;
                const scanCount = next.turntable.scan_count ?? 1;
                startAngle = quantizeTurntableAngle(startAngle);
                next.turntable = { ...next.turntable, start_angle: startAngle };
                lastScanExitAngle =
                    scanCount <= 1
                        ? startAngle
                        : quantizeTurntableAngle(startAngle + (scanCount - 1) * stepAngle);
                return next;
            }

            let endAngle = next.turntable.end_angle ?? 360;

            if (lastScanExitAngle !== null) {
                if (shouldSwapAdvancedScan(lastScanExitAngle, startAngle, endAngle)) {
                    [startAngle, endAngle] = [endAngle, startAngle];
                }
            }

            startAngle = quantizeTurntableAngle(startAngle);
            endAngle = quantizeTurntableAngle(endAngle);
            next.turntable = { ...next.turntable, start_angle: startAngle, end_angle: endAngle };
            lastScanExitAngle = endAngle;
            return next;
        }

        return next;
    });
}
