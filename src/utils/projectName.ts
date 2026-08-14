import type {
    ProjectNamePart,
    ProjectNameTemplate,
    ProjectNameTimestampFormat,
    ScannerSettings,
} from "../types/api";

function pad2(value: number): string {
    return String(value).padStart(2, "0");
}

function formatTimestamp(format: ProjectNameTimestampFormat, date: Date): string {
    const year = date.getFullYear();
    const month = pad2(date.getMonth() + 1);
    const day = pad2(date.getDate());
    const hours = pad2(date.getHours());
    const minutes = pad2(date.getMinutes());
    const seconds = pad2(date.getSeconds());

    switch (format) {
        case "YYYYMMDD":
            return `${year}${month}${day}`;
        case "HHMMSS":
            return `${hours}${minutes}${seconds}`;
        case "YYYYMMDD_HHMMSS":
            return `${year}${month}${day}_${hours}${minutes}${seconds}`;
        case "YYYY-MM-DD":
            return `${year}-${month}-${day}`;
        case "DDMMYYYY":
            return `${day}${month}${year}`;
        default:
            return `${year}${month}${day}_${hours}${minutes}${seconds}`;
    }
}

function renderPart(part: ProjectNamePart, counter: number, now: Date): string {
    if (part.type === "text") {
        return part.value.trim();
    }
    if (part.type === "increment") {
        return String(counter).padStart(part.width, "0");
    }
    return formatTimestamp(part.format, now);
}

export function templateHasIncrementPart(template: ProjectNameTemplate): boolean {
    return template.parts.some((part) => part.type === "increment");
}

export function assembleProjectName(
    scanner: ScannerSettings,
    now: Date = new Date(),
): string {
    const template = scanner.project_name;

    if (!template.parts.length) {
        return `scan_${formatTimestamp("YYYYMMDD_HHMMSS", now)}`;
    }

    const segments = template.parts
        .map((part) => renderPart(part, scanner.project_name_counter, now))
        .filter(Boolean);

    if (!segments.length) {
        return `scan_${formatTimestamp("YYYYMMDD_HHMMSS", now)}`;
    }

    const sanitized = segments.join("_").replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "");
    return sanitized || `scan_${formatTimestamp("YYYYMMDD_HHMMSS", now)}`;
}

export const PROJECT_NAME_TIMESTAMP_FORMATS: ProjectNameTimestampFormat[] = [
    "YYYYMMDD",
    "HHMMSS",
    "YYYYMMDD_HHMMSS",
    "YYYY-MM-DD",
    "DDMMYYYY",
];

const TIMESTAMP_FORMAT_LABEL_KEYS = {
    YYYYMMDD: "projectNameFormatYYYYMMDD",
    HHMMSS: "projectNameFormatHHMMSS",
    YYYYMMDD_HHMMSS: "projectNameFormatYYYYMMDD_HHMMSS",
    "YYYY-MM-DD": "projectNameFormatYYYYMMDDdashMMdashDD",
    DDMMYYYY: "projectNameFormatDDMMYYYY",
} as const;

export { TIMESTAMP_FORMAT_LABEL_KEYS };

export function createTextPart(value = ""): ProjectNamePart {
    return { type: "text", value };
}

export function createIncrementPart(width = 1): ProjectNamePart {
    return { type: "increment", width };
}

export function createTimestampPart(
    format: ProjectNameTimestampFormat = "YYYYMMDD_HHMMSS",
): ProjectNamePart {
    return { type: "timestamp", format };
}
