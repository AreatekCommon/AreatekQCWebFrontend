import type { ReactNode } from "react";
import type { ScannerEnumKey } from "../constants/scannerEnumOptions";

type EnumSelectFieldProps<T extends string | number> = {
    label: string;
    value: T;
    options: Array<{ value: T; labelKey: ScannerEnumKey }>;
    getLabel: (key: ScannerEnumKey) => string;
    onChange: (value: T) => void;
    className?: string;
    children?: ReactNode;
};

export function EnumSelectField<T extends string | number>({
    label,
    value,
    options,
    getLabel,
    onChange,
    className = "form-field",
}: EnumSelectFieldProps<T>) {
    return (
        <label className={className}>
            <span>{label}</span>
            <select
                value={String(value)}
                onChange={(e) => {
                    const raw = e.target.value;
                    const nextValue = (
                        typeof value === "number" ? Number(raw) : raw
                    ) as T;
                    onChange(nextValue);
                }}
            >
                {options.map((option) => (
                    <option key={String(option.value)} value={String(option.value)}>
                        {getLabel(option.labelKey)}
                    </option>
                ))}
            </select>
        </label>
    );
}
