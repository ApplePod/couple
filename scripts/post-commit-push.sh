#!/bin/sh
# 커밋 직후 origin으로 자동 푸시 (네트워크 실패 시 커밋은 유지)
branch=$(git symbolic-ref --short HEAD 2>/dev/null) || exit 0
git push origin "$branch" 2>&1
