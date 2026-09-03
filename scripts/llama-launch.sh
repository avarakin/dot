#!/usr/bin/env bash
set -euo pipefail

# ── Launcher selection ──────────────────────────────────────────────
# Change MODE to switch between launchers.
MODE="${LLAMA_LAUNCH_MODE:-3.8}"
# ─────────────────────────────────────────────────────────────────────

case "$MODE" in

3.8)
    /usr/bin/llama-server -m ~/ai/models/Qwen3.8-27B-UD-IQ3_S.gguf  \
        -t 16 \
        --cache-type-k q4_0 --cache-type-v q4_0 \
        --flash-attn on \
        --ctx-size 130000 \
        --reasoning off  --jinja \
        --batch-size 2048 --ubatch-size 1024 \
        --no-context-shift \
        --parallel 1 \
        --n-gpu-layers 999 \
        --defrag-thold 0.1 \
        --temp 0.7 --top-p 0.8 --top-k 20 --min-p 0.00 \
        --spec-type draft-mtp --spec-draft-n-max 2 --chat-template-kwargs '{"reasoning_effort":"medium"}' --metrics
    ;;

27b)
    /usr/bin/llama-server -m ~/ai/models/Qwen3.6-27B-UD-IQ3_XXS.gguf \
                                  -t 32 \
                                  --n-gpu-layers 999 \
                                  --cache-type-k q4_0 \
                                  --cache-type-v q4_0 \
                                  --flash-attn on \
                                --ctx-size 60000 \
                                  --reasoning off \
                                  --jinja \
                                  --batch-size 8192 \
                                  --ubatch-size 2048 \
                                  --no-context-shift \
                                  --defrag-thold 0.1 \
                                  --temp 0.6 --top-p 0.95 --top-k 20 --min-p 0.00 --spec-type draft-mtp --spec-draft-n-max 2  --chat-template-kwargs '{"preserve_thinking":true}' --metrics
    ;;

35b)
    /usr/bin/llama-server -m ~/ai/models/Qwen3.6-35B-A3B-UD-Q4_K_M.gguf  -t 16 \
        --cache-type-k q4_0 --cache-type-v q4_0 \
        --flash-attn on --ctx-size 262144 --reasoning off --jinja \
        --batch-size 8192 --ubatch-size 2048 --no-context-shift \
        --temp 0.6 --top-p 0.95 --top-k 20 --min-p 0.00 \
        --spec-type draft-mtp --spec-draft-n-max 2  --chat-template-kwargs '{"preserve_thinking":true}' --metrics
    ;;

laptop)
    /usr/bin/llama-server \
      --model /home/alex/ai/models/Qwen3.6-35B-A3B-UD-IQ3_XXS.gguf \
      --host 0.0.0.0 \
      -t 16 \
      --ctx-size 128000 \
      --cache-type-k q8_0 \
      --cache-type-v q8_0 \
      --flash-attn on \
      --reasoning off \
      --jinja \
      --batch-size 32768 \
      --ubatch-size 2048 \
      --cont-batching \
      --no-context-shift \
      --defrag-thold 0.1
    ;;

*)
    echo "Unknown MODE '$MODE' (expected: 3.8, 27b, 35b, laptop)" >&2
    exit 1
    ;;

esac
