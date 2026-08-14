import type { ReactNode, SyntheticEvent } from "react";

type SettingsCollapsibleSectionProps = {
    title: string;
    hint?: string;
    nested?: boolean;
    sectionId?: string;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children: ReactNode;
    onSave?: () => void;
    saveLabel?: string;
    saving?: boolean;
    sectionError?: string | null;
    sectionErrorSummary?: string | null;
    sectionErrorDetail?: string | null;
    sectionSuccess?: string | null;
};

export function SettingsCollapsibleSection({
    title,
    hint,
    nested = false,
    sectionId,
    open,
    onOpenChange,
    children,
    onSave,
    saveLabel = "Save",
    saving = false,
    sectionError,
    sectionErrorSummary,
    sectionErrorDetail,
    sectionSuccess,
}: SettingsCollapsibleSectionProps) {
    const className = nested
        ? "settings-collapsible settings-collapsible--nested"
        : "settings-collapsible";

    const showFooter =
        onSave || sectionError || sectionErrorSummary || sectionErrorDetail || sectionSuccess;

    const hasError = Boolean(sectionError || sectionErrorSummary || sectionErrorDetail);

    function handleToggle(event: SyntheticEvent<HTMLDetailsElement>) {
        onOpenChange?.(event.currentTarget.open);
    }

    return (
        <details
            className={className}
            id={sectionId ? `settings-section-${sectionId}` : undefined}
            open={onOpenChange ? (open ?? false) : open}
            onToggle={onOpenChange ? handleToggle : undefined}
        >
            <summary className="settings-section-title">{title}</summary>
            {hint && (
                <div className="settings-section-intro">
                    <p className="settings-section-hint settings-section-hint--intro">{hint}</p>
                </div>
            )}
            <div className="form-grid nested-settings-grid">{children}</div>
            {showFooter && (
                <div
                    className={
                        hasError
                            ? "settings-section-footer settings-section-footer--has-error"
                            : "settings-section-footer"
                    }
                >
                    {onSave && (
                        <button
                            type="button"
                            className="nav-btn active"
                            onClick={onSave}
                            disabled={saving}
                        >
                            {saveLabel}
                        </button>
                    )}
                    {sectionSuccess && <div className="accent-text">{sectionSuccess}</div>}
                    {sectionError && (
                        <div className="error-text settings-section-error-title">{sectionError}</div>
                    )}
                    {sectionErrorSummary && (
                        <div className="error-text settings-section-error-summary">
                            {sectionErrorSummary}
                        </div>
                    )}
                    {sectionErrorDetail && (
                        <pre className="settings-section-error-log">{sectionErrorDetail}</pre>
                    )}
                </div>
            )}
        </details>
    );
}
