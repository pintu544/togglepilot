#!/usr/bin/env node
/**
 * TogglePilot — CLI shell (Slice 0 scaffold).
 *
 * Subcommands are stubs; feature logic lands in Slice 1 (Planner, Validator,
 * Executor, Reporter per DESIGN.md). The shell only parses arguments, enforces
 * the credential guard on mutating commands, and prints output.
 */
import { requireCredentials } from "./credentials";

const USAGE = `TogglePilot — describe an A/B test in one sentence; it validates, plans,
gets your approval, launches it on Flagsmith, and tells you the winner.

Usage:
  togglepilot run <sentence>     Plan, validate and (on approval) create an experiment
  togglepilot results            Plain-English readout of the experiment's results
  togglepilot rollout            Recommend and (on approval) roll out the winner
  togglepilot --help             Show this help

Credentials (environment variables only, see .env.example):
  FLAGSMITH_API_KEY              Management API key
  FLAGSMITH_ENVIRONMENT_KEY      Client-side environment key for the target environment`;

function main(): void {
  const [command, ..._args] = process.argv.slice(2);

  switch (command) {
    case "run":
      requireCredentials("run");
      console.log("togglepilot run: not implemented yet");
      break;
    case "results":
      console.log("togglepilot results: not implemented yet");
      break;
    case "rollout":
      requireCredentials("rollout");
      console.log("togglepilot rollout: not implemented yet");
      break;
    case "--help":
    case "-h":
    case undefined:
      console.log(USAGE);
      break;
    default:
      console.error(`Unknown subcommand: ${command}`);
      console.log(USAGE);
      process.exit(1);
  }
}

main();
