#!/usr/bin/env bash
set -euo pipefail
REPO="${REPO:-exposwifty31/VetCrew}"
PR="${1:?usage: check-coderabbit-approval.sh <pr-number>}"

sha=$(gh api "repos/$REPO/pulls/$PR" --jq .head.sha)

# Paginate all reviews (gh api without --paginate only returns the first page),
# then select the latest CodeRabbit review across every page.
latest=$(
  gh api --paginate "repos/$REPO/pulls/$PR/reviews" --jq '.[]' \
    | jq -s '[.[] | select(.user.login=="coderabbitai[bot]")] | sort_by(.submitted_at, .id) | .[-1] // empty'
)

if [[ -z "$latest" || "$latest" == "null" ]]; then
  echo "CodeRabbit latest review: NONE"
  echo "FAIL: need coderabbitai[bot] APPROVED on current head"
  exit 1
fi

state=$(jq -r '.state // "NONE"' <<<"$latest")
review_sha=$(jq -r '.commit_id // ""' <<<"$latest")
echo "CodeRabbit latest review: $state (commit $review_sha)"
echo "PR head SHA: $sha"

cr_status=$(gh api "repos/$REPO/commits/$sha/status" \
  --jq '.statuses[] | select(.context=="CodeRabbit") | .state' | head -n1)
echo "CodeRabbit commit status: ${cr_status:-MISSING}"

if [[ "$state" != "APPROVED" ]]; then
  echo "FAIL: need coderabbitai[bot] APPROVED"
  exit 1
fi
if [[ "$review_sha" != "$sha" ]]; then
  echo "FAIL: latest CodeRabbit approval is for $review_sha, not current head $sha"
  exit 1
fi
if [[ "$cr_status" != "success" ]]; then
  echo "FAIL: need CodeRabbit status success"
  exit 1
fi
echo "PASS: CodeRabbit final approval gate satisfied"
