#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
if ! command -v cargo >/dev/null 2>&1; then
  echo "Rust/Cargo is missing. Install Rust from https://rustup.rs/" >&2
  exit 1
fi
if ! cargo tauri --version >/dev/null 2>&1; then
  echo "Tauri CLI v2 is missing. Install it with: cargo install tauri-cli --version '^2.0'" >&2
  exit 1
fi
cargo tauri build --config src-tauri/tauri.conf.json
printf '\nBuild command completed. Check src-tauri/target/release/bundle/ for generated packages.\n'
