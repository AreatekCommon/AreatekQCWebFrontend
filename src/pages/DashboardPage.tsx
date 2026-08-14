import { useEffect, useState } from "react";
import { fetchHealth } from "../api/client";
import { AxisDebugPanel } from "../components/AxisDebugPanel";
import { PathVisualizerPanel } from "../components/PathVisualizerPanel";
import { PipelineControlPanel } from "../components/PipelineControlPanel";
import { StatusCard } from "../components/StatusCard";
import type { HealthResponse, PipelineStatus } from "../types/api";

export function DashboardPage() {
    const [health, setHealth] = useState<HealthResponse | null>(null);
    const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    async function loadHealth() {
        try {
            setError(null);
            const data = await fetchHealth();
            setHealth(data);
        } catch (err) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError("Неизвестная ошибка");
            }
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadHealth();
        const timer = window.setInterval(loadHealth, 2000);
        return () => window.clearInterval(timer);
    }, []);

    if (loading) {
        return <div className="page">Загрузка состояния backend...</div>;
    }

    if (error) {
        return <div className="page error-text">Ошибка: {error}</div>;
    }

    return (
        <div className="page">
            <div className="card-grid">
                <StatusCard title="Статус" value={health?.status ?? "-"} />
                <StatusCard title="Запущен" value={(health?.is_running ?? false) ? "Да" : "Нет"} />
                <StatusCard title="Время запуска" value={health?.started_at ?? "-"} />
                <StatusCard
                    title="Подключено веб-клиентов"
                    value={String(health?.connected_web_clients ?? 0)}
                />
                <StatusCard title="Последняя ошибка" value={health?.last_error ?? "-"} />
            </div>

            <PipelineControlPanel onStatusChange={setPipelineStatus} />

            <div className="robot-visualization-stack">
                <AxisDebugPanel />
                <PathVisualizerPanel
                    activeStepIndex={pipelineStatus?.current_step_index ?? null}
                    resendStepIndices={pipelineStatus?.position_resend_step_indices ?? []}
                />
            </div>
        </div>
    );
}