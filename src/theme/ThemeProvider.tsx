import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";

export type UiTheme = "areatek" | "3dvision";

const STORAGE_KEY = "areatekqc-ui-theme";
const DEFAULT_THEME: UiTheme = "areatek";

function readStoredTheme(): UiTheme {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === "areatek" || stored === "3dvision") {
            return stored;
        }
    } catch {
        // ignore storage errors
    }
    return DEFAULT_THEME;
}

export function applyUiTheme(theme: UiTheme): void {
    document.documentElement.dataset.theme = theme;
}

export function readInitialUiTheme(): UiTheme {
    return readStoredTheme();
}

type ThemeContextValue = {
    theme: UiTheme;
    setTheme: (theme: UiTheme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<UiTheme>(() => readStoredTheme());

    useEffect(() => {
        applyUiTheme(theme);
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch {
            // ignore storage errors
        }
    }, [theme]);

    const setTheme = useCallback((nextTheme: UiTheme) => {
        setThemeState(nextTheme);
    }, []);

    const value = useMemo(
        () => ({
            theme,
            setTheme,
        }),
        [theme, setTheme],
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
    const context = useContext(ThemeContext);
    if (context === null) {
        throw new Error("useTheme must be used within ThemeProvider");
    }
    return context;
}
