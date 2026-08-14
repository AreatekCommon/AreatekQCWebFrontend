import { RadioGroupField } from "./RadioGroupField";
import { SettingsCollapsibleSection } from "./SettingsCollapsibleSection";
import type { ScannerExposureSettings, ScannerSettings } from "../types/api";
import { useI18n } from "../i18n/useI18n";
import {
    isMarkerEditable,
    isPointCloudSlotEditable,
    MARKER_EXP_MAX,
    MARKER_EXP_MIN,
    POINT_CLOUD_EXP_MAX,
    POINT_CLOUD_EXP_MIN,
} from "../utils/exposureWire";
import { SETTINGS_SECTION_EXPOSURE_SETTINGS, type SettingsSectionId } from "../utils/settingsSections";
import type { ExposureMode, CustomizedExposureSlots } from "../types/api";

type SectionStatus = {
    error?: string;
    errorSummary?: string;
    errorDetail?: string;
    success?: string;
};

type ExposureSettingsSectionProps = {
    scanner: ScannerSettings;
    onChange: (next: ScannerSettings) => void;
    savingSection: SettingsSectionId | null;
    sectionStatus: Partial<Record<SettingsSectionId, SectionStatus>>;
    openSections: Partial<Record<SettingsSectionId, boolean>>;
    onSectionOpenChange: (sectionId: SettingsSectionId, open: boolean) => void;
};

export function ExposureSettingsSection({
    scanner,
    onChange,
    savingSection,
    sectionStatus,
    openSections,
    onSectionOpenChange,
}: ExposureSettingsSectionProps) {
    const { t } = useI18n();
    const sp = t.settings.scannerParams;
    const exposure = scanner.exposure_settings;
    const status = sectionStatus[SETTINGS_SECTION_EXPOSURE_SETTINGS];

    function setExposure(next: ScannerExposureSettings) {
        onChange({
            ...scanner,
            exposure_settings: next,
        });
    }

    function setMode(mode: ExposureMode) {
        setExposure({ ...exposure, mode });
    }

    function setCustomizedSlots(customized_slots: CustomizedExposureSlots) {
        setExposure({ ...exposure, customized_slots });
    }

    function setExposureField<K extends keyof ScannerExposureSettings>(
        key: K,
        value: ScannerExposureSettings[K]
    ) {
        setExposure({ ...exposure, [key]: value });
    }

    const markerEditable = isMarkerEditable(exposure.mode);
    const val1Editable = isPointCloudSlotEditable(exposure.mode, exposure.customized_slots, 1);
    const val2Editable = isPointCloudSlotEditable(exposure.mode, exposure.customized_slots, 2);
    const val3Editable = isPointCloudSlotEditable(exposure.mode, exposure.customized_slots, 3);

    return (
        <SettingsCollapsibleSection
            nested
            sectionId={SETTINGS_SECTION_EXPOSURE_SETTINGS}
            title={sp.sections.exposureSettings}
            hint={sp.fields.exposureAutoHint}
            open={openSections[SETTINGS_SECTION_EXPOSURE_SETTINGS] ?? false}
            onOpenChange={(open) => onSectionOpenChange(SETTINGS_SECTION_EXPOSURE_SETTINGS, open)}
            saving={savingSection === SETTINGS_SECTION_EXPOSURE_SETTINGS}
            sectionError={status?.error ?? null}
            sectionErrorSummary={status?.errorSummary ?? null}
            sectionErrorDetail={status?.errorDetail ?? null}
            sectionSuccess={status?.success ?? null}
        >
            <RadioGroupField
                label={sp.fields.exposureMode}
                name="exposure-mode"
                value={exposure.mode}
                options={[
                    { value: "auto", label: sp.fields.exposureModeAuto },
                    { value: "first", label: sp.fields.exposureModeFirst },
                    { value: "second", label: sp.fields.exposureModeSecond },
                    { value: "third", label: sp.fields.exposureModeThird },
                    { value: "customized", label: sp.fields.exposureModeCustomized },
                ]}
                onChange={setMode}
            />

            {exposure.mode === "customized" && (
                <RadioGroupField
                    label={sp.fields.exposureCustomizedSlots}
                    name="exposure-customized-slots"
                    value={exposure.customized_slots}
                    options={[
                        { value: "first", label: sp.fields.exposureSlotsFirst },
                        {
                            value: "first_second",
                            label: sp.fields.exposureSlotsFirstSecond,
                        },
                        { value: "all", label: sp.fields.exposureSlotsAll },
                    ]}
                    onChange={setCustomizedSlots}
                />
            )}

            {markerEditable && (
                <label className="form-field">
                    <span>{sp.fields.markerExp}</span>
                    <input
                        type="number"
                        min={MARKER_EXP_MIN}
                        max={MARKER_EXP_MAX}
                        value={exposure.marker_exp}
                        onChange={(e) => setExposureField("marker_exp", Number(e.target.value))}
                    />
                </label>
            )}

            {val1Editable && (
                <label className="form-field">
                    <span>{sp.fields.val1}</span>
                    <input
                        type="number"
                        min={POINT_CLOUD_EXP_MIN}
                        max={POINT_CLOUD_EXP_MAX}
                        value={exposure.val1}
                        onChange={(e) => setExposureField("val1", Number(e.target.value))}
                    />
                </label>
            )}

            {val2Editable && (
                <label className="form-field">
                    <span>{sp.fields.val2}</span>
                    <input
                        type="number"
                        min={POINT_CLOUD_EXP_MIN}
                        max={POINT_CLOUD_EXP_MAX}
                        value={exposure.val2}
                        onChange={(e) => setExposureField("val2", Number(e.target.value))}
                    />
                </label>
            )}

            {val3Editable && (
                <label className="form-field">
                    <span>{sp.fields.val3}</span>
                    <input
                        type="number"
                        min={POINT_CLOUD_EXP_MIN}
                        max={POINT_CLOUD_EXP_MAX}
                        value={exposure.val3}
                        onChange={(e) => setExposureField("val3", Number(e.target.value))}
                    />
                </label>
            )}
        </SettingsCollapsibleSection>
    );
}
