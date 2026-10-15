import { useMemo } from "react";
import Link from "next/link";
import {
  Background, Controls, Handle, Position, ReactFlow, useNodesState,
  type Edge, type Node, type NodeProps,
} from "@xyflow/react";
import { portfolioLogHref, type LogSummary } from "@/lib/logApi";
import { layoutTagBranches, type LogTagGroup } from "./logGraph";
import { nextMapSelection } from "./logMapState";
import { useLogMapViewport, useMobileLogMap } from "./useLogMapState";
import { LogCardNode, type LogNode } from "./LogMapNodes";
import styles from "./LogRelationshipMap.module.css";

type TagNode = Node<{
  label: string;
  count: number;
  root: boolean;
  side?: "left" | "right";
  tagId?: string;
  onChoose?: () => void;
}, "tag">;
type TagMapNode = TagNode | LogNode;

function TagCardNode({ data }: NodeProps<TagNode>) {
  const content = <>
    <span className={styles.tagLabel}>{data.label}</span>
    <span className={styles.tagCount}>{data.count}<small>개 기록</small></span>
  </>;
  return (
    <div className={styles.tagNode} data-root={data.root}>
      {data.root ? <>
        <Handle id="left" type="source" position={Position.Left} className={styles.handle} />
        <div className={styles.tagContent} data-tag-root>{content}</div>
        <Handle id="right" type="source" position={Position.Right} className={styles.handle} />
      </> : <>
        <Handle type="target" position={data.side === "left" ? Position.Right : Position.Left} className={styles.handle} />
        <button type="button" className={`${styles.tagContent} nodrag nopan`} data-tag-node={data.tagId}
          onClick={data.onChoose} aria-label={`${data.label}, ${data.count}개 기록 펼치기`}>
          {content}
        </button>
      </>}
    </div>
  );
}

const nodeTypes = { tag: TagCardNode, log: LogCardNode };
const groupLabel = (group: LogTagGroup) => group.tag === null ? "태그 없음" : `#${group.tag}`;

export default function LogTagMap({ posts, groups, groupId, selectedSlug, filterTag, selectGroup, selectPost }: {
  posts: LogSummary[]; groups: LogTagGroup[]; groupId: string; selectedSlug: string | null;
  filterTag: string | null;
  selectGroup: (id: string) => void; selectPost: (slug: string | null) => void;
}) {
  const group = groups.find((item) => item.id === groupId);

  return <>
    <div className={styles.mapTools}>
      {filterTag && group ? <div className={styles.picker}>
        <span>선택한 태그</span>
        <strong>{groupLabel(group)} · {group.posts.length}개 기록</strong>
      </div> : <label className={styles.picker}>
        <span>태그 선택</span>
        <select aria-label="관계도 태그 선택" value={groupId} onChange={(event) => selectGroup(event.target.value)}>
          <option value="">모든 태그 보기</option>
          {groups.map((item) => <option key={item.id} value={item.id}>{groupLabel(item)} · {item.posts.length}개 기록</option>)}
        </select>
      </label>}
      {group
        ? <button type="button" className={styles.button} onClick={() => selectGroup("")}>모든 태그로 돌아가기</button>
        : <span className={styles.tagHint}>한 글은 여러 태그에 포함될 수 있습니다.</span>}
    </div>
    <TagScene key={groupId} posts={posts} groups={groups} group={group} onChooseTag={selectGroup}
      selectedSlug={selectedSlug} selectPost={selectPost} />
  </>;
}

