/**
 * pi-command-timer
 *
 * Tracks total time taken for user commands and logs them to a
 * "commands.log" file in the project directory.
 *
 * Format:  timestamp | time taken | command
 * Example: 2025-05-01T12:30:00.000Z | 14.23s | /reload
 *
 * Hooks:
 *   - "input"       → records the command text and start timestamp
 *   - "agent_end"   → records the end timestamp, writes log line, and
 *                     displays the duration in the status bar
 *   - "session_start" → resets tracking state when switching sessions/cwd
 */

import { appendFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type {
  ExtensionAPI,
  InputEvent,
  AgentEndEvent,
  SessionStartEvent,
} from "@mariozechner/pi-coding-agent";

const LOG_FILE = "commands.log";
const STATUS_KEY = "command-timer";

// Per-cwd tracking state
interface CommandRecord {
  cwd: string;
  command: string;
  startTime: number;
}

const activeCommands = new Map<string, CommandRecord>();

function getLogPath(cwd: string): string {
  return join(cwd, LOG_FILE);
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms.toFixed(0)}ms`;
  }
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(2)}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(1);
  return `${mins}m ${secs}s`;
}

function appendLogLine(cwd: string, timestamp: string, duration: string, command: string): void {
  const logPath = getLogPath(cwd);

  // Ensure directory exists (cwd should already, but be safe)
  if (!existsSync(cwd)) {
    return;
  }

  const line = `${timestamp} | ${duration} | ${command}\n`;
  appendFileSync(logPath, line, "utf-8");
}

function displayDuration(ui: { setStatus(key: string, text: string | undefined): void }, duration: string, command: string): void {
  // Truncate long commands to fit in the status bar
  const maxCmdLen = 50;
  const displayCmd =
    command.length > maxCmdLen ? command.slice(0, maxCmdLen - 3) + "..." : command;
  ui.setStatus(STATUS_KEY, `⏱ ${duration}  ${displayCmd}`);
}

export default function (pi: ExtensionAPI) {
  let currentCwd = "";

  pi.on("session_start", (_event: SessionStartEvent, ctx) => {
    currentCwd = ctx.cwd;
    // Reset tracking when session starts (new cwd or new session)
    activeCommands.delete(currentCwd);
  });

  pi.on("input", (event: InputEvent, ctx) => {
    const text = event.text?.trim();
    if (!text || !ctx.cwd) return;

    // If the same command was already tracked for this cwd (shouldn't happen, but guard)
    // Just overwrite — last command wins
    activeCommands.set(ctx.cwd, {
      cwd: ctx.cwd,
      command: text,
      startTime: Date.now(),
    });

    return { action: "continue" as const };
  });

  pi.on("agent_end", (event: AgentEndEvent, ctx) => {
    const record = activeCommands.get(ctx.cwd);
    if (!record) return;

    // Only log if this command was started by this cwd's session
    // (guard against session switches)
    if (record.cwd !== ctx.cwd) return;

    const endTime = Date.now();
    const duration = endTime - record.startTime;
    const timestamp = new Date(endTime).toISOString();

    const durationStr = formatDuration(duration);
    appendLogLine(ctx.cwd, timestamp, durationStr, record.command);

    // Also display the duration in the status bar
    displayDuration(ctx.ui, durationStr, record.command);

    // Remove the record
    activeCommands.delete(ctx.cwd);
  });
}
