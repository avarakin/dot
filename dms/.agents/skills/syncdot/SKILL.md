---
name: syncdot
description: >-
  Full dotfiles sync between the q530 and ws machines. Use when the user asks to
  sync dotfiles, save/push config changes, pull latest dotfiles, reconcile the
  two machines, or sync ~/secrets.sh. Handles git commit/push/pull of ~/dot on
  BOTH hosts via GitHub, plus scp-based syncing of ~/secrets.sh (never in git).
---

# syncdot — full dotfiles sync (q530 ↔ ws)

Two machines share the dotfiles repo `~/dot` (remote: `https://github.com/avarakin/dot.git`, branch `main`):

- **q530** — desktop; `~/.bashrc`, `~/scripts`, `~/.pi/agent/AGENTS.md` etc. are symlinks into `~/dot/dms/`.
- **ws** — server; same `~/dot` clone, same layout.

GitHub (`origin`) is the hub: git state always converges through it, so both directions work regardless of which host pi is running on. ssh works in both directions (q530→ws and ws→q530, key auth).

`~/secrets.sh` is NOT in the repo (contains API keys). It syncs separately via scp. **Never `git add` it or cat its values into a commit message.**

## Phase 0 — detect host

```bash
hostname   # q530 or ws
```
`PEER` = the other one. All remote steps run via `ssh -o BatchMode=yes $PEER '...'`.

## Phase 1 — commit and push local ~/dot

1. `git -C ~/dot status --short` and `git -C ~/dot diff` — review what changed.
2. Stage relevant changes only. Respect `.gitignore`; never stage anything secret-looking (`secrets.sh`, `auth.json`, `*.key`, tokens).
3. Commit with a concise imperative message matching history style, e.g. "Add ws-gui helper for remote GUI apps via waypipe".
4. `git -C ~/dot pull --rebase origin main` then `git -C ~/dot push origin main`.
   - Rebase conflict → STOP, report the conflicting files; do not auto-resolve destructively, do not force-push.

## Phase 2 — commit and push peer's ~/dot

1. `ssh $PEER 'git -C ~/dot status --short'`.
2. If dirty: `ssh $PEER 'git -C ~/dot diff'`, review, then commit there the same way (stage selectively, no secrets).
3. `ssh $PEER 'git -C ~/dot pull --rebase origin main && git -C ~/dot push origin main'`.
4. If peer is unreachable (ssh fails): report it; the peer only needs `git -C ~/dot pull --rebase origin main` when it's back — do not skip Phase 3.

## Phase 3 — converge and verify

1. Local: `git -C ~/dot pull --rebase origin main`.
2. Peer: `ssh $PEER 'git -C ~/dot pull --rebase origin main'`.
3. Verify identical: `git -C ~/dot rev-parse HEAD` on both hosts must match. Report both hashes.

## Phase 4 — sync ~/secrets.sh (scp, never git)

1. Compare: `diff ~/secrets.sh <(ssh $PEER 'cat ~/secrets.sh')`.
2. **Identical** → done, say so.
3. **Different** → show the diff to the user and resolve:
   - Keys present on only one side → keep the union (merge both).
   - Same key, different values → ask the user which wins; if they defer, prefer the side with the newer mtime (`stat -c %y ~/secrets.sh` on both) and say so.
4. Write the merged file locally, then push it to the peer:
   ```bash
   scp -p ~/secrets.sh $PEER:~/secrets.sh
   ssh $PEER 'chmod 600 ~/secrets.sh'
   chmod 600 ~/secrets.sh
   ```
   (scp works from either host; if one direction is ever broken, run the scp from the side that can reach the other and report the exact command.)
5. Re-diff to verify both sides match; report result.

## Safety rules

- Never force-push, never `reset --hard`, never delete remote work.
- Git conflicts: stop and report; ask before resolving semantic conflicts.
- Secrets never enter git, commit messages, or the repo history.
- End by reporting: both HEAD hashes, what was committed where, and secrets.sh status (identical / merged what).
