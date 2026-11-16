---
name: perftest
description: Rerun or reproduce a Strata performance benchmark (speed suite + needle recall) against a running Strata server, with provenance notes and a median [min-max] report. Use when asked to rerun, reproduce, repeat, or run a Strata benchmark, perf test, throughput test, or a community benchmark run.
---

# Strata performance benchmark (perftest)

Reproduces the community benchmark method used in
`/data/ai/Strata/bench/results/2026-10-06-community-rtx-5060ti/` (speed suite +
recall + memory sampling). Run everything in the foreground as blocking
commands; the suite must run while the agent is not generating, because the
Strata engine serves one request at a time and the agent may share the server.

## Prerequisites (check first, read-only)

1. Server up and model loaded: `curl -s http://127.0.0.1:8080/v1/status` —
   note `engine` version, `model`, `uptime_s`.
2. Repo root (default `/data/ai/Strata`), its `.venv/bin/python`, and the pack
   dir (default `/data/ai/Strata-data/packs/iq3_s`) exist.
3. `tools/needle_bench.py` exists in the repo.
4. Record the current git commit and engine binary mtime for provenance.

## Output directory

Always write to a NEW dated directory; never overwrite a published run:

```
/data/ai/Strata/bench/results/YYYY-MM-DD-<label>[-rerun]/
```

## Step 1 — speed suite (foreground, blocking; ~8 min for 3x3)

```bash
cd /data/ai/Strata && .venv/bin/python <skill-dir>/scripts/benchmark.py \
  --root /data/ai/Strata --pack /data/ai/Strata-data/packs/iq3_s \
  --url http://127.0.0.1:8080 \
  --out bench/results/<dated-dir> \
  --targets 4096,32768,128000 --runs 3
```

`scripts/benchmark.py` is the community script WITH the engine-record matching
fix (it matches the engine record by prompt length and finish time instead of
taking `metrics["requests"][0]`, which matters on a shared server). The copy in
`bench/results/2026-09-30-community-rtx-5090/` is the published unfixed one —
use the skill copy. Expect one benign `concurrent_requests=1` warning on the
first run: the script's own warm-up request. Verify: every run has
`reused: 0`, 256 output tokens, `finish: "length"`.

## Step 2 — recall phase with memory sampling

Start the monitor in the background from the output dir, run recall in the
foreground, then stop the monitor:

```bash
cd /data/ai/Strata/bench/results/<dated-dir>
nohup /data/ai/Strata/.venv/bin/python <skill-dir>/scripts/monitor.py telemetry.jsonl >/dev/null 2>&1 &
echo $! > monitor.pid
cd /data/ai/Strata && .venv/bin/python tools/needle_bench.py --url http://127.0.0.1:8080 \
  --lengths 32k,128k --depths 10,50,90 --out bench/results/<dated-dir>/needles.json
kill "$(cat <dated-dir>/monitor.pid)"; rm <dated-dir>/monitor.pid
```

Do NOT `pkill -f monitor.py` from a shell whose own command line matches — it
kills the shell (exit 143). Then summarize:

```bash
.venv/bin/python <skill-dir>/scripts/summarize-memory.py <dated-dir>/telemetry.jsonl \
  --out <dated-dir>/memory-summary.json \
  --method "nominal 1 s; /proc/meminfo and nvidia-smi; needle recall checks only (the speed suite ran before sampling started)"
```

## Step 3 — provenance (`RUN-NOTES.json` in the output dir)

Record: rerun-of which run, run date (UTC), machine, engine version, engine
binary mtime, source commit, CUDA/NVCC version, Python version, whether the
server was reused or restarted, machine boot time (`uptime -s`), model/pack
identity, the exact commands used, and notes on anomalies (swap level at
sampling start, needle_bench prompt lengths differing from an older baseline
means the tool changed, concurrent-request warnings).

## Step 4 — report

Table of median [min–max] of the runs for prompt tok/s, decode tok/s, TTFT and
total seconds per prompt length, compared against the baseline run's table when
rerunning one. Include decode expert-cache hit rates (`hit_rate` in each engine
record) and draft acceptance (drafts_accepted / drafts_offered), recall
found/total with actual prompt token counts, and the memory summary (GPU peak,
RAM peak, swap, power peak). State caveats: engine/config/version differences
vs the baseline are NOT a controlled A/B unless a rebuild A/B was actually run;
the machine is not isolated; results are synthetic greedy workloads.
