/**
 * pi-command-timer
 *
 * Tracks total time taken for user commands and logs them to
 * ~/.pi/log/commands.log (created if missing).
 *
 * Format (tab-separated):  timestamp \t cwd \t duration \t tokens_per_s \t command
 * Example: 2025-05-01T14:30:00.000\t/home/alex\t14.23\t245.18\t/reload
 *
 * timestamp is local time (ISO-like, no offset).
 * duration is in seconds (2 decimals).
 * tokens_per_s is output tokens generated in the run divided by duration (2 decimals).
 *
 * Consume with Unix tools, e.g.:
 *   cut -f2 ~/.pi/log/commands.log          # cwd
 *   awk -F'\t' '{print $3}' ~/.pi/log/commands.log  # duration
 *
 * Hooks:
 *   - "input"       → records the command text and start timestamp
 *   - "agent_end"   → records the end timestamp, writes log line, and
 *                     displays the duration in the status bar
 *   - "session_start" → resets tracking state when switching sessions/cwd
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type {
  ExtensionAPI,
  InputEvent,
  AgentEndEvent,
  SessionStartEvent,
} from "@mariozechner/pi-coding-agent";

type RunMessage = AgentEndEvent["messages"][number];

const LOG_DIR = join(homedir(), ".pi", "log");
const LOG_FILE = join(LOG_DIR, "commands.log");
const STATUS_KEY = "command-timer";

// Per-cwd tracking state
interface CommandRecord {
  cwd: string;
  command: string;
  startTime: number;
}

const activeCommands = new Map<string, CommandRecord>();

function formatDuration(ms: number): string {
  return (ms / 1000).toFixed(2);
}

function formatTokensPerSecond(messages: RunMessage[], durationMs: number): string {
  if (durationMs <= 0) return "0.00";
  let outputTokens = 0;
  for (const message of messages) {
    if (message.role === "assistant" && message.usage) {
      outputTokens += message.usage.output ?? 0;
    }
  }
  return (outputTokens / (durationMs / 1000)).toFixed(2);
}

function appendLogLine(cwd: string, timestamp: string, duration: string, tokensPerSec: string, command: string): void {
  // Ensure the log directory exists
  mkdirSync(LOG_DIR, { recursive: true });

  const line = `${timestamp}\t${cwd}\t${duration}\t${tokensPerSec}\t${command}\n`;
  appendFileSync(LOG_FILE, line, "utf-8");
}

function displayDuration(ui: { setStatus(key: string, text: string | undefined): void }, duration: string, command: string): void {
  // Truncate long commands to fit in the status bar
  const maxCmdLen = 50;
  const displayCmd =
    command.length > maxCmdLen ? command.slice(0, maxCmdLen - 3) + "..." : command;
  ui.setStatus(STATUS_KEY, `⏱ ${duration}s  ${displayCmd}`);
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
    // Local time, ISO-like without timezone offset
    const timestamp = new Date(endTime).toLocaleString("sv-SE");

    const durationStr = formatDuration(duration);
    const tokensPerSec = formatTokensPerSecond(event.messages, duration);
    appendLogLine(ctx.cwd, timestamp, durationStr, tokensPerSec, record.command);

    // Also display the duration in the status bar
    displayDuration(ctx.ui, durationStr, record.command);

    // Remove the record
    activeCommands.delete(ctx.cwd);
  });
}
