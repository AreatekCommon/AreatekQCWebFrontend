import type { CustomizedExposureSlots, ExposureMode, PathPointExposure } from "../types/api";
import { useI18n } from "../i18n/useI18n";
import {
    isPointCloudSlotEditable,
    MARKER_EXP_MAX,
    MARKER_EXP_MIN,
    POINT_CLOUD_EXP_MAX,
    POINT_CLOUD_EXP_MIN,
} from "../utils/exposureWire";

type PointExposureFieldsProps = {
    exposure: PathPointExposure;
    exposureMode: ExposureMode;
    customizedSlots: CustomizedExposureSlots;
    perPointExposure: boolean;
    perPointMarkerExposure: boolean;
    disabled?: boolean;
    onChange: (exposure: PathPointExposure) => void;
};

export function PointExposureFields({
    exposure,
    exposureMode,
    customizedSlots,
    perPointExposure,
    perPointMarkerExposure,
    disabled = false,
    onChange,
}: PointExposureFieldsProps) {
    const { t } = useI18n();
    const fields = t.pathsPage.fields;

    function setField<K extends keyof PathPointExposure>(key: K, value: PathPointExposure[K]) {
        onChange({ ...exposure, [key]: value });
    }

    if (!perPointExposure && !perPointMarkerExposure) {
        return null;
    }

    return (
        <div className="path-point-exposure-fields">
            {perPointExposure && (
                <>
                    {[1, 2, 3].map((slot) =>
                        isPointCloudSlotEditable(exposureMode, customizedSlots, slot) ? (
                            <label key={slot} className="form-field">
                                <span>{fields[`val${slot}` as "val1" | "val2" | "val3"]}</span>
                                <input
                                    type="number"
                                    min={POINT_CLOUD_EXP_MIN}
                                    max={POINT_CLOUD_EXP_MAX}
                                    disabled={disabled}
                                    value={exposure[`val${slot}` as "val1" | "val2" | "val3"] ?? ""}
                                    onChange={(event) =>
                                        setField(
                                            `val${slot}` as "val1" | "val2" | "val3",
                                            Number.parseInt(event.target.value, 10)
                                        )
                                    }
                                />
                            </label>
                        ) : null
                    )}
                </>
            )}
            {perPointMarkerExposure && (
                <label className="form-field">
                    <span>{fields.markerExp}</span>
                    <input
                        type="number"
                        min={MARKER_EXP_MIN}
                        max={MARKER_EXP_MAX}
                        disabled={disabled}
                        value={exposure.marker_exp ?? ""}
                        onChange={(event) =>
                            setField("marker_exp", Number.parseInt(event.target.value, 10))
                        }
                    />
                </label>
            )}
        </div>
    );
}

export function createDefaultPointExposure(
    defaults: {
        val1: number;
        val2: number;
        val3: number;
        marker_exp: number;
    },
    existing?: PathPointExposure,
): PathPointExposure {
    return {
        val1: existing?.val1 ?? defaults.val1,
        val2: existing?.val2 ?? defaults.val2,
        val3: existing?.val3 ?? defaults.val3,
        marker_exp: existing?.marker_exp ?? defaults.marker_exp,
    };
}

export function isScanPositionType(type: string): boolean {
    return type === "basic_scan" || type === "advanced_scan";
}
