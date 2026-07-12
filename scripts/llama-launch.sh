#!/usr/bin/env bash
/usr/bin/llama-server \
  --model /home/alex/ai/models/Qwen3.6-35B-A3B-UD-IQ3_S.gguf \
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
  --defrag-thold 0.1 || true