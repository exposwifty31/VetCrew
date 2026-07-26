#!/usr/bin/env bash
set -euo pipefail
REPO="${REPO:-exposwifty31/VetCrew}"
PR="${1:?usage: check-coderabbit-approval.sh <pr-number>}"

state=$(gh api "repos/$REPO/pulls/$PR/reviews" \
  --jq '[.[] | select(.user.login=="coderabbitai[bot]")] | sort_by(.submitted_at, .id) | .[-1].state // "NONE"')
echo "CodeRabbit latest review: $state"

sha=$(gh api "repos/$REPO/pulls/$PR" --jq .head.sha)
cr_status=$(gh api "repos/$REPO/commits/$sha/status" \
  --jq '.statuses[] | select(.context=="CodeRabbit") | .state' | head -n1)
echo "CodeRabbit commit status: ${cr_status:-MISSING}"

if [[ "$state" != "APPROVED" ]]; then
  echo "FAIL: need coderabbitai[bot] APPROVED"
  exit 1
fi
if [[ "$cr_status" != "success" ]]; then
  echo "FAIL: need CodeRabbit status success"
  exit 1
fi
echo "PASS: CodeRabbit final approval gate satisfied"
