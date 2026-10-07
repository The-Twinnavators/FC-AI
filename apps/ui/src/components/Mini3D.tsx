/**
 * The dashboard's Network card: the same constellation as the Network Graph page (projects at the core; Structure,
 * Code, Knowledge and Intelligence clusters, each labelled, on an orbit around them), bursting out from the core when it
 * appears and then turning slowly. Look-only: the card around it opens the Network page.
 */
import { useMemo } from "react";
import { useResource } from "../api";
import { ConstellationGraph } from "./ConstellationGraph";
import { COLORS, ORBIT, layoutConstellation, type GEdge, type GNode } from "./networkLayout";

export default function Mini3D() {
  const { data } = useResource<{ nodes: GNode[]; edges: GEdge[] }>("/graph", []);
  const laid = useMemo(() => (data ? layoutConstellation(data.nodes, data.edges) : undefined), [data]);
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }} aria-hidden="true">
      {laid ? <ConstellationGraph nodes={laid.nodes} edges={laid.edges} clusters={laid.clusters} orbit={ORBIT} colors={COLORS} preview explode /> : null}
    </div>
  );
}
