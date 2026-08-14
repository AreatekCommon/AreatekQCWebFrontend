export type HealthResponse = {
    status: string;
    is_running: boolean;
    started_at: string | null;
    last_error: string | null;
    connected_web_clients: number;
};

export type ScannerDeviceParams = {
    rgb_level: number;
    laser_switch: boolean;
    left_gain: number;
    right_gain: number;
    mask_enable: boolean;
    mask_val: number;
    pre_marker: boolean;
};

export type ExposureMode = "auto" | "first" | "second" | "third" | "customized";
export type CustomizedExposureSlots = "first" | "first_second" | "all";

export type ScannerExposureSettings = {
    mode: ExposureMode;
    customized_slots: CustomizedExposureSlots;
    marker_exp: number;
    val1: number;
    val2: number;
    val3: number;
};

export type ScannerScanParams = {
    align_mod: number;
    scan_markers: boolean;
    scan_point_cloud: boolean;
    add_global_markers: boolean;
    monocular_scan: boolean;
    resolution: number;
    marker_radius: number;
    scan_obj: number;
    auto_cut_face: boolean;
};

export type ScannerExposureRange = {
    center_x: number;
    center_y: number;
    radius: number;
};

export type ScannerMeshParams = {
    mesh_type: number;
    unwatertight_detail: number;
    depth: number;
    filter_level: number;
    smooth_level: number;
    remove_small: number;
    max_face: boolean;
    face_limit: number;
    fill_small_hole: boolean;
    small_hole_perimeter: number;
    neighbourhood: number;
    spike_sensitivity: boolean;
    fill_marker_hole: boolean;
    border_opt: boolean;
    need_thin_obj_mesh: boolean;
};

export type CalibrationSettings = {
    big_range: number;
    factory_mode: number;
    read_xml_mode: number;
};

export type CycleRunMode = "single_last_scan" | "single_full" | "repeat_on_success";

export type PipelineSettings = {
    import_markers: boolean;
    marker_framework_path: string;
    scan_folder_watcher_enabled: boolean;
    scan_import_monitored_folder: string;
    error_turntable_delay_sec: number;
    cycle_run_mode: CycleRunMode;
    skip_failed_scans: boolean;
    calibration: CalibrationSettings;
};

export type ProjectNameTimestampFormat =
    | "YYYYMMDD"
    | "HHMMSS"
    | "YYYYMMDD_HHMMSS"
    | "YYYY-MM-DD"
    | "DDMMYYYY";

export type ProjectNameTextPart = {
    type: "text";
    value: string;
};

export type ProjectNameIncrementPart = {
    type: "increment";
    width: number;
};

export type ProjectNameTimestampPart = {
    type: "timestamp";
    format: ProjectNameTimestampFormat;
};

export type ProjectNamePart =
    | ProjectNameTextPart
    | ProjectNameIncrementPart
    | ProjectNameTimestampPart;

export type ProjectNameTemplate = {
    parts: ProjectNamePart[];
};

export type ScannerSettings = {
    process_path: string;
    project_root: string;
    export_root: string;
    project_name: ProjectNameTemplate;
    project_name_counter: number;
    work_range: number;
    need_limit: number;
    save_type: string;
    run_global_opt: boolean;
    reapply_params_each_cycle: boolean;
    device: ScannerDeviceParams;
    exposure_settings: ScannerExposureSettings;
    scan: ScannerScanParams;
    exposure_range: ScannerExposureRange;
    mesh: ScannerMeshParams;
};

export type RuntimeSettings = {
    receiver_host: string;
    receiver_port: number;
    sender_host: string;
    sender_port: number;
    axis_forward_enabled: boolean;
    axis_forward_host: string;
    axis_forward_port: number;
    scanner_host: string;
    scanner_port: number;
    robot_host: string;
    robot_port: number;
    turntable_port: number;
    turntable_wire_format: "integer" | "decimal_2";
    paths_folder: string;
    active_path_file: string;
    log_to_console: boolean;
    log_to_file: boolean;
    log_level: string;
    log_file_path: string;
    sdk_log_enabled: boolean;
    sdk_log_dir: string;
    sdk_native_log_source: string;
    sdk_tcp_log_to_console: boolean;
    poll_interval_ms: number;
    pipeline: PipelineSettings;
    scanner: ScannerSettings;
};

export type SdkApplyErrorDetail = {
    command: string;
    ret_code: number | null;
    error_code_hex: string | null;
    result: string | null;
    message: string;
    finish_json: string | null;
    begin_json: string | null;
};

export type SettingsUpdateResponse = {
    settings: RuntimeSettings;
    apply_section: string | null;
    applied: boolean;
    apply_error: string | null;
    apply_error_detail: SdkApplyErrorDetail | null;
};

export type LogsResponse = {
    lines: string[];
};

export type AxisSnapshot = {
    connected: boolean;
    axes_available: boolean;
    sample_count: number;
    timestamp_ms: number | null;
    a1: number | null;
    a2: number | null;
    a3: number | null;
    a4: number | null;
    a5: number | null;
    a6: number | null;
    external_axis: number | null;
    last_error: string | null;
    forward_connected: boolean;
    forward_last_error: string | null;
};

