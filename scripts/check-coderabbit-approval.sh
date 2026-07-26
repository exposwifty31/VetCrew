#!/usr/bin/env bash
set -euo pipefail
REPO="${REPO:-exposwifty31/VetCrew}"
PR="${1:?usage: check-coderabbit-approval.sh <pr-number>}"

sha=$(gh api "repos/$REPO/pulls/$PR" --jq .head.sha)

# Prefer the latest CodeRabbit review *on the current head SHA*.
# A later COMMENTED on an old commit must not override APPROVED on head
# (force-push / rebase leaves stale reviews in the timeline).
latest=$(
  gh api --paginate "repos/$REPO/pulls/$PR/reviews" --jq '.[]' \
    | jq -s --arg sha "$sha" '
        [.[] | select(.user.login=="coderabbitai[bot]" and .commit_id==$sha)]
        | sort_by(.submitted_at, .id)
        | .[-1] // empty
      '
)

if [[ -z "$latest" || "$latest" == "null" ]]; then
  echo "CodeRabbit latest review on head: NONE"
  echo "PR head SHA: $sha"
  echo "FAIL: need coderabbitai[bot] APPROVED on current head"
  exit 1
fi

state=$(jq -r '.state // "NONE"' <<<"$latest")
review_sha=$(jq -r '.commit_id // ""' <<<"$latest")
echo "CodeRabbit latest review on head: $state (commit $review_sha)"
echo "PR head SHA: $sha"

cr_status=$(gh api "repos/$REPO/commits/$sha/status" \
  --jq '.statuses[] | select(.context=="CodeRabbit") | .state' | head -n1)
echo "CodeRabbit commit status: ${cr_status:-MISSING}"

if [[ "$state" != "APPROVED" ]]; then
  echo "FAIL: need coderabbitai[bot] APPROVED on current head (got $state)"
  exit 1
fi
if [[ "$cr_status" != "success" ]]; then
  echo "FAIL: need CodeRabbit status success"
  exit 1
fi
echo "PASS: CodeRabbit final approval gate satisfied"
