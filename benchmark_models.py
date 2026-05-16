#!/usr/bin/env python3

import csv
import glob
import json
import os
import signal
import subprocess
import sys
import time
from pathlib import Path

import requests

# =========================
# CONFIG
# =========================

LLAMA_SERVER = "./llama-server"
HOST = "127.0.0.1"
PORT = 8080

CTX = 64000
THREADS = os.cpu_count() or 8
GPU_LAYERS = 20

N_PREDICT = 256

PROMPT = (
    "Write a detailed explanation of how a CPU cache works, "
    "including L1, L2, L3, cache misses, and prefetching."
)

MODEL_DIR = "models"
MODEL_GLOB = os.path.join(MODEL_DIR, "*.gguf")

CSV_OUTPUT = "benchmark_results.csv"

SERVER_TIMEOUT = 300

# Extra llama-server args
EXTRA_ARGS = [
    "--no-webui",
    "--metrics",
]

# =========================


def wait_for_server(timeout=SERVER_TIMEOUT):
    start = time.time()

    while time.time() - start < timeout:
        try:
            r = requests.get(f"http://{HOST}:{PORT}/health", timeout=2)
            if r.status_code == 200:
                return True
        except Exception:
            pass

        time.sleep(1)

    return False



def benchmark_model(model_path):
    model_name = Path(model_path).name

    print(f"\n=== Benchmarking: {model_name} ===")

    cmd = [
        LLAMA_SERVER,
        "-m",
        model_path,
        "--host",
        HOST,
        "--port",
        str(PORT),
        "-c",
        str(CTX),
        *EXTRA_ARGS,
    ]

    print("Starting llama-server...")

    server = subprocess.Popen(
        cmd,
        stdout=sys.stdout,
        stderr=sys.stderr,
        text=True,
    )

    try:
        if not wait_for_server():
            raise RuntimeError("Server failed to start")

        print("Server ready")

        url = f"http://{HOST}:{PORT}/v1/chat/completions"

        payload = {
            "model": "local",
            "messages": [
                {
                    "role": "user",
                    "content": PROMPT,
                }
            ],
            "max_tokens": N_PREDICT,
            "temperature": 0,
            "stream": True,
        }

        headers = {
            "Content-Type": "application/json",
        }

        start_time = time.time()
        first_token_time = None
        generated_text = ""
        token_count = 0

        with requests.post(
            url,
            headers=headers,
            json=payload,
            stream=True,
            timeout=600,
        ) as r:

            r.raise_for_status()

            for line in r.iter_lines():
                if not line:
                    continue

                line = line.decode("utf-8")

                if not line.startswith("data: "):
                    continue

                data = line[6:]

                if data == "[DONE]":
                    break

                try:
                    obj = json.loads(data)
                except Exception:
                    continue

                choices = obj.get("choices", [])
                if not choices:
                    continue

                delta = choices[0].get("delta", {})

                # Increment for every token chunk, even if content is empty
                # (e.g., role transitions or whitespace-only chunks)
                token_count += 1

                if first_token_time is None:
                    first_token_time = time.time()

                content = delta.get("content", "")
                if content:
                    generated_text += content

        end_time = time.time()

        total_time = end_time - start_time

        if first_token_time:
            ttft = first_token_time - start_time
            generation_time = end_time - first_token_time
        else:
            ttft = -1
            generation_time = total_time

        toks_per_sec = (
            token_count / generation_time
            if generation_time > 0
            else 0
        )

        result = {
            "model": model_name,
            "tokens_generated": token_count,
            "tokens_per_sec": round(toks_per_sec, 2),
            "ttft_sec": round(ttft, 2),
            "total_time_sec": round(total_time, 2),
            "ctx": CTX,
            "gpu_layers": GPU_LAYERS,
            "threads": THREADS,
        }

        print(json.dumps(result, indent=2))

        return result

    finally:
        print("Stopping llama-server...")

        try:
            server.send_signal(signal.SIGINT)
            server.wait(timeout=20)
        except Exception:
            server.kill()

        time.sleep(3)



def main():
    models = sorted(glob.glob(MODEL_GLOB))

    if not models:
        print("No GGUF models found")
        sys.exit(1)

    print(f"Found {len(models)} models")

    results = []

    for model in models:
        try:
            result = benchmark_model(model)
            results.append(result)

        except KeyboardInterrupt:
            print("Interrupted")
            break

        except Exception as e:
            print(f"ERROR benchmarking {model}: {e}")

    if results:
        with open(CSV_OUTPUT, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=results[0].keys())
            writer.writeheader()
            writer.writerows(results)

        print(f"\nSaved results to {CSV_OUTPUT}")

        print("\n=== SORTED BY TOKENS/SEC ===")

        sorted_results = sorted(
            results,
            key=lambda x: x["tokens_per_sec"],
            reverse=True,
        )

        for r in sorted_results:
            print(
                f"{r['model']:<50} "
                f"{r['tokens_per_sec']:>8} tok/s   "
                f"TTFT: {r['ttft_sec']:>6}s"
            )


if __name__ == "__main__":
    main()
