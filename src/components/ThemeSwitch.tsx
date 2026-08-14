import { useTheme, type UiTheme } from "../theme/ThemeProvider";

const OPTIONS: Array<{ id: UiTheme; label: string }> = [
    { id: "areatek", label: "Areatek" },
    { id: "3dvision", label: "3DVision" },
];

export function ThemeSwitch() {
    const { theme, setTheme } = useTheme();

    return (
        <div className="theme-switch" role="group" aria-label="UI theme">
            {OPTIONS.map((option) => (
                <button
                    key={option.id}
                    type="button"
                    className={theme === option.id ? "theme-switch-btn active" : "theme-switch-btn"}
                    aria-pressed={theme === option.id}
                    onClick={() => setTheme(option.id)}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}
