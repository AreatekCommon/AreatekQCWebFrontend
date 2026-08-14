import { useCallback, useEffect, useRef, useState } from "react";
import { fetchPipelineStatus } from "../api/client";
import { useI18n } from "../i18n/useI18n";

const RECONNECT_DELAY_MS = 2000;
const PIPELINE_POLL_MS = 2000;
const STORAGE_KEY = "areatekqc.cameraWidget.size";
const DEFAULT_WIDTH = 420;
const DEFAULT_HEIGHT = 280;
const MIN_WIDTH = 280;
const MIN_HEIGHT = 200;

type WidgetSize = {
    width: number;
    height: number;
};

type StreamStatus =
    | "idle"
    | "connecting"
    | "live"
    | "waitingScanner"
    | "startingCamera"
    | "captureUnavailable"
    | "unavailable";

const CAPTURE_UNAVAILABLE_STATUS = "capture_unavailable";
const STARTING_CAMERA_TIMEOUT_MS = 6000;

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

export function CameraPreviewWidget() {
    const { t } = useI18n();

    const [isOpen, setIsOpen] = useState(false);
    const [size, setSize] = useState<WidgetSize>(() => readStoredSize());
    const [status, setStatus] = useState<StreamStatus>("idle");
    const [frameUrl, setFrameUrl] = useState<string | null>(null);
    const [scannerConnected, setScannerConnected] = useState<boolean | null>(null);

    const imageRef = useRef<HTMLImageElement | null>(null);
    const reconnectTimerRef = useRef<number | null>(null);
    const startingCameraTimerRef = useRef<number | null>(null);
    const socketRef = useRef<WebSocket | null>(null);
    const shouldReconnectRef = useRef(false);
    const resizeStateRef = useRef<{
        startX: number;
        startY: number;
        startWidth: number;
        startHeight: number;
    } | null>(null);
    const sizeRef = useRef(size);
    const frameUrlRef = useRef<string | null>(null);
    const scannerConnectedRef = useRef<boolean | null>(null);

    useEffect(() => {
        sizeRef.current = size;
    }, [size]);

    useEffect(() => {
        scannerConnectedRef.current = scannerConnected;
    }, [scannerConnected]);

    const persistSize = useCallback((nextSize: WidgetSize) => {
        const clamped = clampSize(nextSize);
        setSize(clamped);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clamped));
    }, []);

    const replaceFrameUrl = useCallback((nextUrl: string | null) => {
        if (frameUrlRef.current) {
            URL.revokeObjectURL(frameUrlRef.current);
        }
        frameUrlRef.current = nextUrl;
        setFrameUrl(nextUrl);
    }, []);

    useEffect(() => {
        if (!isOpen) {
            setScannerConnected(null);
            return;
        }

        let cancelled = false;

        const pollScanner = async () => {
            try {
                const pipelineStatus = await fetchPipelineStatus();
                if (!cancelled) {
                    setScannerConnected(pipelineStatus.scanner_connected);
                }
            } catch {
                if (!cancelled) {
                    setScannerConnected(false);
                }
            }
        };

        void pollScanner();
        const timer = window.setInterval(() => {
            void pollScanner();
        }, PIPELINE_POLL_MS);

        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) {
            shouldReconnectRef.current = false;

            if (reconnectTimerRef.current !== null) {
                window.clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }

            if (startingCameraTimerRef.current !== null) {
                window.clearTimeout(startingCameraTimerRef.current);
                startingCameraTimerRef.current = null;
            }

            if (socketRef.current) {
                socketRef.current.close();
                socketRef.current = null;
            }

            replaceFrameUrl(null);
            setStatus("idle");
            return;
        }

        shouldReconnectRef.current = true;
        setStatus("connecting");

        const connect = () => {
            const protocol = window.location.protocol === "https:" ? "wss" : "ws";
            const backendHost = `${window.location.hostname}:8000`;
            const socket = new WebSocket(`${protocol}://${backendHost}/ws/camera`);
            socket.binaryType = "arraybuffer";
            socketRef.current = socket;

            socket.onopen = () => {
                if (scannerConnectedRef.current === false) {
                    setStatus("waitingScanner");
                    return;
                }
                setStatus("startingCamera");
                if (startingCameraTimerRef.current !== null) {
                    window.clearTimeout(startingCameraTimerRef.current);
                }
                startingCameraTimerRef.current = window.setTimeout(() => {
                    if (!frameUrlRef.current) {
                        setStatus("captureUnavailable");
                    }
                }, STARTING_CAMERA_TIMEOUT_MS);
            };

            socket.onmessage = (event) => {
                const payload = event.data;

                if (typeof payload === "string") {
                    try {
                        const parsed = JSON.parse(payload) as {
                            status?: string;
                        };
                        if (parsed.status === CAPTURE_UNAVAILABLE_STATUS) {
                            setStatus("captureUnavailable");
                        }
                    } catch {
                        // Ignore non-JSON text frames.
                    }
                    return;
                }

                if (!(payload instanceof ArrayBuffer) || payload.byteLength === 0) {
                    return;
                }

                if (startingCameraTimerRef.current !== null) {
                    window.clearTimeout(startingCameraTimerRef.current);
                    startingCameraTimerRef.current = null;
                }

                const blob = new Blob([payload], { type: "image/jpeg" });
                const nextUrl = URL.createObjectURL(blob);
                replaceFrameUrl(nextUrl);
                setStatus("live");
            };

            socket.onerror = () => {
                setStatus("unavailable");
            };

            socket.onclose = () => {
                if (!shouldReconnectRef.current) {
                    return;
                }

                setStatus("unavailable");
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
                reconnectTimerRef.current = null;
            }

            if (startingCameraTimerRef.current !== null) {
                window.clearTimeout(startingCameraTimerRef.current);
                startingCameraTimerRef.current = null;
            }

            if (socketRef.current) {
                socketRef.current.close();
                socketRef.current = null;
            }
        };
    }, [isOpen, replaceFrameUrl]);

    useEffect(() => {
        if (!isOpen || status === "live" || status === "unavailable" || status === "connecting" || status === "captureUnavailable") {
            return;
        }

        if (scannerConnected === false) {
            setStatus("waitingScanner");
            return;
        }

        if (scannerConnected === true && !frameUrlRef.current) {
            setStatus("startingCamera");
        }
    }, [isOpen, scannerConnected, status]);

    useEffect(() => {
        return () => {
            if (frameUrlRef.current) {
                URL.revokeObjectURL(frameUrlRef.current);
            }
        };
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
                width: resizeState.startWidth + deltaX,
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

    const onResizePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        resizeStateRef.current = {
            startX: event.clientX,
            startY: event.clientY,
            startWidth: sizeRef.current.width,
            startHeight: sizeRef.current.height,
        };
    };

    const statusLabel = (() => {
        switch (status) {
            case "connecting":
                return t.cameraWidget.connecting;
            case "live":
                return t.cameraWidget.live;
            case "waitingScanner":
                return t.cameraWidget.waitingScanner;
            case "startingCamera":
                return t.cameraWidget.startingCamera;
            case "captureUnavailable":
                return t.cameraWidget.captureUnavailable;
            case "unavailable":
                return t.cameraWidget.unavailable;
            default:
                return t.cameraWidget.closed;
        }
    })();

    if (!isOpen) {
        return (
            <button
                className="camera-widget-toggle"
                type="button"
                onClick={() => setIsOpen(true)}
            >
                {t.cameraWidget.open}
            </button>
        );
    }

    return (
        <div
            className="camera-widget"
            style={{ width: `${size.width}px`, height: `${size.height}px` }}
        >
            <button
                aria-label={t.cameraWidget.resize}
                className="camera-widget-resize-handle"
                onPointerDown={onResizePointerDown}
                type="button"
            />

            <div className="camera-widget-header">
                <div className="camera-widget-title-wrap">
                    <div className="camera-widget-title">{t.cameraWidget.title}</div>
                    <div className="camera-widget-status">{statusLabel}</div>
                </div>

                <button
                    type="button"
                    className="camera-widget-btn"
                    onClick={() => setIsOpen(false)}
                >
                    {t.cameraWidget.close}
                </button>
            </div>

            <div className="camera-widget-body">
                {frameUrl ? (
                    <img
                        ref={imageRef}
                        className="camera-widget-image"
                        src={frameUrl}
                        alt={t.cameraWidget.title}
                    />
                ) : (
                    <div className="camera-widget-placeholder">{statusLabel}</div>
                )}
            </div>
        </div>
    );
}
