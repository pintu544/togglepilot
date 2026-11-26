import { useEffect, useState } from "react";
import flagsmith from "@flagsmith/flagsmith";

const variants = [
  {
    "key": "Variant_1",
    "label": "Shorter headline",
    "value": "shorter_headline"
  }
];

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

  const flag = flagsmith.getExperimentFlag("togglepilot_headline_cta");
  const variant = variants.find(({ key }) => key === flag?.variant)
    ?? variants.find(({ value }) => value === flag?.value);

  return (
    <section>
      <h1>{variant?.value ?? "Welcome"}</h1>
      <button type="button" onClick={() => flagsmith.trackEvent("cta_clicked")}>
        {variant?.label ?? "Learn more"}
      </button>
    </section>
  );
}
