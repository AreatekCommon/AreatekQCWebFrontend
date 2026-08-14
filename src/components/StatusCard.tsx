type StatusCardProps = {
    title: string;
    value: string;
};

export function StatusCard({ title, value }: StatusCardProps) {
    return (
        <div className="card">
            <div className="card-title">{title}</div>
            <div className="card-value">{value}</div>
        </div>
    );
}