import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import flagsmith from "@flagsmith/flagsmith";
import ExperimentCTA from "./ExperimentCTA";
import "./styles.css";

const flagName = "togglepilot_headline_cta";

function App() {
  const [board, setBoard] = useState<HTMLElement | null>(null);
  const [revision, setRevision] = useState(0);


  return (
    <main className="instrument">
      <div className="flap" ref={setBoard}>
        <ExperimentCTA key={revision} />
        <p className="loading" role="status">Loading experiment…</p>
      </div>
      <Board node={board} revision={revision} />
      <footer>
        <p>This is a live experiment demo (experiment 590).</p>
        <button className="retry" type="button" onClick={() => setRevision(revision + 1)}>Retry loading</button>
      </footer>
    </main>
  );
}

function Board({ node, revision }: { node: HTMLElement | null; revision: number }) {
  // Read the SDK state after the generated CTA renders its assignment.
  const [assignment, setAssignment] = useState<{ identity: string; variant: string }>();
  useEffect(() => {
    if (!node) return;
    function readAssignment() {
      if (!node?.querySelector("h1")) {
        setAssignment(undefined);
        return;
      }

      const identity = localStorage.getItem("togglepilot.identity");
      const variant = flagsmith.getAllFlags()?.[flagName]?.variant;
      setAssignment(identity && variant ? { identity, variant } : undefined);
    }

    const observer = new MutationObserver(readAssignment);
    observer.observe(node, { childList: true, subtree: true });
    readAssignment();
    return () => observer.disconnect();
  }, [node, revision]);

  return (
    <dl className="data" aria-label="Experiment assignment">
      <div><dt>Identity ID</dt><dd>{assignment?.identity ?? "Pending"}</dd></div>
      <div><dt>Variant key</dt><dd className={assignment ? "assigned" : undefined}>{assignment?.variant ?? "Pending"}</dd></div>
      <div><dt>Flag name</dt><dd>{flagName}</dd></div>
      <div><dt>Experiment ID</dt><dd>590</dd></div>
    </dl>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
