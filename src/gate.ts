import { containsCredential, isExperimentPlan, type ExperimentPlan } from "./planner";
import type { createPrompt } from "./prompt";
import { generateInstrumentationSnippet } from "./snippet";
import { formatPreflightReport, runPreflightChecks, type PreflightReport } from "./validator";

interface Review {
  plan: ExperimentPlan;
  report: PreflightReport;
}

export interface ApprovalOutcome extends Review {
  decision: "approved" | "rejected";
}

interface GateOptions {
  prompt: ReturnType<typeof createPrompt>;
  preflight: Parameters<typeof runPreflightChecks>[2];
  print: (message: string) => void;
  printPlan: (plan: ExperimentPlan, snippet: string) => void;
}

export async function approvalGate(initial: Review, { prompt, preflight, print, printPlan }: GateOptions): Promise<ApprovalOutcome> {
  let presented = initial;
  let draft = initial.plan;
  let canApprove = true;

  async function ask(label: string, fallback: string): Promise<string> {
    print(`${label} [${fallback}]`);
    return (await prompt.read())?.trim() || fallback;
  }

  while (true) {
    print("[A]pprove / [E]dit / [R]eject");
    const choice = (await prompt.read())?.trim().toLowerCase();
    switch (choice) {
      case undefined:
      case "r":
      case "reject":
        return { ...presented, decision: "rejected" };
      case "a":
      case "approve":
        if (canApprove) return { ...presented, decision: "approved" };
        print("Approval is unavailable until the plan is valid and all checks pass.");
        break;
      case "e":
      case "edit": {
        const edited = structuredClone(draft);
        print("Press Enter to keep the current value.");
        for (const [index, variant] of edited.variants.entries()) {
          const label = `Variant ${index + 1}`;
          variant.key = await ask(`${label} key`, variant.key);
          variant.label = await ask(`${label} label`, variant.label);
          variant.value = await ask(`${label} value`, variant.value);
        }
        const split = await ask("Variation split (comma-separated, control last)", draft.variationSplit.join(","));
        edited.variationSplit = split.split(",").map((share) => share.trim() ? Number(share) : NaN);
        edited.rolloutPercent = Number(await ask("Rollout percent", String(draft.rolloutPercent)));
        edited.metric.eventName = await ask("Metric event name", draft.metric.eventName);
        if (edited.hypothesis.metric === draft.metric.eventName) edited.hypothesis.metric = edited.metric.eventName;

        canApprove = false;
        if (containsCredential(edited)) {
          print("Remove credentials from the experiment inputs.");
          break;
        }

        draft = edited;
        const valid = isExperimentPlan(edited);
        const snippet = generateInstrumentationSnippet(edited);
        const report = await runPreflightChecks(edited, snippet, preflight);
        print(formatPreflightReport(report));
        if (!valid) {
          print("Invalid experiment plan. Check the variant keys, labels and values, rollout percentage, and split. Enter one percentage per variant plus control, totaling 100.");
        }
        canApprove = valid && report.every(({ status }) => status === "pass");
        if (canApprove) {
          printPlan(edited, snippet);
          presented = { plan: edited, report };
        }
        break;
      }
      default:
        print("Enter A, E, or R.");
    }
  }
}
