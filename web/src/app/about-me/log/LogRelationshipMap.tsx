"use client";

import { useMemo, useState } from "react";
import {
  Background,
  BaseEdge,
  Controls,
  MarkerType,
  ReactFlow,
  useNodesState,
  type Edge,
  type EdgeProps,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { LogSummary } from "@/lib/logApi";
import LogReadingLink from "./LogReadingLink";
import { buildLogGraph, buildLogTagGroups, describeLogConnection, layoutLogGraph } from "./logGraph";
import { nextMapSelection } from "./logMapState";
import { routeLogGraphEdges } from "./logGraphRouting";
import { useLogMapNavigation, useLogMapViewport, useMobileLogMap } from "./useLogMapState";
import { LogCardNode, motionDuration, type LogNode } from "./LogMapNodes";
import LogTagMap from "./LogTagMap";
import styles from "./LogRelationshipMap.module.css";

const nodeTypes = { log: LogCardNode };
type RoutedEdge = Edge<{ path: string }>;
function CardAvoidingEdge({ id, data, style, markerEnd }: EdgeProps<RoutedEdge>) {
  return data && <BaseEdge id={id} path={data.path} style={style} markerEnd={markerEnd} />;
}
const edgeTypes = { routed: CardAvoidingEdge };

/** 목록 API의 공개 메타데이터로 구성하는 실험용 탐색 화면이다. */
export default function LogRelationshipMap({ posts, filterTag, selectFilterTag }: {
  posts: LogSummary[]; filterTag: string | null; selectFilterTag: (tag: string | null) => void;
}) {
  const groups = useMemo(() => buildLogTagGroups(posts), [posts]);
  const [navigation, setNavigation] = useLogMapNavigation(posts, groups, filterTag);
  const { mode, groupId, selectedSlug } = navigation;
  const mobile = useMobileLogMap();
  const setMode = (mode: "all" | "tags") => setNavigation({ ...navigation, mode, selectedSlug: null });
  const selectPost = (selectedSlug: string | null) => setNavigation({ ...navigation, selectedSlug });
  const selectGroup = (groupId: string) => {
    setNavigation({ ...navigation, groupId, selectedSlug: null });
    const group = groups.find((item) => item.id === groupId);
    if (!groupId || group?.tag) selectFilterTag(group?.tag ?? null);
  };
  const [expanded, setExpanded] = useState(false);
  const postsKey = posts.map((post) => post.slug).join("|");

  return (
    <div className={styles.map} data-expanded={expanded} data-map-mode={mode}>
      <div className={styles.heading}>
        <div>
          <h3>기록 사이를 따라가 보세요</h3>
          <p>{mode === "all"
            ? "글을 선택하면 연결된 기록과 그 이유를 볼 수 있습니다."
            : "태그를 선택하면 같은 주제의 기록이 펼쳐집니다."}</p>
        </div>
        {!(mobile && mode === "tags") && <button type="button" className={styles.button} aria-pressed={expanded}
          onClick={() => setExpanded((value) => !value)}>
          {expanded ? "높이 줄이기" : "높이 늘리기"}
        </button>}
      </div>
      <div className={styles.modeSwitch} role="group" aria-label="관계도 보기 방식">
        <button type="button" aria-pressed={mode === "all"} onClick={() => setMode("all")}>전체 보기</button>
        <button type="button" aria-pressed={mode === "tags"} onClick={() => setMode("tags")}>태그 보기</button>
      </div>
      {mode === "all" ? <AllRecordsMap key={postsKey} posts={posts} selectedSlug={selectedSlug} selectPost={selectPost} />
        : <LogTagMap key={postsKey} posts={posts} groups={groups} groupId={groupId} selectedSlug={selectedSlug}
          filterTag={filterTag} selectPost={selectPost} selectGroup={selectGroup} />}
    </div>
  );
}

function AllRecordsMap({ posts, selectedSlug, selectPost }: {
  posts: LogSummary[]; selectedSlug: string | null; selectPost: (slug: string | null) => void;
}) {
  const viewport = useLogMapViewport(`all:${posts.map((post) => post.slug).sort().join("|")}`);
  const graph = useMemo(() => buildLogGraph(posts), [posts]);
  const positions = useMemo(() => layoutLogGraph(posts, graph.edges), [posts, graph]);
  const routes = useMemo(() => routeLogGraphEdges(positions, graph.edges), [positions, graph]);
  const [nodes, , onNodesChange] = useNodesState<LogNode>(posts.map((post) => ({
    id: post.slug,
    type: "log",
    position: positions[post.slug],
    data: { post, active: false, dimmed: false, routed: true },
    zIndex: 1,
    ariaLabel: `${post.title}. 연결된 기록 보기`,
  })));
  const [flow, setFlow] = useState<ReactFlowInstance<LogNode, Edge> | null>(null);
  const selectedPost = posts.find((post) => post.slug === selectedSlug);
  const connections = useMemo(() => graph.edges
    .filter((edge) => edge.source === selectedSlug || edge.target === selectedSlug)
    .map((edge) => ({
      edge,
      post: posts.find((post) => post.slug === (
        edge.source === selectedSlug ? edge.target : edge.source
      ))!,
    }))
    .sort((a, b) => Number(b.edge.kind === "reference") - Number(a.edge.kind === "reference")
      || b.edge.score - a.edge.score), [graph, posts, selectedSlug]);
  const focusedSlugs = useMemo(() => new Set([
    ...(selectedSlug ? [selectedSlug] : []),
    ...connections.map(({ post }) => post.slug),
  ]), [connections, selectedSlug]);
  const displayNodes = useMemo(() => nodes.map((node) => ({
    ...node,
    selected: node.id === selectedSlug,
    data: {
      ...node.data,
      active: node.id === selectedSlug,
      dimmed: selectedSlug !== null && !focusedSlugs.has(node.id),
    },
  })), [nodes, selectedSlug, focusedSlugs]);
  const displayEdges: RoutedEdge[] = useMemo(() => graph.edges.flatMap((edge) => {
    const route = routes[edge.id];
    if (!route) return [];
    const active = selectedSlug === edge.source || selectedSlug === edge.target;
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: "routed",
      sourceHandle: `source-${route.sourceSide}`,
      targetHandle: `target-${route.targetSide}`,
      data: { path: route.path },
      markerEnd: edge.kind === "reference" ? { type: MarkerType.ArrowClosed, color: "var(--accent)" } : undefined,
      ariaLabel: edge.reason,
      className: `${styles.edge} ${edge.kind === "reference" ? styles.referenceEdge : styles.relatedEdge}`,
      style: {
        opacity: selectedSlug === null ? 0.55 : active ? 1 : 0.08,
        strokeWidth: active ? 2.4 : 1.2,
      },
      zIndex: 0,
    };
  }), [graph, routes, selectedSlug]);

  const choosePost = (slug: string | null) => {
    selectPost(slug);
    if (!flow) return;
    const neighbors = new Set(slug ? [slug] : posts.map((post) => post.slug));
    if (slug) {
      for (const edge of graph.edges) {
        if (edge.source === slug) neighbors.add(edge.target);
        if (edge.target === slug) neighbors.add(edge.source);
      }
    }
    void flow.fitView({
      nodes: nodes.filter((node) => neighbors.has(node.id)),
      padding: 0.2,
      maxZoom: 1.05,
      duration: motionDuration(),
    });
  };

  return (
    <>
      <div className={styles.mapTools}>
        <label className={styles.picker}>
          <span>기록 선택</span>
          <select aria-label="기록 선택" value={selectedSlug ?? ""} onChange={(event) => choosePost(event.target.value || null)}>
            <option value="">전체 관계 보기</option>
            {posts.map((post) => <option key={post.slug} value={post.slug}>{post.title}</option>)}
          </select>
        </label>
        <div className={styles.legend} aria-label="연결선 구분">
          <span><i className={styles.directSwatch} />본문 연결</span>
          <span><i className={styles.relatedSwatch} />태그·주제 유사</span>
        </div>
      </div>

      <div className={styles.canvas} aria-label="기록 관계도">
        <ReactFlow<LogNode, Edge>
          nodes={displayNodes}
          edges={displayEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          elevateEdgesOnSelect={false}
          onNodesChange={(changes) => {
            onNodesChange(changes);
            const next = nextMapSelection(selectedSlug, changes);
            if (next !== selectedSlug) selectPost(next);
          }}
          onNodeClick={(_, node) => choosePost(node.id)}
          onPaneClick={() => choosePost(null)}
          onInit={(instance) => { setFlow(instance); viewport.onInit(instance); }}
          onMoveEnd={viewport.onMoveEnd}
          defaultViewport={viewport.initialViewport}
          nodesDraggable={false}
          nodesConnectable={false}
          edgesFocusable={false}
          deleteKeyCode={null}
          minZoom={0.25}
          maxZoom={1.8}
          zoomOnScroll={false}
          zoomOnPinch
          panOnScroll={false}
          fitView={!viewport.initialViewport}
          fitViewOptions={{ padding: 0.14, maxZoom: 1 }}
          ariaLabelConfig={{
            "controls.zoomIn.ariaLabel": "관계도 확대",
            "controls.zoomOut.ariaLabel": "관계도 축소",
            "controls.fitView.ariaLabel": "관계도 전체 보기",
          }}
        >
          <Background gap={22} size={1} color="var(--border)" />
          <Controls showInteractive={false} position="bottom-left" />
        </ReactFlow>
      </div>
      <div className={styles.caption}>
        <span>{posts.length}개 기록 · {graph.edges.length}개 연결</span>
        <span>드래그로 이동 · + / −로 확대·축소</span>
      </div>

      <div className={styles.details} aria-live="polite">
        {selectedPost ? (
          <>
            <div className={styles.selectedCopy} data-log-return-slug={selectedPost.slug} tabIndex={-1}>
              <p className={styles.selectedLabel}>선택한 기록</p>
              <h4>{selectedPost.title}</h4>
              <p>{selectedPost.summary}</p>
              <div className={styles.selectedActions}>
                <LogReadingLink slug={selectedPost.slug} onClick={viewport.save} className={styles.readLink}>기록 읽기 ↗</LogReadingLink>
                <button type="button" className={styles.button} onClick={() => choosePost(null)}>선택 해제</button>
              </div>
            </div>
            <div className={styles.relatedList}>
              <h4>이어지는 기록 <span>{connections.length}</span></h4>
              {connections.length === 0 && <p>현재 표시된 기록에는 가까운 연결이 없습니다.</p>}
              {connections.map(({ post, edge }) => (
                <button type="button" key={post.slug} onClick={() => choosePost(post.slug)}>
                  <span>{post.title}</span>
                  <small>{describeLogConnection(edge, selectedPost.slug)}</small>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className={styles.emptySelection}>
            <span className={styles.selectedLabel}>어디서부터 읽을까요?</span>
            <p>궁금한 글을 고르거나 위의 태그로 범위를 좁혀보세요.</p>
            <p className={styles.method}>태그와 제목·요약이 가까운 연결만 표시합니다. 본문 연결은 글에서 직접 참조한 기록이며, 화살표는 참조한 글에서 참조된 글로 향합니다.</p>
          </div>
        )}
      </div>
    </>
  );
}
