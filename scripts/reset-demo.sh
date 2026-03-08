#!/usr/bin/env bash
set -euo pipefail

REPO="zm-devin-playground/personal-budget"
REGRESSION_FILE="packages/loot-core/src/server/budget/envelope.ts"

echo "=== Demo Reset for $REPO ==="
echo ""

# -------------------------------------------------------
# 1. Ensure the regression is present on master
# -------------------------------------------------------
echo "[1/5] Checking regression on master..."
git fetch origin master
git checkout master
git pull origin master

# Check if the regression is present (missing negation in total-budgeted)
# The regression line should have "return sumAmounts" WITHOUT a leading minus sign
# The correct code has "return -sumAmounts"
if grep -q 'return sumAmounts(\.\.\.' "$REGRESSION_FILE" && ! grep -q 'return -sumAmounts(\.\.\.' "$REGRESSION_FILE"; then
  echo "  Regression is present (missing negation). OK."
else
  echo "  Regression is missing — Devin's fix was merged. Reverting..."
  # Find the most recent commit that touched the total-budgeted calculation
  FIX_COMMIT=$(git log --oneline -1 --format='%H' -- "$REGRESSION_FILE")
  if [ -n "$FIX_COMMIT" ]; then
    git revert --no-edit "$FIX_COMMIT"
    git push origin master
    echo "  Reverted commit $FIX_COMMIT and pushed."
  else
    echo "  ERROR: Could not find a commit to revert. Manually restore the regression."
    exit 1
  fi
fi

# -------------------------------------------------------
# 2. Close and delete Devin's fix PR branches
# -------------------------------------------------------
echo ""
echo "[2/5] Closing Devin's fix PRs..."
PR_NUMBERS=$(gh pr list --repo "$REPO" --state open --json number --jq '.[].number' 2>/dev/null || echo "")
if [ -n "$PR_NUMBERS" ]; then
  for PR in $PR_NUMBERS; do
    TITLE=$(gh pr view "$PR" --repo "$REPO" --json title --jq '.title')
    echo "  Closing PR #$PR: $TITLE"
    gh pr close "$PR" --repo "$REPO" --delete-branch 2>/dev/null || true
  done
else
  echo "  No open PRs found."
fi

# -------------------------------------------------------
# 3. Reopen demo issues and clean up comments
# -------------------------------------------------------
echo ""
echo "[3/5] Reopening demo issues and cleaning bot comments..."
ISSUES=$(gh issue list --repo "$REPO" --label "devin-triage" --state all --json number,state --jq '.[] | "\(.number) \(.state)"')
if [ -n "$ISSUES" ]; then
  while IFS=' ' read -r ISSUE_NUM ISSUE_STATE; do
    echo "  Processing issue #$ISSUE_NUM (state: $ISSUE_STATE)..."
    
    # Reopen if closed
    if [ "$ISSUE_STATE" = "CLOSED" ]; then
      gh issue reopen "$ISSUE_NUM" --repo "$REPO"
      echo "    Reopened."
    fi

    # Remove bot/Devin comments (keep original issue body)
    COMMENT_IDS=$(gh api "repos/$REPO/issues/$ISSUE_NUM/comments" --jq '.[] | select(.body | test("Devin|triage|Session|session")) | .id')
    if [ -n "$COMMENT_IDS" ]; then
      for CID in $COMMENT_IDS; do
        gh api --method DELETE "repos/$REPO/issues/comments/$CID" 2>/dev/null || true
        echo "    Deleted comment $CID"
      done
    fi

    # Re-apply devin-triage label (in case it was removed)
    gh issue edit "$ISSUE_NUM" --repo "$REPO" --add-label "devin-triage" 2>/dev/null || true
  done <<< "$ISSUES"
else
  echo "  No issues with devin-triage label found."
fi

# -------------------------------------------------------
# 4. Remove the devin-triage label from issues
#    (so we can re-apply it live during the demo to trigger the workflow)
# -------------------------------------------------------
echo ""
echo "[4/5] Removing devin-triage label so it can be re-applied live..."
OPEN_ISSUES=$(gh issue list --repo "$REPO" --label "devin-triage" --state open --json number --jq '.[].number')
if [ -n "$OPEN_ISSUES" ]; then
  for ISSUE_NUM in $OPEN_ISSUES; do
    gh issue edit "$ISSUE_NUM" --repo "$REPO" --remove-label "devin-triage" 2>/dev/null || true
    echo "  Removed label from issue #$ISSUE_NUM"
  done
fi

# -------------------------------------------------------
# 5. Summary
# -------------------------------------------------------
echo ""
echo "[5/5] Reset complete. State:"
echo "  - Regression present on master: YES"
echo "  - Fix PRs closed and branches deleted"
echo "  - Demo issues reopened, bot comments removed, labels stripped"
echo ""
echo "Ready for demo. During the video:"
echo "  1. Show the bug in the app"
echo "  2. Add 'devin-triage' label to Issue 1 to trigger the workflow"
echo "  3. Watch Devin triage -> Slack -> YES -> fix -> PR"
echo ""
echo "Manual steps remaining:"
echo "  - Clear #devin-issues Slack channel (delete old messages or use a fresh channel)"
echo "  - Archive old Devin sessions at app.devin.ai if desired"
