import { EnumSelectField } from "./EnumSelectField";
import { ExposureSettingsSection } from "./ExposureSettingsSection";
import { ProjectNameBuilder } from "./ProjectNameBuilder";
import { RadioGroupField } from "./RadioGroupField";
import { SettingsCollapsibleSection } from "./SettingsCollapsibleSection";
import { SettingsPathField } from "./SettingsPathField";
import {
    ALIGN_MOD_OPTIONS,
    FILTER_LEVEL_OPTIONS,
    MESH_DEPTH_OPTIONS,
    MESH_TYPE_OPTIONS,
    NEED_LIMIT_OPTIONS,
    SAVE_TYPE_OPTIONS,
    SMOOTH_LEVEL_OPTIONS,
    UNWATERTIGHT_DETAIL_OPTIONS,
    WORK_RANGE_OPTIONS,
    type ScannerEnumKey,
} from "../constants/scannerEnumOptions";
import type { RuntimeSettings, ScannerSettings } from "../types/api";
import { useI18n } from "../i18n/useI18n";
import {
    SETTINGS_SECTION_DEVICE_PARAMS,
    SETTINGS_SECTION_EXPOSURE_RANGE,
    SETTINGS_SECTION_MESH_PARAMS,
    SETTINGS_SECTION_PIPELINE_BEHAVIOR,
    SETTINGS_SECTION_SCAN_PARAMS,
    SETTINGS_SECTION_SDK_PATHS,
    type SettingsSectionId,
} from "../utils/settingsSections";
import {
    ALIGN_MOD_GLOBAL_MARKER,
    applyMarkersOnlyRuntimeSettings,
    applyScanTargetMode,
    getAllowedMarkerRadii,
    getScanTargetHint,
    getScanTargetMode,
    isMarkersOnlyScanMode,
    markerRadiusOptionLabelKey,
    normalizeScannerSettings,
    shouldShowMarkerRadiusResolutionHint,
    type ScanTargetMode,
} from "../utils/scannerParamConstraints";
import {
    isMarkerRadiusMmSelected,
    toggleMarkerRadiusMm,
} from "../utils/markerRadius";

type SectionStatus = {
    error?: string;
    errorSummary?: string;
    errorDetail?: string;
    success?: string;
};

type ScannerSettingsSectionProps = {
    form: RuntimeSettings;
    onChange: (next: RuntimeSettings) => void;
    savingSection: SettingsSectionId | null;
    sectionStatus: Partial<Record<SettingsSectionId, SectionStatus>>;
    onSaveSection: (sectionId: SettingsSectionId) => void;
    openSections: Partial<Record<SettingsSectionId, boolean>>;
    onSectionOpenChange: (sectionId: SettingsSectionId, open: boolean) => void;
};

