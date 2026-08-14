import { useCallback, useEffect, useState } from "react";
import { fetchCycleHistory } from "../api/client";
import type { CycleHistoryEntry } from "../types/api";
import { useI18n } from "../i18n/useI18n";
import { formatCycleDuration } from "../utils/formatCycleDuration";

function formatLocalDateTime(isoTimestamp: string): string {
    const parsed = new Date(isoTimestamp);
    if (Number.isNaN(parsed.getTime())) {
        return isoTimestamp;
    }
    return parsed.toLocaleString();
}

export function CycleHistoryPage() {
    const { t } = useI18n();
    const [entries, setEntries] = useState<CycleHistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadHistory = useCallback(async () => {
        try {
            setLoading(true);
            const data = await fetchCycleHistory();
            setEntries(data.entries);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : t.common.unknownError);
        } finally {
            setLoading(false);
        }
    }, [t.common.unknownError]);

    useEffect(() => {
        void loadHistory();
    }, [loadHistory]);

    return (
        <div className="page cycle-history-page">
            <div className="card">
                <div className="card-title">{t.cycleHistory.title}</div>
                <div className="cycle-history-toolbar">
                    <button type="button" className="nav-btn" onClick={() => void loadHistory()}>
                        {t.cycleHistory.refresh}
                    </button>
                </div>

                {loading && <div className="cycle-history-status">{t.dashboard.loading}</div>}
                {error && <div className="error-text">{error}</div>}

                {!loading && !error && entries.length === 0 && (
                    <p className="settings-section-hint cycle-history-status">{t.cycleHistory.empty}</p>
                )}

                {!loading && entries.length > 0 && (
                    <div className="cycle-history-table-wrap">
                        <table className="cycle-history-table">
                            <thead>
                                <tr>
                                    <th>{t.cycleHistory.columns.startedAt}</th>
                                    <th>{t.cycleHistory.columns.startToExport}</th>
                                    <th>{t.cycleHistory.columns.projectName}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map((entry, index) => {
                                    const hasDuration = entry.duration_sec != null;
                                    return (
                                        <tr key={`${entry.started_at}-${entry.project_name}-${index}`}>
                                            <td>{formatLocalDateTime(entry.started_at)}</td>
                                            <td
                                                className={`cycle-history-col-duration${
                                                    hasDuration ? "" : " cycle-history-no-export"
                                                }`}
                                            >
                                                {hasDuration
                                                    ? formatCycleDuration(entry.duration_sec!)
                                                    : t.cycleHistory.noExport}
                                            </td>
                                            <td className="cycle-history-col-project">
                                                {entry.project_name || t.common.empty}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
