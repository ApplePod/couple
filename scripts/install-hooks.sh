#!/bin/sh
set -e
root=$(cd "$(dirname "$0")/.." && pwd)
git_dir=$(git -C "$root" rev-parse --git-dir)
cp "$root/scripts/post-commit-push.sh" "$git_dir/hooks/post-commit"
chmod +x "$git_dir/hooks/post-commit"
echo "Installed post-commit hook → auto push to origin"