export function ScannerSettingsSection({
    form,
    onChange,
    savingSection,
    sectionStatus,
    onSaveSection,
    openSections,
    onSectionOpenChange,
}: ScannerSettingsSectionProps) {
    const { t } = useI18n();
    const scanner = form.scanner;
    const sp = t.settings.scannerParams;

    function enumLabel(key: ScannerEnumKey): string {
        return sp.enums[key] as string;
    }

    function sectionProps(sectionId: SettingsSectionId) {
        const status = sectionStatus[sectionId];
        return {
            sectionId,
            open: openSections[sectionId] ?? false,
            onOpenChange: (open: boolean) => onSectionOpenChange(sectionId, open),
            onSave: () => onSaveSection(sectionId),
            saveLabel: t.settings.sectionSaveButton,
            saving: savingSection === sectionId,
            sectionError: status?.error ?? null,
            sectionErrorSummary: status?.errorSummary ?? null,
            sectionErrorDetail: status?.errorDetail ?? null,
            sectionSuccess: status?.success ?? null,
        };
    }

    function setScanner(next: ScannerSettings) {
        onChange(
            applyMarkersOnlyRuntimeSettings({
                ...form,
                scanner: normalizeScannerSettings(next),
            })
        );
    }

    function setDeviceField<K extends keyof ScannerSettings["device"]>(
        key: K,
        value: ScannerSettings["device"][K]
    ) {
        setScanner({
            ...scanner,
            device: { ...scanner.device, [key]: value },
        });
    }

    function setScanField<K extends keyof ScannerSettings["scan"]>(
        key: K,
        value: ScannerSettings["scan"][K]
    ) {
        setScanner({
            ...scanner,
            scan: { ...scanner.scan, [key]: value },
        });
    }

    function setExposureField<K extends keyof ScannerSettings["exposure_range"]>(
        key: K,
        value: ScannerSettings["exposure_range"][K]
    ) {
        setScanner({
            ...scanner,
            exposure_range: { ...scanner.exposure_range, [key]: value },
        });
    }

    function setMeshField<K extends keyof ScannerSettings["mesh"]>(
        key: K,
        value: ScannerSettings["mesh"][K]
    ) {
        setScanner({
            ...scanner,
            mesh: { ...scanner.mesh, [key]: value },
        });
    }

    function handleAlignModChange(alignMod: number) {
        setScanField("align_mod", alignMod);
    }

    function handleScanTargetChange(mode: ScanTargetMode) {
        onChange(
            applyMarkersOnlyRuntimeSettings({
                ...form,
                scanner: normalizeScannerSettings({
                    ...scanner,
                    scan: applyScanTargetMode(scanner.scan, mode),
                }),
            })
        );
    }

    function handleMarkerRadiusToggle(mm: number) {
        const next = toggleMarkerRadiusMm(scanner.scan.marker_radius, mm);
        if (next === null) {
            return;
        }
        setScanField("marker_radius", next);
    }

    const allowedMarkerRadii = getAllowedMarkerRadii(scanner.work_range, scanner.scan.resolution);
    const markerRadiusResolutionHint = shouldShowMarkerRadiusResolutionHint(
        scanner.work_range,
        scanner.scan.resolution
    )
        ? sp.fields.markerRadiusResolutionHint
        : undefined;
    const scanTargetHint = getScanTargetHint(sp.fields.scanTargetExclusiveHint);
    const markersOnlyMode = isMarkersOnlyScanMode(scanner.scan);
    const alignModOptions = markersOnlyMode
        ? ALIGN_MOD_OPTIONS.filter((option) => option.value === ALIGN_MOD_GLOBAL_MARKER)
        : ALIGN_MOD_OPTIONS;
    const saveTypeOptions = markersOnlyMode
        ? SAVE_TYPE_OPTIONS.filter((option) => option.value === "p3")
        : SAVE_TYPE_OPTIONS;

    return (
        <>
            <SettingsCollapsibleSection nested title={sp.sections.sdkPaths} {...sectionProps(SETTINGS_SECTION_SDK_PATHS)}>
                <SettingsPathField
                    label={sp.fields.processPath}
                    value={scanner.process_path}
                    mode="file"
                    onChange={(value) => setScanner({ ...scanner, process_path: value })}
                />
                <SettingsPathField
                    label={sp.fields.projectRoot}
                    value={scanner.project_root}
                    mode="folder"
                    onChange={(value) => setScanner({ ...scanner, project_root: value })}
                />
                <ProjectNameBuilder scanner={scanner} onChange={setScanner} />
                <SettingsPathField
                    label={sp.fields.exportRoot}
                    value={scanner.export_root}
                    mode="folder"
                    onChange={(value) => setScanner({ ...scanner, export_root: value })}
                />
                <EnumSelectField
                    label={sp.fields.workRange}
                    value={scanner.work_range}
                    options={WORK_RANGE_OPTIONS}
                    getLabel={enumLabel}
                    onChange={(value) => {
                        setScanner({
                            ...scanner,
                            work_range: value,
                        });
                    }}
                />
                <EnumSelectField
                    label={sp.fields.needLimit}
                    value={scanner.need_limit}
                    options={NEED_LIMIT_OPTIONS}
                    getLabel={enumLabel}
                    onChange={(value) => setScanner({ ...scanner, need_limit: value })}
                />
                <EnumSelectField
                    label={sp.fields.saveType}
                    value={scanner.save_type}
                    options={saveTypeOptions}
                    getLabel={enumLabel}
                    onChange={(value) => setScanner({ ...scanner, save_type: value })}
                />
                <p className="settings-section-hint">
                    {markersOnlyMode ? sp.fields.markersOnlySaveTypeHint : sp.fields.saveTypeHint}
                </p>
            </SettingsCollapsibleSection>

            <SettingsCollapsibleSection nested title={sp.sections.deviceParams} {...sectionProps(SETTINGS_SECTION_DEVICE_PARAMS)}>
                <label className="form-field">
                    <span>{sp.fields.rgbLevel}</span>
                    <input
                        type="number"
                        min={0}
                        value={scanner.device.rgb_level}
                        onChange={(e) => setDeviceField("rgb_level", Number(e.target.value))}
                    />
                </label>
                <label className="form-field checkbox-field">
                    <span>{sp.fields.laserSwitch}</span>
                    <input
                        type="checkbox"
                        checked={scanner.device.laser_switch}
                        onChange={(e) => setDeviceField("laser_switch", e.target.checked)}
                    />
                </label>
                <label className="form-field">
                    <span>{sp.fields.leftGain}</span>
                    <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={scanner.device.left_gain}
                        onChange={(e) => setDeviceField("left_gain", Number(e.target.value))}
                    />
                </label>
                <label className="form-field">
                    <span>{sp.fields.rightGain}</span>
                    <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={scanner.device.right_gain}
                        onChange={(e) => setDeviceField("right_gain", Number(e.target.value))}
                    />
                </label>
                <label className="form-field checkbox-field">
                    <span>{sp.fields.maskEnable}</span>
                    <input
                        type="checkbox"
                        checked={scanner.device.mask_enable}
                        onChange={(e) => setDeviceField("mask_enable", e.target.checked)}
                    />
                </label>
                <label className="form-field">
                    <span>{sp.fields.maskVal}</span>
                    <input
                        type="number"
                        min={0}
                        value={scanner.device.mask_val}
                        onChange={(e) => setDeviceField("mask_val", Number(e.target.value))}
                    />
                </label>
                <label className="form-field checkbox-field">
                    <span>{sp.fields.preMarker}</span>
                    <input
                        type="checkbox"
                        checked={scanner.device.pre_marker}
                        onChange={(e) => setDeviceField("pre_marker", e.target.checked)}
                    />
                </label>
            </SettingsCollapsibleSection>

            <ExposureSettingsSection
                scanner={scanner}
                onChange={setScanner}
                savingSection={savingSection}
                sectionStatus={sectionStatus}
                openSections={openSections}
                onSectionOpenChange={onSectionOpenChange}
            />

            <SettingsCollapsibleSection nested title={sp.sections.scanParams} {...sectionProps(SETTINGS_SECTION_SCAN_PARAMS)}>
                <RadioGroupField
                    label={sp.fields.scanTargetMode}
                    name="scan-target-mode"
                    value={getScanTargetMode(scanner.scan)}
                    hint={scanTargetHint}
                    options={[
                        { value: "pointCloud", label: sp.fields.scanTargetPointCloud },
                        { value: "markers", label: sp.fields.scanTargetMarkers },
                    ]}
                    onChange={handleScanTargetChange}
                />
                <EnumSelectField
                    label={sp.fields.alignMod}
                    value={scanner.scan.align_mod}
                    options={alignModOptions}
                    getLabel={enumLabel}
                    onChange={handleAlignModChange}
                />
                {markersOnlyMode && (
                    <p className="settings-section-hint">{sp.fields.markersOnlyAlignHint}</p>
                )}
                <label className="form-field checkbox-field">
                    <span>{sp.fields.addGlobalMarkers}</span>
                    <input
                        type="checkbox"
                        checked={scanner.scan.add_global_markers}
                        onChange={(e) => setScanField("add_global_markers", e.target.checked)}
                    />
                </label>
                <label className="form-field checkbox-field">
                    <span>{sp.fields.monocularScan}</span>
                    <input
                        type="checkbox"
                        checked={scanner.scan.monocular_scan}
                        onChange={(e) => setScanField("monocular_scan", e.target.checked)}
                    />
                </label>
                <EnumSelectField
                    label={sp.fields.resolution}
                    value={scanner.scan.resolution}
                    options={[
                        { value: 1, labelKey: "resolutionLow" },
                        { value: 2, labelKey: "resolutionMid" },
                        { value: 3, labelKey: "resolutionHigh" },
                    ]}
                    getLabel={enumLabel}
                    onChange={(value) => setScanField("resolution", value)}
                />
                <div className="form-field">
                    <span>{sp.fields.markerRadius}</span>
                    {allowedMarkerRadii.map((mm) => (
                        <label key={mm} className="checkbox-field">
                            <input
                                type="checkbox"
                                checked={isMarkerRadiusMmSelected(scanner.scan.marker_radius, mm)}
                                onChange={() => handleMarkerRadiusToggle(mm)}
                            />
                            <span>{sp.fields[markerRadiusOptionLabelKey(mm)]}</span>
                        </label>
                    ))}
                    <p className="settings-section-hint">{sp.fields.markerRadiusMultiHint}</p>
                    {markerRadiusResolutionHint && (
                        <p className="settings-section-hint">{markerRadiusResolutionHint}</p>
                    )}
                </div>
                <EnumSelectField
                    label={sp.fields.scanObj}
                    value={scanner.scan.scan_obj}
                    options={[
                        { value: 1, labelKey: "scanObjOrdinary" },
                        { value: 2, labelKey: "scanObjReflective" },
                    ]}
                    getLabel={enumLabel}
                    onChange={(value) => setScanField("scan_obj", value)}
                />
                <label className="form-field checkbox-field">
                    <span>{sp.fields.autoCutFace}</span>
                    <input
                        type="checkbox"
                        checked={scanner.scan.auto_cut_face}
                        onChange={(e) => setScanField("auto_cut_face", e.target.checked)}
                    />
                </label>
            </SettingsCollapsibleSection>

            <SettingsCollapsibleSection nested title={sp.sections.exposureRange} {...sectionProps(SETTINGS_SECTION_EXPOSURE_RANGE)}>
                <label className="form-field">
                    <span>{sp.fields.centerX}</span>
                    <input
                        type="number"
                        min={0}
                        value={scanner.exposure_range.center_x}
                        onChange={(e) => setExposureField("center_x", Number(e.target.value))}
                    />
                </label>
                <label className="form-field">
                    <span>{sp.fields.centerY}</span>
                    <input
                        type="number"
                        min={0}
                        value={scanner.exposure_range.center_y}
                        onChange={(e) => setExposureField("center_y", Number(e.target.value))}
                    />
                </label>
                <label className="form-field">
                    <span>{sp.fields.radius}</span>
                    <input
                        type="number"
                        min={0}
                        value={scanner.exposure_range.radius}
                        onChange={(e) => setExposureField("radius", Number(e.target.value))}
                    />
                </label>
            </SettingsCollapsibleSection>

            <SettingsCollapsibleSection nested title={sp.sections.pipelineBehavior} {...sectionProps(SETTINGS_SECTION_PIPELINE_BEHAVIOR)}>
                <label className="form-field checkbox-field">
                    <span>{sp.fields.runGlobalOpt}</span>
                    <input
                        type="checkbox"
                        checked={scanner.run_global_opt}
                        onChange={(e) =>
                            setScanner({ ...scanner, run_global_opt: e.target.checked })
                        }
                    />
                </label>
                <label className="form-field checkbox-field">
                    <span>{sp.fields.reapplyParamsEachCycle}</span>
                    <input
                        type="checkbox"
                        checked={scanner.reapply_params_each_cycle}
                        onChange={(e) =>
                            setScanner({
                                ...scanner,
                                reapply_params_each_cycle: e.target.checked,
                            })
                        }
                    />
                </label>
            </SettingsCollapsibleSection>

            <SettingsCollapsibleSection nested title={sp.sections.meshParams} {...sectionProps(SETTINGS_SECTION_MESH_PARAMS)}>
                <EnumSelectField
                    label={sp.fields.meshType}
                    value={scanner.mesh.mesh_type}
                    options={MESH_TYPE_OPTIONS}
                    getLabel={enumLabel}
                    onChange={(value) => setMeshField("mesh_type", value)}
                />
                <EnumSelectField
                    label={sp.fields.unwatertightDetail}
                    value={scanner.mesh.unwatertight_detail}
                    options={UNWATERTIGHT_DETAIL_OPTIONS}
                    getLabel={enumLabel}
                    onChange={(value) => setMeshField("unwatertight_detail", value)}
                />
                <EnumSelectField
                    label={sp.fields.depth}
                    value={scanner.mesh.depth}
                    options={MESH_DEPTH_OPTIONS}
                    getLabel={enumLabel}
                    onChange={(value) => setMeshField("depth", value)}
                />
                <EnumSelectField
                    label={sp.fields.filterLevel}
                    value={scanner.mesh.filter_level}
                    options={FILTER_LEVEL_OPTIONS}
                    getLabel={enumLabel}
                    onChange={(value) => setMeshField("filter_level", value)}
                />
                <EnumSelectField
                    label={sp.fields.smoothLevel}
                    value={scanner.mesh.smooth_level}
                    options={SMOOTH_LEVEL_OPTIONS}
                    getLabel={enumLabel}
                    onChange={(value) => setMeshField("smooth_level", value)}
                />
                <label className="form-field">
                    <span>{sp.fields.removeSmall}</span>
                    <input
                        type="number"
                        min={0}
                        value={scanner.mesh.remove_small}
                        onChange={(e) => setMeshField("remove_small", Number(e.target.value))}
                    />
                </label>
                <label className="form-field checkbox-field">
                    <span>{sp.fields.maxFace}</span>
                    <input
                        type="checkbox"
                        checked={scanner.mesh.max_face}
                        onChange={(e) => setMeshField("max_face", e.target.checked)}
                    />
                </label>
                <label className="form-field">
                    <span>{sp.fields.faceLimit}</span>
                    <input
                        type="number"
                        min={0}
                        value={scanner.mesh.face_limit}
                        onChange={(e) => setMeshField("face_limit", Number(e.target.value))}
                    />
                </label>
                <label className="form-field checkbox-field">
                    <span>{sp.fields.fillSmallHole}</span>
                    <input
                        type="checkbox"
                        checked={scanner.mesh.fill_small_hole}
                        onChange={(e) => setMeshField("fill_small_hole", e.target.checked)}
                    />
                </label>
                <label className="form-field">
                    <span>{sp.fields.smallHolePerimeter}</span>
                    <input
                        type="number"
                        min={0}
                        value={scanner.mesh.small_hole_perimeter}
                        onChange={(e) =>
                            setMeshField("small_hole_perimeter", Number(e.target.value))
                        }
                    />
                </label>
                <label className="form-field">
                    <span>{sp.fields.neighbourhood}</span>
                    <input
                        type="number"
                        min={0}
                        value={scanner.mesh.neighbourhood}
                        onChange={(e) => setMeshField("neighbourhood", Number(e.target.value))}
                    />
                </label>
                <label className="form-field checkbox-field">
                    <span>{sp.fields.spikeSensitivity}</span>
                    <input
                        type="checkbox"
                        checked={scanner.mesh.spike_sensitivity}
                        onChange={(e) => setMeshField("spike_sensitivity", e.target.checked)}
                    />
                </label>
                <label className="form-field checkbox-field">
                    <span>{sp.fields.fillMarkerHole}</span>
                    <input
                        type="checkbox"
                        checked={scanner.mesh.fill_marker_hole}
                        onChange={(e) => setMeshField("fill_marker_hole", e.target.checked)}
                    />
                </label>
                <label className="form-field checkbox-field">
                    <span>{sp.fields.borderOpt}</span>
                    <input
                        type="checkbox"
                        checked={scanner.mesh.border_opt}
                        onChange={(e) => setMeshField("border_opt", e.target.checked)}
                    />
                </label>
                <label className="form-field checkbox-field">
                    <span>{sp.fields.needThinObjMesh}</span>
                    <input
                        type="checkbox"
                        checked={scanner.mesh.need_thin_obj_mesh}
                        onChange={(e) => setMeshField("need_thin_obj_mesh", e.target.checked)}
                    />
                </label>
            </SettingsCollapsibleSection>
        </>
    );
}
