type RadioGroupFieldProps<T extends string | number> = {
    label: string;
    name: string;
    value: T;
    options: Array<{ value: T; label: string; disabled?: boolean }>;
    onChange: (value: T) => void;
    hint?: string;
    className?: string;
};

export function RadioGroupField<T extends string | number>({
    label,
    name,
    value,
    options,
    onChange,
    hint,
    className = "form-field radio-group-field",
}: RadioGroupFieldProps<T>) {
    return (
        <fieldset className={className}>
            <legend>{label}</legend>
            {hint && <p className="settings-section-hint">{hint}</p>}
            <div className="radio-group-options">
                {options.map((option) => {
                    const inputId = `${name}-${String(option.value)}`;
                    const checked = value === option.value;
                    const disabled = option.disabled ?? false;

                    return (
                        <label
                            key={String(option.value)}
                            className={
                                checked
                                    ? "radio-group-option radio-group-option--checked"
                                    : "radio-group-option"
                            }
                            data-disabled={disabled ? "true" : undefined}
                        >
                            <input
                                type="radio"
                                id={inputId}
                                name={name}
                                value={String(option.value)}
                                checked={checked}
                                disabled={disabled}
                                onChange={() => onChange(option.value)}
                            />
                            <span>{option.label}</span>
                        </label>
                    );
                })}
            </div>
        </fieldset>
    );
}