export type TrajectoryPoint = {
    index: number;
    point_type: string;
    comment: string;
    a1: number;
    a2: number;
    a3: number;
    a4: number;
    a5: number;
    a6: number;
    turntable_angle: number;
};

export type TrajectoryResponse = {
    source_path: string;
    point_count: number;
    load_error: string | null;
    points: TrajectoryPoint[];
};

export type PipelineState = "idle" | "running" | "stopping" | "error";
export type CycleMode = "production" | "calibration";
export type CycleTimingMode = "last_scan" | "full_cycle";

export type CycleHistoryEntry = {
    started_at: string;
    mesh_export_finished_at: string | null;
    duration_sec: number | null;
    project_name: string;
};

export type CycleHistoryResponse = {
    entries: CycleHistoryEntry[];
};

export type PipelineStatus = {
    state: PipelineState;
    current_step_index: number | null;
    scan_count: number;
    project_name: string | null;
    last_error: string | null;
    started_at: string | null;
    finished_at: string | null;
    scanner_connected: boolean;
    robot_path_connected: boolean;
    turntable_connected: boolean;
    project_ready: boolean;
    trajectory_ready: boolean;
    initializing: boolean;
    can_resume: boolean;
    position_resend_step_indices: number[];
    cycle_mode: CycleMode | null;
    calibration_trajectory_ready: boolean;
    last_cycle_duration_sec: number | null;
    last_cycle_timing_mode: CycleTimingMode | null;
};

export type PathPositionType = "home" | "basic_scan" | "advanced_scan" | "end";

export type PathPositionAxes = {
    J1: number;
    J2: number;
    J3: number;
    J4: number;
    J5: number;
    J6: number;
};

export type AdvancedScanMode = "range" | "step";

export type PathPositionTurntable = {
    angle?: number;
    start_angle?: number;
    end_angle?: number;
    scan_count?: number;
    advanced_scan_mode?: AdvancedScanMode;
    step_angle?: number;
    speed?: number;
    acceleration?: number;
};

export type PathPositionMotion = {
    speed?: number;
    acceleration?: number;
};

export type PathPointExposure = {
    val1?: number;
    val2?: number;
    val3?: number;
    marker_exp?: number;
};

export type PathPoint = {
    id: string;
    name: string;
    axes: PathPositionAxes;
};

export type PathNode = {
    id: string;
    type: PathPositionType;
    point_id: string;
    prev_node_id?: string | null;
    next_node_id?: string | null;
    x?: number;
    y?: number;
    turntable: PathPositionTurntable;
    motion?: PathPositionMotion;
    exposure?: PathPointExposure;
};

/** @deprecated Legacy flat position used only during migration from old files. */
export type PathPosition = {
    id: string;
    type: PathPositionType;
    comment: string;
    axes: PathPositionAxes;
    turntable: PathPositionTurntable;
    motion?: PathPositionMotion;
    exposure?: PathPointExposure;
};

export type PathDocument = {
    points: PathPoint[];
    nodes: PathNode[];
    safe_route_ids?: string[];
    safe_routes?: boolean[][];
    per_point_exposure?: boolean;
    per_point_marker_exposure?: boolean;
    uniform_advanced_scan_rotations?: boolean;
    uniform_advanced_scan_count?: number | null;
    /** @deprecated Legacy field — migrated automatically on load. */
    positions?: PathPosition[];
};

export type PathTravelStep = {
    point_id: string;
    name: string;
    node_type: string;
    turntable_angle: number;
    skipped: boolean;
};

export type PathMoveToResponse = {
    status: string;
    route: string[];
    hops_executed: number;
    travel_steps: PathTravelStep[];
};

export type PathFileInfo = {
    name: string;
    modified_at: string;
    source_position_count: number | null;
};

export type PathsListResponse = {
    folder: string;
    active_file: string;
    files: PathFileInfo[];
};

export type ActivePathResponse = {
    folder: string;
    filename: string;
    source_path: string;
    source_position_count: number;
    expanded_point_count: number;
    load_error: string | null;
    document: PathDocument;
};

export type KukaTrajectoryImportRequest = {
    source_path: string;
    output_folder: string;
    output_filename: string;
};

export type KukaTrajectoryImportResponse = {
    output_path: string;
    source_point_count: number;
    node_count: number;
    point_count: number;
    filename: string;
};

export type ProjectListResponse = {
    projects: string[];
};

export type ProjectExistsResponse = {
    name: string;
    exists: boolean;
};

export type ProjectSaveRequest = {
    name: string;
    overwrite: boolean;
    settings: RuntimeSettings;
};

export type ProjectSaveResponse = {
    name: string;
    path: string;
};

export type ActiveProjectResponse = {
    name: string | null;
};

export type ActiveProjectRequest = {
    name: string | null;
};

export type ProjectLoadResponse = {
    name: string;
    settings: RuntimeSettings;
    path_document: PathDocument;
};

export type TrajectorySourceFile = {
    name: string;
    path: string;
};

export type TrajectorySourceListResponse = {
    folder: string;
    files: TrajectorySourceFile[];
};

export type MarkerFileEntry = {
    name: string;
    path: string;
};

export type MarkerListResponse = {
    folder: string;
    files: MarkerFileEntry[];
};