import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchLogs } from "../api/client";
import { useI18n } from "../i18n/useI18n";

const MAX_LINES = 300;
const INITIAL_LOG_LIMIT = 150;
const RECONNECT_DELAY_MS = 2000;
const STORAGE_KEY = "areatekqc.logWidget.size";
const DEFAULT_WIDTH = 420;
const DEFAULT_HEIGHT = 240;
const MIN_WIDTH = 280;
const MIN_HEIGHT = 160;

type WidgetSize = {
    width: number;
    height: number;
};

function clampSize(size: WidgetSize): WidgetSize {
    const maxWidth = Math.floor(window.innerWidth * 0.8);
    const maxHeight = Math.floor(window.innerHeight * 0.7);

    return {
        width: Math.min(Math.max(size.width, MIN_WIDTH), maxWidth),
        height: Math.min(Math.max(size.height, MIN_HEIGHT), maxHeight),
    };
}

function readStoredSize(): WidgetSize {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
        }

        const parsed = JSON.parse(raw) as WidgetSize;
        if (
            typeof parsed.width !== "number" ||
            typeof parsed.height !== "number"
        ) {
            return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
        }

        return clampSize(parsed);
    } catch {
        return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
    }
}

export function LogWidget() {
    const { t } = useI18n();

    const [isOpen, setIsOpen] = useState(false);
    const [lines, setLines] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [connectionLost, setConnectionLost] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [size, setSize] = useState<WidgetSize>(() => readStoredSize());

    const bodyRef = useRef<HTMLDivElement | null>(null);
    const reconnectTimerRef = useRef<number | null>(null);
    const socketRef = useRef<WebSocket | null>(null);
    const shouldReconnectRef = useRef(true);
    const resizeStateRef = useRef<{ startX: number; startY: number; startWidth: number; startHeight: number } | null>(null);
    const sizeRef = useRef(size);

    useEffect(() => {
        sizeRef.current = size;
    }, [size]);

    const persistSize = useCallback((nextSize: WidgetSize) => {
        const clamped = clampSize(nextSize);
        setSize(clamped);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clamped));
    }, []);

    async function loadInitialLogs() {
        try {
            setLoading(true);
            const data = await fetchLogs(INITIAL_LOG_LIMIT);
            setLines(data.lines.slice(-MAX_LINES));
        } catch {
            setConnectionLost(true);
        } finally {
            setLoading(false);
        }
    }

    function appendLine(nextLine: string) {
        setLines((prev) => {
            const merged = [...prev, nextLine];
            if (merged.length <= MAX_LINES) {
                return merged;
            }
            return merged.slice(merged.length - MAX_LINES);
        });
    }

    function isNearBottom(node: HTMLDivElement) {
        return node.scrollHeight - node.scrollTop - node.clientHeight < 40;
    }

    function scrollToBottom() {
        const node = bodyRef.current;
        if (!node) {
            return;
        }

        node.scrollTop = node.scrollHeight;
    }

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void loadInitialLogs();
        }, 0);

        return () => window.clearTimeout(timer);
    }, []);

    useEffect(() => {
        shouldReconnectRef.current = true;

        const connect = () => {
            const protocol = window.location.protocol === "https:" ? "wss" : "ws";
            const backendHost = `${window.location.hostname}:8000`;
            const socket = new WebSocket(`${protocol}://${backendHost}/ws/logs`);

            socketRef.current = socket;

            socket.onopen = () => {
                setConnectionLost(false);
            };

            socket.onmessage = (event) => {
                const nextLine = String(event.data ?? "");
                const node = bodyRef.current;
                const shouldAutoScroll = !node || isNearBottom(node);

                appendLine(nextLine);

                if (shouldAutoScroll) {
                    requestAnimationFrame(() => {
                        scrollToBottom();
                    });
                }
            };

            socket.onerror = () => {
                setConnectionLost(true);
            };

            socket.onclose = () => {
                setConnectionLost(true);

                if (!shouldReconnectRef.current) {
                    return;
                }

                reconnectTimerRef.current = window.setTimeout(() => {
                    connect();
                }, RECONNECT_DELAY_MS);
            };
        };

        connect();

        return () => {
            shouldReconnectRef.current = false;

            if (reconnectTimerRef.current !== null) {
                window.clearTimeout(reconnectTimerRef.current);
            }

            if (socketRef.current) {
                socketRef.current.close();
            }
        };
    }, []);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const node = bodyRef.current;
        if (!node) {
            return;
        }

        node.scrollTop = node.scrollHeight;
    }, [isOpen]);

    useEffect(() => {
        function handleWindowResize() {
            setSize((current) => clampSize(current));
        }

        window.addEventListener("resize", handleWindowResize);
        return () => window.removeEventListener("resize", handleWindowResize);
    }, []);

    useEffect(() => {
        function handlePointerMove(event: PointerEvent) {
            const resizeState = resizeStateRef.current;
            if (!resizeState) {
                return;
            }

            const deltaX = event.clientX - resizeState.startX;
            const deltaY = event.clientY - resizeState.startY;

            persistSize({
                width: resizeState.startWidth - deltaX,
                height: resizeState.startHeight - deltaY,
            });
        }

        function handlePointerUp() {
            resizeStateRef.current = null;
        }

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
        window.addEventListener("pointercancel", handlePointerUp);

        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
            window.removeEventListener("pointercancel", handlePointerUp);
        };
    }, [persistSize]);

    function handleResizePointerDown(event: React.PointerEvent<HTMLDivElement>) {
        event.preventDefault();
        event.stopPropagation();
        resizeStateRef.current = {
            startX: event.clientX,
            startY: event.clientY,
            startWidth: sizeRef.current.width,
            startHeight: sizeRef.current.height,
        };
    }

    const normalizedQuery = searchQuery.trim().toLowerCase();

    const filteredLines = useMemo(() => {
        if (!normalizedQuery) {
            return lines;
        }
        return lines.filter((line) => line.toLowerCase().includes(normalizedQuery));
    }, [lines, normalizedQuery]);

    const content = useMemo(() => {
        if (loading && lines.length === 0) {
            return <div className="log-widget-placeholder">{t.logWidget.loading}</div>;
        }

        if (lines.length === 0) {
            return <div className="log-widget-placeholder">{t.logWidget.empty}</div>;
        }

        if (normalizedQuery && filteredLines.length === 0) {
            return <div className="log-widget-placeholder">{t.logWidget.noMatches}</div>;
        }

        return <pre className="log-widget-pre">{filteredLines.join("\n")}</pre>;
    }, [filteredLines, lines.length, loading, normalizedQuery, t]);

    if (!isOpen) {
        return (
            <button
                className="log-widget-toggle"
                type="button"
                onClick={() => setIsOpen(true)}
            >
                {t.logWidget.open}
            </button>
        );
    }

    return (
        <div
            className="log-widget"
            style={{ width: `${size.width}px`, height: `${size.height}px` }}
        >
            <div className="log-widget-header">
                <div className="log-widget-title-wrap">
                    <div className="log-widget-title">{t.logWidget.title}</div>
                    {connectionLost && (
                        <div className="log-widget-connection-lost">
                            {t.logWidget.connectionLost}
                        </div>
                    )}
                    <input
                        type="search"
                        className="log-widget-search"
                        value={searchQuery}
                        placeholder={t.logWidget.searchPlaceholder}
                        onChange={(event) => setSearchQuery(event.target.value)}
                    />
                    {normalizedQuery && (
                        <div className="log-widget-match-count">
                            {t.logWidget.matchCount.replace("{count}", String(filteredLines.length))}
                        </div>
                    )}
                </div>

                <button
                    type="button"
                    className="log-widget-btn"
                    onClick={() => setIsOpen(false)}
                >
                    {t.logWidget.close}
                </button>
            </div>

            <div className="log-widget-body" ref={bodyRef}>
                {content}
            </div>

            <div
                className="log-widget-resize-handle"
                role="separator"
                aria-label={t.logWidget.resize}
                onPointerDown={handleResizePointerDown}
            />
        </div>
    );
}
