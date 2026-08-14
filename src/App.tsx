import { lazy, Suspense, useState } from "react";
import { CameraPreviewWidget } from "./components/CameraPreviewWidget";
import { Header } from "./components/Header";
import { LogWidget } from "./components/LogWidget";
import { SavedProjectSection } from "./components/SavedProjectSection";
import { useI18n } from "./i18n/useI18n";
import { DashboardPage } from "./pages/DashboardPage";
import { SettingsPage } from "./pages/SettingsPage";

const PathsPage = lazy(() =>
    import("./pages/PathsPage").then((module) => ({ default: module.PathsPage })),
);

const CycleHistoryPage = lazy(() =>
    import("./pages/CycleHistoryPage").then((module) => ({
        default: module.CycleHistoryPage,
    })),
);

type PageKey = "dashboard" | "paths" | "cycleHistory";

export default function App() {
    const { t } = useI18n();
    const [page, setPage] = useState<PageKey>("dashboard");

    return (
        <div className="app-shell">
            <Header title={t.app.title} />

            <nav className="top-nav">
                <button
                    className={page === "dashboard" ? "nav-btn active" : "nav-btn"}
                    onClick={() => setPage("dashboard")}
                    type="button"
                >
                    {t.nav.dashboard}
                </button>

                <button
                    className={page === "paths" ? "nav-btn active" : "nav-btn"}
                    onClick={() => setPage("paths")}
                    type="button"
                >
                    {t.nav.paths}
                </button>

                <button
                    className={page === "cycleHistory" ? "nav-btn active" : "nav-btn"}
                    onClick={() => setPage("cycleHistory")}
                    type="button"
                >
                    {t.nav.cycleHistory}
                </button>
            </nav>

            <div className="app-body">
                <main className="main-content">
                    {page === "dashboard" && <DashboardPage />}
                    {page === "paths" && (
                        <Suspense fallback={<div className="page">{t.dashboard.loading}</div>}>
                            <PathsPage />
                        </Suspense>
                    )}
                    {page === "cycleHistory" && (
                        <Suspense fallback={<div className="page">{t.dashboard.loading}</div>}>
                            <CycleHistoryPage />
                        </Suspense>
                    )}
                </main>

                <aside className="settings-rail" aria-label={t.settings.title}>
                    <div className="project-rail-panel">
                        <SavedProjectSection />
                    </div>
                    <SettingsPage />
                </aside>
            </div>

            <CameraPreviewWidget />
            <LogWidget />
        </div>
    );
}
