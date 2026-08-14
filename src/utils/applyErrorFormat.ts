import type { SdkApplyErrorDetail, SettingsUpdateResponse } from "../types/api";

export function buildApplyErrorDetail(
    detail: SdkApplyErrorDetail | null | undefined
): string | null {
    if (!detail) {
        return null;
    }

    const lines: string[] = [];

    if (detail.command) {
        lines.push(`Command: ${detail.command}`);
    }
    if (detail.result) {
        lines.push(`Result: ${detail.result}`);
    }
    if (detail.error_code_hex) {
        const decimalSuffix =
            detail.ret_code != null ? ` (decimal ${detail.ret_code})` : "";
        lines.push(`Error code: ${detail.error_code_hex}${decimalSuffix}`);
    } else if (detail.ret_code != null) {
        lines.push(`Error code: ${detail.ret_code}`);
    }
    if (detail.message) {
        lines.push(`Message: ${detail.message}`);
    }
    if (detail.begin_json) {
        lines.push(`Begin JSON: ${detail.begin_json}`);
    }
    if (detail.finish_json) {
        lines.push(`Finish JSON: ${detail.finish_json}`);
    }

    return lines.length > 0 ? lines.join("\n") : null;
}

export function buildApplyErrorLog(
    applyError: string | null | undefined,
    detail: SdkApplyErrorDetail | null | undefined
): string | null {
    const parts = [applyError, buildApplyErrorDetail(detail)].filter(
        (part): part is string => Boolean(part && part.trim())
    );

    return parts.length > 0 ? parts.join("\n\n") : null;
}

export type ApplyErrorPresentation = {
    title: string;
    summary: string | null;
    detailLog: string | null;
};

export function formatApplyErrorPresentation(
    response: Pick<
        SettingsUpdateResponse,
        "applied" | "apply_error" | "apply_error_detail"
    >,
    labels: {
        failedTitle: string;
        summary: string;
        deferred: string;
    }
): ApplyErrorPresentation | null {
    if (response.apply_error) {
        return {
            title: labels.failedTitle,
            summary: labels.summary,
            detailLog: buildApplyErrorLog(response.apply_error, response.apply_error_detail),
        };
    }

    if (!response.applied) {
        return {
            title: labels.deferred,
            summary: null,
            detailLog: null,
        };
    }

    return null;
}
