import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";
import { I18nProvider } from "./i18n/I18nProvider";
import { ProjectSaveProvider } from "./project/ProjectSaveContext";
import { applyUiTheme, readInitialUiTheme, ThemeProvider } from "./theme/ThemeProvider";

applyUiTheme(readInitialUiTheme());

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <ErrorBoundary>
            <ThemeProvider>
                <I18nProvider>
                    <ProjectSaveProvider>
                        <App />
                    </ProjectSaveProvider>
                </I18nProvider>
            </ThemeProvider>
        </ErrorBoundary>
    </React.StrictMode>
);