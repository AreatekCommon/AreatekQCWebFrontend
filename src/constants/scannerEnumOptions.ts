import type { TranslationSchema } from "../i18n/schema";

export type ScannerEnumKey = keyof TranslationSchema["settings"]["scannerParams"]["enums"];

export type NumericEnumOption = {
    value: number;
    labelKey: ScannerEnumKey;
};

export type StringEnumOption = {
    value: string;
    labelKey: ScannerEnumKey;
};

export const WORK_RANGE_OPTIONS: NumericEnumOption[] = [
    { value: 0, labelKey: "workRangeSmall" },
    { value: 1, labelKey: "workRangeLarge" },
];

export const NEED_LIMIT_OPTIONS: NumericEnumOption[] = [
    { value: 0, labelKey: "needLimitEmptySolution" },
    { value: 1, labelKey: "needLimitSingleProject" },
    { value: 2, labelKey: "needLimitMultiProjectSolution" },
];

export const ALIGN_MOD_OPTIONS: NumericEnumOption[] = [
    { value: 0, labelKey: "alignModNone" },
    { value: 1, labelKey: "alignModFeature" },
    { value: 2, labelKey: "alignModTexture" },
    { value: 4, labelKey: "alignModMarker" },
    { value: 8, labelKey: "alignModGlobalMarker" },
    { value: 16, labelKey: "alignModEncodeMarker" },
    { value: 32, labelKey: "alignModTurntable" },
    { value: 64, labelKey: "alignModPlatform" },
];

export const MESH_TYPE_OPTIONS: NumericEnumOption[] = [
    { value: 0, labelKey: "meshTypeOpen" },
    { value: 1, labelKey: "meshTypeSemiClosed" },
    { value: 2, labelKey: "meshTypeClosed" },
];

export const MESH_DEPTH_OPTIONS: NumericEnumOption[] = [
    { value: 0, labelKey: "meshDepthHigh" },
    { value: 1, labelKey: "meshDepthMedium" },
    { value: 2, labelKey: "meshDepthLow" },
];

export const UNWATERTIGHT_DETAIL_OPTIONS: NumericEnumOption[] = [
    { value: 0, labelKey: "unwatertightDetailStandard" },
    { value: 1, labelKey: "unwatertightDetailHigh" },
];

export const FILTER_LEVEL_OPTIONS: NumericEnumOption[] = [
    { value: 0, labelKey: "filterLevelOff" },
    { value: 1, labelKey: "filterLevelStandard" },
    { value: 2, labelKey: "filterLevelMedium" },
    { value: 3, labelKey: "filterLevelHigh" },
];

export const SMOOTH_LEVEL_OPTIONS: NumericEnumOption[] = [
    { value: 1, labelKey: "smoothLevelStandard" },
    { value: 2, labelKey: "smoothLevelMedium" },
    { value: 3, labelKey: "smoothLevelHigh" },
];

export const SAVE_TYPE_OPTIONS: StringEnumOption[] = [
    { value: "stl", labelKey: "saveTypeStl" },
    { value: "obj", labelKey: "saveTypeObj" },
    { value: "ply", labelKey: "saveTypePly" },
    { value: "asc", labelKey: "saveTypeAsc" },
    { value: "p3", labelKey: "saveTypeP3" },
    { value: "dgm", labelKey: "saveTypeDgm" },
    { value: "3mf", labelKey: "saveType3mf" },
];
