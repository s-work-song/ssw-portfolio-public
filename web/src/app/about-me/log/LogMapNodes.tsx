import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { LogSummary } from "@/lib/logApi";
import styles from "./LogRelationshipMap.module.css";

export type LogNode = Node<{
  post: LogSummary;
  active: boolean;
  dimmed: boolean;
  side?: "left" | "right";
  routed?: boolean;
}, "log">;

export function LogCardNode({ data }: NodeProps<LogNode>) {
  return (
    <div className={styles.node} data-active={data.active} data-dimmed={data.dimmed}
      data-log-node={data.post.slug} title={data.post.title}>
      {data.routed ? Object.values(Position).flatMap((position) => (["source", "target"] as const).map((type) => (
        <Handle key={`${type}-${position}`} id={`${type}-${position}`} type={type} position={position} className={styles.handle} />
      ))) : <Handle type="target" position={data.side === "left" ? Position.Right : Position.Left} className={styles.handle} />}
      <span className={styles.nodeTags}>{data.post.tags.map((tag) => `#${tag}`).join(" ")}</span>
      <span className={styles.nodeTitle}>{data.post.title}</span>
      {!data.routed && <Handle type="source" position={Position.Right} className={styles.handle} />}
    </div>
  );
}

export function motionDuration() {
  const setting = document.documentElement.dataset.motion;
  return setting === "off"
    || (setting !== "on" && window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    ? 0 : 220;
}
