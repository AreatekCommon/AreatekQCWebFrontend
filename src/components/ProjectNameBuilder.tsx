import type {
    ProjectNamePart,
    ProjectNameTemplate,
    ProjectNameTimestampFormat,
    ScannerSettings,
} from "../types/api";
import { useI18n } from "../i18n/useI18n";
import {
    assembleProjectName,
    createIncrementPart,
    createTextPart,
    createTimestampPart,
    PROJECT_NAME_TIMESTAMP_FORMATS,
    TIMESTAMP_FORMAT_LABEL_KEYS,
} from "../utils/projectName";

type ProjectNameBuilderProps = {
    scanner: ScannerSettings;
    onChange: (next: ScannerSettings) => void;
};

function updatePartAtIndex(
    parts: ProjectNamePart[],
    index: number,
    nextPart: ProjectNamePart,
): ProjectNamePart[] {
    return parts.map((part, partIndex) => (partIndex === index ? nextPart : part));
}

export function ProjectNameBuilder({ scanner, onChange }: ProjectNameBuilderProps) {
    const { t } = useI18n();
    const fields = t.settings.scannerParams.fields;
    const template = scanner.project_name;
    const preview = assembleProjectName(scanner);

    function setTemplate(nextTemplate: ProjectNameTemplate) {
        onChange({
            ...scanner,
            project_name: nextTemplate,
        });
    }

    function setParts(parts: ProjectNamePart[]) {
        setTemplate({ parts });
    }

    function addPart(part: ProjectNamePart) {
        setParts([...template.parts, part]);
    }

    function removePart(index: number) {
        setParts(template.parts.filter((_, partIndex) => partIndex !== index));
    }

    function timestampFormatLabel(format: ProjectNameTimestampFormat): string {
        const key = TIMESTAMP_FORMAT_LABEL_KEYS[format];
        return fields[key];
    }

    return (
        <div className="project-name-builder full-width-field">
            <div className="project-name-builder-header">
                <span className="project-name-builder-title">{fields.projectName}</span>
                <p className="field-hint">{fields.projectNameHint}</p>
            </div>

            <div className="project-name-preview">
                <span className="project-name-preview-label">{fields.projectNamePreview}</span>
                <code className="project-name-preview-value">{preview}</code>
            </div>

            <div className="project-name-parts">
                {template.parts.map((part, index) => (
                    <div className="project-name-part-row" key={`${part.type}-${index}`}>
                        {part.type === "text" && (
                            <label className="form-field project-name-part-field">
                                <span>{fields.projectNameAddText}</span>
                                <input
                                    type="text"
                                    value={part.value}
                                    onChange={(e) =>
                                        setParts(
                                            updatePartAtIndex(template.parts, index, {
                                                ...part,
                                                value: e.target.value,
                                            }),
                                        )
                                    }
                                />
                            </label>
                        )}

                        {part.type === "increment" && (
                            <label className="form-field project-name-part-field">
                                <span>{fields.projectNameIncrementWidth}</span>
                                <input
                                    type="number"
                                    min={1}
                                    max={8}
                                    step={1}
                                    value={part.width}
                                    onChange={(e) =>
                                        setParts(
                                            updatePartAtIndex(template.parts, index, {
                                                ...part,
                                                width: Math.min(
                                                    8,
                                                    Math.max(1, Number(e.target.value) || 1),
                                                ),
                                            }),
                                        )
                                    }
                                />
                            </label>
                        )}

                        {part.type === "timestamp" && (
                            <label className="form-field project-name-part-field">
                                <span>{fields.projectNameTimestampFormat}</span>
                                <select
                                    value={part.format}
                                    onChange={(e) =>
                                        setParts(
                                            updatePartAtIndex(template.parts, index, {
                                                ...part,
                                                format: e.target.value as ProjectNameTimestampFormat,
                                            }),
                                        )
                                    }
                                >
                                    {PROJECT_NAME_TIMESTAMP_FORMATS.map((format) => (
                                        <option key={format} value={format}>
                                            {timestampFormatLabel(format)}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        )}

                        <button
                            type="button"
                            className="nav-btn project-name-part-remove"
                            onClick={() => removePart(index)}
                        >
                            {fields.projectNameRemovePart}
                        </button>
                    </div>
                ))}
            </div>

            <div className="project-name-actions">
                <button type="button" className="nav-btn" onClick={() => addPart(createTextPart())}>
                    {fields.projectNameAddText}
                </button>
                <button
                    type="button"
                    className="nav-btn"
                    onClick={() => addPart(createIncrementPart())}
                >
                    {fields.projectNameAddIncrement}
                </button>
                <button
                    type="button"
                    className="nav-btn"
                    onClick={() => addPart(createTimestampPart())}
                >
                    {fields.projectNameAddTimestamp}
                </button>
            </div>
        </div>
    );
}
