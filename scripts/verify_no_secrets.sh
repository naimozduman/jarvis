#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

if grep -RInE --exclude-dir=.git --exclude='*.docx' --exclude='*.pdf' --exclude='*.zip' -- \
  '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|(^|[^A-Za-z0-9_])sk-[A-Za-z0-9_-]{20,}' .; then
  echo "Potential secret material found."
  exit 1
fi

if find . -maxdepth 3 -type f \( -name '.env' -o -name '.env.production' -o -name '*.pem' -o -name '*.key' \) | grep -q .; then
  echo "Secret-shaped files found."
  exit 1
fi

echo "No obvious secret material found."
