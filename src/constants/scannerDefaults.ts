import type {
    PipelineSettings,
    RuntimeSettings,
    ScannerDeviceParams,
    ScannerExposureRange,
    ScannerExposureSettings,
    ScannerMeshParams,
    ScannerScanParams,
    ScannerSettings,
} from "../types/api";
import { PARSED_TRAJECTORIES_DIR } from "./fixedPaths";

export const defaultCalibrationSettings = {
    big_range: 0,
    factory_mode: 0,
    read_xml_mode: 0,
};

export const defaultPipelineSettings: PipelineSettings = {
    import_markers: false,
    marker_framework_path: "",
    scan_folder_watcher_enabled: false,
    scan_import_monitored_folder: "",
    error_turntable_delay_sec: 0.5,
    cycle_run_mode: "single_full",
    skip_failed_scans: false,
    calibration: defaultCalibrationSettings,
};

export const defaultScannerDeviceParams: ScannerDeviceParams = {
    rgb_level: 14,
    laser_switch: true,
    left_gain: 0.1,
    right_gain: 0.1,
    mask_enable: false,
    mask_val: 30,
    pre_marker: true,
};

export const defaultScannerExposureSettings: ScannerExposureSettings = {
    mode: "auto",
    customized_slots: "first",
    marker_exp: 8,
    val1: 22,
    val2: 1,
    val3: 1,
};

export const defaultScannerScanParams: ScannerScanParams = {
    align_mod: 4,
    scan_markers: true,
    scan_point_cloud: false,
    add_global_markers: true,
    monocular_scan: false,
    resolution: 2,
    marker_radius: 4,
    scan_obj: 2,
    auto_cut_face: false,
};

export const defaultScannerExposureRange: ScannerExposureRange = {
    center_x: 1024,
    center_y: 750,
    radius: 100,
};

export const defaultScannerMeshParams: ScannerMeshParams = {
    mesh_type: 0,
    unwatertight_detail: 0,
    depth: 0,
    filter_level: 1,
    smooth_level: 1,
    remove_small: 1,
    max_face: true,
    face_limit: 20_000_000,
    fill_small_hole: true,
    small_hole_perimeter: 10,
    neighbourhood: 3,
    spike_sensitivity: true,
    fill_marker_hole: true,
    border_opt: true,
    need_thin_obj_mesh: false,
};

export const defaultScannerSettings: ScannerSettings = {
    process_path: "C:\\Program Files\\OptimScan Q\\Sn3DProcessManager.exe",
    project_root: "C:\\Shining Projects",
    export_root: "C:\\Users\\Areatek\\Desktop\\scans",
    project_name: { parts: [] },
    project_name_counter: 1,
    work_range: 1,
    need_limit: 2,
    save_type: "stl",
    run_global_opt: false,
    reapply_params_each_cycle: true,
    device: defaultScannerDeviceParams,
    exposure_settings: defaultScannerExposureSettings,
    scan: defaultScannerScanParams,
    exposure_range: defaultScannerExposureRange,
    mesh: defaultScannerMeshParams,
};

export const defaultRuntimeSettings: RuntimeSettings = {
    receiver_host: "0.0.0.0",
    receiver_port: 54610,
    sender_host: "127.0.0.1",
    sender_port: 54611,
    axis_forward_enabled: true,
    axis_forward_host: "192.168.40.154",
    axis_forward_port: 3400,
    scanner_host: "127.0.0.1",
    scanner_port: 3001,
    robot_host: "192.168.0.5",
    robot_port: 54603,
    turntable_port: 54601,
    turntable_wire_format: "decimal_2",
    paths_folder: PARSED_TRAJECTORIES_DIR,
    active_path_file: "sample_movement_path.json",
    log_to_console: true,
    log_to_file: false,
    log_level: "INFO",
    log_file_path: "logs/application.log",
    sdk_log_enabled: true,
    sdk_log_dir: "logs/sdk",
    sdk_native_log_source: "",
    sdk_tcp_log_to_console: false,
    poll_interval_ms: 2000,
    pipeline: defaultPipelineSettings,
    scanner: defaultScannerSettings,
};
