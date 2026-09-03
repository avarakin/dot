#!/usr/bin/env bash
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

#    --no-kv-offload 

#   --spec-draft-type-k q4_0 --spec-draft-type-v q4_0 \

#    --verbose 2>&1 
#| grep -E 'ctx|context|slot|parallel|n_ctx|n_slots'

