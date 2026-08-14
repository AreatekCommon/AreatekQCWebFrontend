import { useCallback, useState } from "react";
import { isLocalApiServer, pickServerFile, pickServerFolder } from "../api/client";
import { useI18n } from "../i18n/useI18n";

type SettingsPathFieldProps = {
    label: string;
    value: string;
    onChange: (value: string) => void;
    mode: "folder" | "file";
    disabled?: boolean;
    placeholder?: string;
    className?: string;
    error?: string;
};

export function SettingsPathField({
    label,
    value,
    onChange,
    mode,
    disabled = false,
    placeholder,
    className = "form-field full-width-field",
    error,
}: SettingsPathFieldProps) {
    const { t } = useI18n();
    const [picking, setPicking] = useState(false);
    const isLocalServer = isLocalApiServer();

    const handleBrowse = useCallback(async () => {
        if (disabled || picking) {
            return;
        }
        try {
            setPicking(true);
            const picked =
                mode === "folder" ? await pickServerFolder() : await pickServerFile();
            if (!picked.cancelled && picked.path) {
                onChange(picked.path);
            }
        } catch {
            // Browse errors are non-fatal; user can still type the path.
        } finally {
            setPicking(false);
        }
    }, [disabled, mode, onChange, picking]);

    return (
        <div className={className}>
            <span>{label}</span>
            <div className="paths-toolbar-row">
                <label className="form-field paths-folder-field settings-path-input-field">
                    <input
                        type="text"
                        className="settings-input"
                        value={value}
                        disabled={disabled}
                        placeholder={placeholder}
                        onChange={(event) => onChange(event.target.value)}
                    />
                </label>
                {isLocalServer && (
                    <button
                        type="button"
                        className="nav-btn"
                        disabled={disabled || picking}
                        onClick={() => void handleBrowse()}
                    >
                        {picking ? "…" : t.pathsPage.browseFolder}
                    </button>
                )}
            </div>
            {isLocalServer && (
                <p className="field-hint">{t.pathsPage.browseFolderHint}</p>
            )}
            {error && <small className="field-error">{error}</small>}
        </div>
    );
}
