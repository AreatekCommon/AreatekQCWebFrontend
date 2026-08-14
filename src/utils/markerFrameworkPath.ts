const CYCLE_SCAN_EXPORT_PATTERN = /scan_\d{8}_\d{6}\.p3$/i;

export function looksLikeCycleScanExport(path: string): boolean {
    const trimmed = path.trim();
    if (!trimmed) {
        return false;
    }

    const fileName = trimmed.replace(/\\/g, "/").split("/").pop() ?? trimmed;
    return CYCLE_SCAN_EXPORT_PATTERN.test(fileName);
}
