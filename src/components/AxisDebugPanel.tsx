import { useEffect, useState } from "react";
import { fetchAxis, fetchSettings } from "../api/client";
import type { AxisSnapshot } from "../types/api";
import { useI18n } from "../i18n/useI18n";

const DEFAULT_POLL_INTERVAL_MS = 2000;

const AXIS_KEYS = ["a1", "a2", "a3", "a4", "a5", "a6"] as const;

function formatAxisValue(value: number | null | undefined): string {
    if (value === null || value === undefined) {
        return "--";
    }

    return value.toFixed(2);
}

export function AxisDebugPanel() {
    const { t } = useI18n();
    const [snapshot, setSnapshot] = useState<AxisSnapshot | null>(null);
    const [pollIntervalMs, setPollIntervalMs] = useState(DEFAULT_POLL_INTERVAL_MS);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function loadPollInterval() {
            try {
                const settings = await fetchSettings();
                if (!cancelled) {
                    setPollIntervalMs(settings.poll_interval_ms);
                }
            } catch {
                if (!cancelled) {
                    setPollIntervalMs(DEFAULT_POLL_INTERVAL_MS);
                }
            }
        }

        void loadPollInterval();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        async function loadAxis() {
            try {
                const data = await fetchAxis();
                if (!cancelled) {
                    setSnapshot(data);
                    setError(null);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : t.common.unknownError);
                }
            }
        }

        void loadAxis();
        const timer = window.setInterval(() => {
            void loadAxis();
        }, pollIntervalMs);

        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [pollIntervalMs, t.common.unknownError]);

    const axisLabels: Record<(typeof AXIS_KEYS)[number], string> = {
        a1: t.axisDebug.a1,
        a2: t.axisDebug.a2,
        a3: t.axisDebug.a3,
        a4: t.axisDebug.a4,
        a5: t.axisDebug.a5,
        a6: t.axisDebug.a6,
    };

    return (
        <div className="card axis-debug-card">
            <div className="axis-debug-header">
                <div className="card-title">{t.axisDebug.title}</div>
                <div className="axis-debug-meta">
                    <span className={snapshot?.connected ? "axis-status connected" : "axis-status disconnected"}>
                        {snapshot?.connected ? t.axisDebug.connected : t.axisDebug.disconnected}
                    </span>
                    <span>{t.axisDebug.samples}: {snapshot?.sample_count ?? 0}</span>
                </div>
            </div>

            {error && <div className="error-text">{error}</div>}
            {!snapshot?.timestamp_ms && !error && (
                <div className="axis-debug-placeholder">{t.axisDebug.noData}</div>
            )}

            <div className="axis-debug-grid">
                {AXIS_KEYS.map((key) => (
                    <div className="axis-debug-item" key={key}>
                        <div className="axis-debug-label">{axisLabels[key]}</div>
                        <div className="axis-debug-value">{formatAxisValue(snapshot?.[key])}</div>
                    </div>
                ))}
            </div>

            {!snapshot?.connected && snapshot?.last_error && (
                <div className="axis-debug-error">{snapshot.last_error}</div>
            )}
        </div>
    );
}