function TagScene({ posts, groups, group, onChooseTag, selectedSlug, selectPost }: {
  posts: LogSummary[];
  groups: LogTagGroup[];
  group?: LogTagGroup;
  onChooseTag: (id: string) => void;
  selectedSlug: string | null;
  selectPost: (slug: string | null) => void;
}) {
  const mobile = useMobileLogMap();
  const viewport = useLogMapViewport(`tags:${group?.id ?? ""}:${posts.map((post) => post.slug).sort().join("|")}`);
  const scene = useMemo(() => {
    const count = group ? group.posts.length : groups.length;
    const layout = layoutTagBranches(count);
    const rootId = "tag-map-root";
    const nodes: TagMapNode[] = [{
      id: rootId, type: "tag", position: layout.center, selectable: false, focusable: false,
      data: { root: true, label: group ? groupLabel(group) : "기록 지도", count: group ? group.posts.length : posts.length },
    }];
    const edges: Edge[] = [];
    for (let index = 0; index < count; index++) {
      const { position, side } = layout.branches[index];
      const id = group ? group.posts[index].slug : groups[index].id;
      if (group) {
        const post = group.posts[index];
        nodes.push({ id, type: "log", position, data: { post, active: false, dimmed: false, side },
          ariaLabel: `${post.title}. 기록 소개 보기` });
      } else {
        const item = groups[index];
        nodes.push({ id, type: "tag", position, selectable: false, focusable: false,
          data: { label: groupLabel(item), count: item.posts.length, root: false, side, tagId: id,
            onChoose: () => onChooseTag(id) } });
      }
      edges.push({ id: `${rootId}:${id}`, source: rootId, sourceHandle: side, target: id,
        className: styles.tagEdge, style: { strokeWidth: 1.6 }, type: "default" });
    }
    return { nodes, edges };
  }, [posts, groups, group, onChooseTag]);
  const [nodes, , onNodesChange] = useNodesState<TagMapNode>(scene.nodes);
  const selectedPost = group?.posts.find((post) => post.slug === selectedSlug);
  const displayNodes = nodes.map((node) => node.type !== "log" ? node : {
    ...node, selected: node.id === selectedSlug,
    data: { ...node.data, active: node.id === selectedSlug },
  });

  return <>
    {mobile ? !group && <div className={styles.mobileTags} aria-label="태그별 기록 탐색">
      {groups.map((item) => <button key={item.id} type="button" onClick={() => onChooseTag(item.id)}
        aria-label={`${groupLabel(item)}, ${item.posts.length}개 기록 펼치기`}>
        <span>{groupLabel(item)}</span><small>{item.posts.length}개 기록</small>
      </button>)}
    </div> : <div className={styles.canvas} aria-label={group ? `${groupLabel(group)} 기록 지도` : "태그별 기록 지도"}>
      <ReactFlow<TagMapNode, Edge>
        nodes={displayNodes} edges={scene.edges} nodeTypes={nodeTypes}
        onNodesChange={(changes) => {
          onNodesChange(changes);
          const next = nextMapSelection(selectedSlug, changes);
          if (next !== selectedSlug && (next === null || group?.posts.some((post) => post.slug === next))) selectPost(next);
        }}
        onNodeClick={(_, node) => { if (node.type === "log") selectPost(node.id); }}
        onPaneClick={() => selectPost(null)}
        onInit={viewport.onInit} onMoveEnd={viewport.onMoveEnd} defaultViewport={viewport.initialViewport}
        nodesDraggable={false} nodesConnectable={false} edgesFocusable={false} deleteKeyCode={null}
        minZoom={0.25} maxZoom={1.8} zoomOnScroll={false} zoomOnPinch panOnScroll={false}
        fitView={!viewport.initialViewport} fitViewOptions={{ padding: 0.14, maxZoom: 1 }}
        ariaLabelConfig={{
          "controls.zoomIn.ariaLabel": "관계도 확대",
          "controls.zoomOut.ariaLabel": "관계도 축소",
          "controls.fitView.ariaLabel": "관계도 전체 보기",
        }}>
        <Background gap={22} size={1} color="var(--border)" />
        <Controls showInteractive={false} position="bottom-left" />
      </ReactFlow>
    </div>}
    <div className={styles.caption}>
      <span>{group ? `${groupLabel(group)} · ${group.posts.length}개 기록` : `${posts.length}개 기록 · ${groups.length}개 태그 묶음`}</span>
      {!mobile && <span>태그 소속으로 연결 · + / −로 확대·축소</span>}
    </div>
    <div className={styles.details} aria-live="polite">
      {group ? <>
        <div className={styles.selectedCopy}>
          <p className={styles.selectedLabel}>{selectedPost ? "선택한 기록" : "선택한 태그"}</p>
          <h4>{selectedPost?.title ?? groupLabel(group)}</h4>
          <p>{selectedPost?.summary ?? (mobile
            ? "같은 태그를 가진 기록입니다. 아래에서 글을 선택해 소개를 읽어보세요."
            : "같은 태그를 가진 기록입니다. 지도나 목록에서 글을 선택해 소개를 읽어보세요.")}</p>
          {selectedPost && <div className={styles.selectedActions}>
            <Link href={portfolioLogHref(selectedPost.slug)} onClick={viewport.save} className={styles.readLink}>기록 읽기 ↗</Link>
            <button type="button" className={styles.button} onClick={() => selectPost(null)}>선택 해제</button>
          </div>}
        </div>
        <div className={`${styles.relatedList} ${styles.tagRecords}`}>
          <h4>이 태그의 기록 <span>{group.posts.length}</span></h4>
          {group.posts.map((post) => <button type="button" key={post.slug}
            aria-pressed={post.slug === selectedSlug} onClick={() => selectPost(post.slug)}>
            <span>{post.title}</span>
          </button>)}
        </div>
      </> : <div className={styles.emptySelection}>
        <span className={styles.selectedLabel}>주제부터 골라보세요</span>
        <p>태그를 누르면 해당 기록만 펼쳐집니다. 모든 태그로 돌아와 다른 주제도 살펴볼 수 있습니다.</p>
        <p className={styles.method}>태그 보기는 글에 붙은 태그만 사용합니다. 글끼리의 연관성은 전체 보기에서 확인하세요.</p>
      </div>}
    </div>
  </>;
}
