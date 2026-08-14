import { memo, useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import {
    Background,
    Controls,
    Handle,
    Position,
    ReactFlow,
    reconnectEdge,
    useReactFlow,
    type Connection,
    type Edge,
    type FinalConnectionState,
    type Node,
    type NodeProps,
    useEdgesState,
    useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { PathNode, PathPoint, PathPositionType } from "../types/api";
import { useI18n } from "../i18n/useI18n";
import { connectNodes, disconnectNode, nameForPoint } from "../utils/pathNodes";

const HEADER_CLASS: Record<PathPositionType, string> = {
    home: "path-node-card--home",
    end: "path-node-card--end",
    basic_scan: "path-node-card--basic-scan",
    advanced_scan: "path-node-card--advanced-scan",
};

type PathFlowNodeData = {
    node: PathNode;
    pointName: string;
    label: string;
};

function PathFlowNode({ data, selected }: NodeProps<Node<PathFlowNodeData>>) {
    const showInput = data.node.type !== "home";
    const showOutput = data.node.type !== "end";

    return (
        <div className={`path-node-card ${HEADER_CLASS[data.node.type]} ${selected ? "path-node-card--selected" : ""}`}>
            {showInput && <Handle type="target" position={Position.Left} id="in" />}
            <div className="path-node-card-title">{data.label}</div>
            <div className="path-node-card-subtitle">{data.pointName}</div>
            {showOutput && <Handle type="source" position={Position.Right} id="out" />}
        </div>
    );
}

const nodeTypes = { pathNode: memo(PathFlowNode) };

type PathNodeGraphProps = {
    points: PathPoint[];
    nodes: PathNode[];
    disabled?: boolean;
    selectedNodeId?: string | null;
    historyControls?: ReactNode;
    onNodesChange: (nodes: PathNode[]) => void;
    onSelectNode: (nodeId: string | null) => void;
};

function toFlowEdges(nodes: PathNode[]): Edge[] {
    const edges: Edge[] = [];
    for (const node of nodes) {
        if (node.next_node_id) {
            edges.push({
                id: `${node.id}->${node.next_node_id}`,
                source: node.id,
                target: node.next_node_id,
                sourceHandle: "out",
                targetHandle: "in",
            });
        }
    }
    return edges;
}

function resolveFlowPosition(
    node: PathNode,
    existing: Node<PathFlowNodeData> | undefined,
): { x: number; y: number } {
    const propPosition = { x: node.x ?? 0, y: node.y ?? 0 };
    if (!existing) {
        return propPosition;
    }
    if (existing.dragging) {
        return existing.position;
    }
    if (existing.position.x !== propPosition.x || existing.position.y !== propPosition.y) {
        return propPosition;
    }
    return existing.position;
}

function FitViewOnLoad({ nodeCount }: { nodeCount: number }) {
    const { fitView } = useReactFlow();
    const fittedCountRef = useRef(0);

    useEffect(() => {
        if (nodeCount > 0 && fittedCountRef.current === 0) {
            fitView({ padding: 0.2 });
            fittedCountRef.current = nodeCount;
        } else if (nodeCount === 0) {
            fittedCountRef.current = 0;
        }
    }, [fitView, nodeCount]);

    return null;
}

export function PathNodeGraph({
    points,
    nodes,
    disabled = false,
    selectedNodeId = null,
    historyControls,
    onNodesChange,
    onSelectNode,
}: PathNodeGraphProps) {
    const { t } = useI18n();

    const initialNodes = useMemo(
        () =>
            nodes.map((node) => ({
                id: node.id,
                type: "pathNode" as const,
                position: { x: node.x ?? 0, y: node.y ?? 0 },
                selected: node.id === selectedNodeId,
                data: {
                    node,
                    pointName: nameForPoint(points, node.point_id),
                    label: t.pathsPage.types[node.type],
                },
            })),
        [nodes, points, selectedNodeId, t.pathsPage.types],
    );

    const initialEdges = useMemo(() => toFlowEdges(nodes), [nodes]);

    const [flowNodes, setFlowNodes, onFlowNodesChange] = useNodesState(initialNodes);
    const [flowEdges, setFlowEdges, onFlowEdgesChange] = useEdgesState(initialEdges);

    useEffect(() => {
        setFlowNodes((current) => {
            const currentById = new Map(current.map((flowNode) => [flowNode.id, flowNode]));
            return nodes.map((node) => {
                const existing = currentById.get(node.id);
                return {
                    id: node.id,
                    type: "pathNode" as const,
                    position: resolveFlowPosition(node, existing),
                    selected: node.id === selectedNodeId,
                    data: {
                        node,
                        pointName: nameForPoint(points, node.point_id),
                        label: t.pathsPage.types[node.type],
                    },
                };
            });
        });
        setFlowEdges(toFlowEdges(nodes));
    }, [nodes, points, selectedNodeId, setFlowEdges, setFlowNodes, t.pathsPage.types]);

    const handleConnect = useCallback(
        (connection: Connection) => {
            if (disabled || !connection.source || !connection.target) {
                return;
            }
            onNodesChange(connectNodes(nodes, connection.source, connection.target));
        },
        [disabled, nodes, onNodesChange],
    );

    const handleReconnect = useCallback(
        (oldEdge: Edge, connection: Connection) => {
            if (disabled || !connection.source || !connection.target) {
                return;
            }
            setFlowEdges((edges) => reconnectEdge(oldEdge, connection, edges));
            onNodesChange(connectNodes(nodes, connection.source, connection.target));
        },
        [disabled, nodes, onNodesChange, setFlowEdges],
    );

    const handleReconnectEnd = useCallback(
        (
            _event: MouseEvent | TouchEvent,
            edge: Edge,
            _handleType: "source" | "target",
            connectionState: FinalConnectionState,
        ) => {
            if (disabled || connectionState.isValid === true) {
                return;
            }
            if (connectionState.isValid !== false) {
                return;
            }
            onNodesChange(disconnectNode(nodes, edge.source, "next"));
        },
        [disabled, nodes, onNodesChange],
    );

    const handleEdgesDelete = useCallback(
        (edgesToRemove: Edge[]) => {
            if (disabled) {
                return;
            }
            let next = nodes;
            for (const edge of edgesToRemove) {
                next = disconnectNode(next, edge.source, "next");
            }
            onNodesChange(next);
        },
        [disabled, nodes, onNodesChange],
    );

    const handleNodeDragStop = useCallback(
        (_event: MouseEvent | TouchEvent, node: Node<PathFlowNodeData>) => {
            if (disabled) {
                return;
            }
            onNodesChange(
                nodes.map((item) =>
                    item.id === node.id ? { ...item, x: node.position.x, y: node.position.y } : item,
                ),
            );
        },
        [disabled, nodes, onNodesChange],
    );

    return (
        <div className="path-node-graph-section">
            <div className="path-editor-subtitle">{t.pathsPage.nodeGraph}</div>
            <div className="path-node-graph-wrap">
                {historyControls}
                <ReactFlow
                    nodes={flowNodes}
                    edges={flowEdges}
                    nodeTypes={nodeTypes}
                    onNodesChange={onFlowNodesChange}
                    onEdgesChange={onFlowEdgesChange}
                    onConnect={handleConnect}
                    onReconnect={handleReconnect}
                    onReconnectEnd={handleReconnectEnd}
                    onEdgesDelete={handleEdgesDelete}
                    onNodeDragStop={handleNodeDragStop}
                    onNodeClick={(_, node) => onSelectNode(node.id)}
                    onPaneClick={() => onSelectNode(null)}
                    nodesDraggable={!disabled}
                    nodesConnectable={!disabled}
                    edgesReconnectable={!disabled}
                    elementsSelectable={!disabled}
                >
                    <Background />
                    <Controls />
                    <FitViewOnLoad nodeCount={nodes.length} />
                </ReactFlow>
            </div>
        </div>
    );
}
