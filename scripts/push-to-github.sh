#!/usr/bin/env bash
set -euo pipefail

# Kullanım:
#   GITHUB_REPO_URL=https://github.com/kullanici/depo.git ./scripts/push-to-github.sh
# veya mevcut origin tanımlıysa:
#   ./scripts/push-to-github.sh

REPO_URL="${GITHUB_REPO_URL:-}"
BRANCH="${GITHUB_BRANCH:-main}"
COMMIT_MESSAGE="${GITHUB_COMMIT_MESSAGE:-Improve favorites persistence and daily trade confirmations}"

if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
  echo "Hata: Scripti Git deposunun kök dizininde çalıştırın." >&2
  exit 1
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  if [[ -z "$REPO_URL" ]]; then
    echo "Hata: origin tanımlı değil. GITHUB_REPO_URL değişkenini verin." >&2
    echo "Örnek: GITHUB_REPO_URL=https://github.com/kullanici/depo.git ./scripts/push-to-github.sh" >&2
    exit 1
  fi
  git remote add origin "$REPO_URL"
elif [[ -n "$REPO_URL" ]]; then
  git remote set-url origin "$REPO_URL"
fi

git add -A
if ! git diff --cached --quiet; then
  git commit -m "$COMMIT_MESSAGE"
else
  echo "Yeni commit edilecek değişiklik yok."
fi

git branch -M "$BRANCH"
git push -u origin "$BRANCH"

echo "GitHub push tamamlandı: $(git remote get-url origin) [$BRANCH]"
