import type { ExperimentPlan } from "./planner";

export function generateInstrumentationSnippet(plan: ExperimentPlan): string {
  const variants = plan.variants.map((variant) => ({ key: variant?.key, label: variant?.label, value: variant?.value }));
  return `import { useEffect, useState } from "react";
import flagsmith from "@flagsmith/flagsmith";

const variants = ${JSON.stringify(variants, null, 2)};

function persistentIdentity(): string {
  const storageKey = "togglepilot.identity";
  const existing = localStorage.getItem(storageKey);
  if (existing) return existing;

  const identity = crypto.randomUUID();
  localStorage.setItem(storageKey, identity);
  return identity;
}

async function initialize(): Promise<void> {
  await flagsmith.init({
    environmentID: import.meta.env.VITE_FLAGSMITH_ENVIRONMENT_ID,
    enableEvents: true,
  });
  await flagsmith.identify(persistentIdentity());
}

let initialization: Promise<void> | undefined;

export default function ExperimentCTA() {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let mounted = true;
    initialization ??= initialize().catch((error: unknown) => {
      initialization = undefined;
      throw error;
    });
    void initialization.then(
      () => { if (mounted) setStatus("ready"); },
      () => { if (mounted) setStatus("error"); },
    );

    function flush() {
      void flagsmith.flushEvents();
    }

    window.addEventListener("pagehide", flush);
    return () => {
      mounted = false;
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  if (status === "loading") return null;
  if (status === "error") return <p>Unable to load the experiment.</p>;

  const flag = flagsmith.getExperimentFlag(${JSON.stringify(plan.flagName)});
  const variant = variants.find(({ key }) => key === flag?.variant)
    ?? variants.find(({ value }) => value === flag?.value);

  return (
    <section>
      <h1>{variant?.value ?? "Welcome"}</h1>
      <button type="button" onClick={() => flagsmith.trackEvent(${JSON.stringify(plan.metric.eventName)})}>
        {variant?.label ?? "Learn more"}
      </button>
    </section>
  );
}
`;
}
