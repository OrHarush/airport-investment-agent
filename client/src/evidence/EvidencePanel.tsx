import { Component, forwardRef, type ReactNode } from "react";
import type { EvidenceItem } from "@airport/shared";
import { Fallback, renderers } from "./renderers";

/** If a dedicated renderer chokes on an unexpected shape, show the generic card instead of breaking the panel. */
class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const EvidencePanel = forwardRef<HTMLElement, { evidence: EvidenceItem[]; question?: string }>(function EvidencePanel({ evidence, question }, ref) {
  return (
    <aside className="evidence" aria-label="Evidence" ref={ref}>
      <h2 className="ev-title">Evidence</h2>
      {question && evidence.length > 0 && <p className="ev-for">For: {question}</p>}
      {evidence.length === 0 ? (
        <p className="ev-empty">Nothing here yet. When the agent looks something up, the data behind its answer shows up here, with its sources.</p>
      ) : (
        <div className="ev-list">
          {evidence.map((ev, i) => {
            const R = renderers[ev.tool];
            return (
              <Boundary key={`${ev.tool}-${i}`} fallback={<Fallback ev={ev} />}>
                {R ? <R ev={ev} question={question} /> : <Fallback ev={ev} />}
              </Boundary>
            );
          })}
        </div>
      )}
    </aside>
  );
});

export default EvidencePanel;
