import { useI18n } from "../i18n/useI18n";
import { useProjectSaveRegistry } from "../project/ProjectSaveContext";
import { ThemeSwitch } from "./ThemeSwitch";

type HeaderProps = {
    title: string;
};

export function Header({ title }: HeaderProps) {
    const { locale, setLocale, t } = useI18n();
    const { activeProjectName } = useProjectSaveRegistry();

    return (
        <header className="app-header">
            <div className="app-header-inner">
                <img src="/logo.svg" alt="" className="app-logo" />
                <div className="app-header-title-group">
                    <h1>{title}</h1>
                    {activeProjectName && (
                        <span className="app-header-project-name">{activeProjectName}</span>
                    )}
                </div>
                <div className="app-header-actions">
                    <button
                        type="button"
                        className="nav-btn"
                        onClick={() => setLocale(locale === "ru" ? "en" : "ru")}
                    >
                        {locale === "ru" ? t.language.switchToEnglish : t.language.switchToRussian}
                    </button>
                    <ThemeSwitch />
                </div>
            </div>
        </header>
    );
}
