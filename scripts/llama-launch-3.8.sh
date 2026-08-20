#!/usr/bin/env bash
/usr/bin/llama-server -m ~/ai/models/Qwen3.8-27B-UD-IQ3_S.gguf \
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
                                                                  --temp 0.6 --top-p 0.95 --top-k 20 --min-p 0.00 --spec-type draft-mtp --spec-draft-n-max 2 --chat-template-kwargs '{"reasoning_effort":"medium"}' --metrics  
   
