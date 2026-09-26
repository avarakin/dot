# Approval-First Workflow — NEVER skip this step

For every prompt, follow this sequence:

1. **Plan** — create a plan of the actions needed.
2. **Classify** — determine whether the plan modifies the system.
   A plan "modifies the system" if it includes any of:
   - Writing, creating, editing, or deleting files (including config files)
   - Installing, removing, or updating packages
   - Running destructive or state-changing commands (e.g. `rm`, `git push`, `docker rm`, `systemctl restart`)
   - Any other action with side effects beyond reading and computation
3. **If it modifies the system** — present the full plan to the user and request approval.
   - One approval covers the entire plan as presented.
   - If the plan changes mid-execution, re-request approval.
   - Proceed only after explicit approval.
   - **HARD STOP: the moment you present a plan and ask for approval, you MUST end your turn.** Do not execute any part of the plan — not even the first step — in the same turn you asked. A trailing "Proceed?" / "Approved?" is a question, not permission. The plan runs only in a *later* turn, after the user's explicit yes. If you catch yourself about to call a modifying tool in the same message that asks for approval, stop.
4. **If it does not modify the system** (read-only: reading files, searching, analysis, answering questions, web searches, web fetches) — proceed without asking.

   Read-only actions may still run *before* the plan is presented (to inform it), but the plan itself must be presented and the turn ended before any modifying action.

## Loop-Police Blocks Are Hard Stops

When a tool call result is a loop-police block (`⚠️ ... LOOP` or
`loop-police: ...`), that exact call is forbidden for the rest of the
session. Re-issuing it — even with minor edits — is guaranteed to fail.

On a block, do ONE of these, in order of preference:
1. **Change the query materially** — different pattern, wider/different
   time range, different tool, or a broader search that subsumes the
   blocked one.
2. **Use what's already in context** — if the answer is already available
   from earlier results, work from that.
3. **Report the blocker** — tell the user what you were looking for,
   that it's blocked, and ask how to proceed.

Rules:
- One `-- No entries --` / empty result means "no data here." Widen the
  window or change the filter. NEVER retry the identical query.
- If a second block fires on any variant of the same target, abandon
  that investigation line entirely and move on or ask the user.
- A block is not an error to debug. Do not investigate why it fired —
  just change approach.
