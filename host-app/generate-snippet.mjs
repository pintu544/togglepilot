import { readFileSync, writeFileSync } from "node:fs";
import { generateInstrumentationSnippet } from "../dist/snippet.js";

const planUrl = new URL("../runs/2026-11-26T09-21-53.256Z/plan.json", import.meta.url);
const plan = JSON.parse(readFileSync(planUrl, "utf8"));
writeFileSync(new URL("./src/ExperimentCTA.tsx", import.meta.url), generateInstrumentationSnippet(plan));
