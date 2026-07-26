#!/usr/bin/env bash
/usr/bin/llama-server -m ~/ai/models/Qwen3.6-35B-A3B-UD-Q4_K_M.gguf  -t 16 \
    --cache-type-k q4_0 --cache-type-v q4_0 \
    --flash-attn on --ctx-size 262144 --reasoning off --jinja \
    --batch-size 8192 --ubatch-size 2048 --no-context-shift \
    --temp 0.6 --top-p 0.95 --top-k 20 --min-p 0.00 \
    --spec-type draft-mtp --spec-draft-n-max 2  --chat-template-kwargs '{"preserve_thinking":true}' --metrics
