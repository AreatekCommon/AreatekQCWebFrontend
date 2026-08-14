import type { PathTravelStep } from "../types/api";
import { useI18n } from "../i18n/useI18n";

type TravelRouteTableProps = {
    steps: PathTravelStep[];
};

export function TravelRouteTable({ steps }: TravelRouteTableProps) {
    const { t } = useI18n();

    if (!steps.length) {
        return null;
    }

    return (
        <div className="travel-route-table-wrap">
            <div className="path-editor-subtitle">{t.pathsPage.travelRouteTableTitle}</div>
            <table className="travel-route-table">
                <thead>
                    <tr>
                        <th>{t.pathsPage.travelRouteTable.hop}</th>
                        <th>{t.pathsPage.travelRouteTable.pointId}</th>
                        <th>{t.pathsPage.travelRouteTable.name}</th>
                        <th>{t.pathsPage.travelRouteTable.nodeType}</th>
                        <th>{t.pathsPage.travelRouteTable.turntableAngle}</th>
                        <th>{t.pathsPage.travelRouteTable.status}</th>
                    </tr>
                </thead>
                <tbody>
                    {steps.map((step, index) => (
                        <tr key={`${step.point_id}-${index}`} className={step.skipped ? "travel-route-row--skipped" : ""}>
                            <td>{index + 1}</td>
                            <td>{step.point_id}</td>
                            <td>{step.name || "—"}</td>
                            <td>{step.node_type}</td>
                            <td>{step.turntable_angle.toFixed(1)}</td>
                            <td>
                                {step.skipped
                                    ? t.pathsPage.travelRouteTable.skipped
                                    : t.pathsPage.travelRouteTable.executed}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
