const BASENAME_PATTERN = /^[^./\\]+$/;

export function ensureJsonExtension(filename: string): string {
    const trimmed = filename.trim();
    if (!trimmed) {
        return "";
    }
    return trimmed.toLowerCase().endsWith(".json") ? trimmed : `${trimmed}.json`;
}

export function validatePathBasename(name: string): string | null {
    const trimmed = name.trim();
    if (!trimmed) {
        return "empty";
    }
    const withoutExtension = trimmed.replace(/\.json$/i, "");
    if (!withoutExtension) {
        return "empty";
    }
    if (!BASENAME_PATTERN.test(withoutExtension)) {
        return "invalid";
    }
    return null;
}

export function formatPathDisplayName(filename: string): string {
    return filename.replace(/\.json$/i, "");
}

export function buildCopyTargetStem(sourceFilename: string): string {
    return `${formatPathDisplayName(sourceFilename)}_copy`;
}
