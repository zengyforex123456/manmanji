// Pre-Commit Verification Workflow
// Triggered before git commit. Runs lint + test. Blocks commit if either fails.

export const meta = {
  name: 'pre-commit-verify',
  description: 'Pre-commit gate: lint + test must pass. Returns PASS/FAIL with details.',
  phases: [
    { title: 'Verify' },
    { title: 'Verdict' }
  ]
}

// === Phase: Verify - parallel lint and test ===
phase('Verify')

const checks = await parallel([
  // Lint check
  async () => {
    return await agent(
      `Run the linter for this project. Report ONLY: { passed: bool, errors: number, warnings: number, framework: string }.
       If no linter is configured, return { passed: true, errors: 0, warnings: 0, framework: "none" }.`,
      { schema: { type: 'object', properties: { passed: { type: 'boolean' }, errors: { type: 'number' }, warnings: { type: 'number' }, framework: { type: 'string' } }, required: ['passed'] } }
    )
  },

  // Test check
  async () => {
    return await agent(
      `Run tests for this project ONCE. Report ONLY: { passed: bool, total: number, failed: number, coverage_pct: number, framework: string }.
       If no tests exist, return { passed: true, total: 0, failed: 0, coverage_pct: 0, framework: "none" }.
       Do NOT re-run tests if they fail. Just report the result.`,
      { schema: { type: 'object', properties: { passed: { type: 'boolean' }, total: { type: 'number' }, failed: { type: 'number' }, coverage_pct: { type: 'number' }, framework: { type: 'string' } }, required: ['passed'] } }
    )
  },

  // Modified files check
  async () => {
    return await agent(
      `Check git status for this project. Report: { has_changes: bool, modified_count: number, untracked_count: number, files_summary: string (list of changed files, max 10) }.`,
      { schema: { type: 'object', properties: { has_changes: { type: 'boolean' }, modified_count: { type: 'number' }, untracked_count: { type: 'number' }, files_summary: { type: 'string' } }, required: ['has_changes'] } }
    )
  }
])

const [lint, test, git] = checks.filter(Boolean)
log(`Lint:  ${lint?.passed ? 'PASS' : 'FAIL'} (${lint?.framework ?? '?'})`)
log(`Test:  ${test?.passed ? 'PASS' : 'FAIL'} (${test?.framework ?? '?'})`)
log(`Files: ${git?.modified_count ?? 0} modified, ${git?.untracked_count ?? 0} untracked`)

// === Phase: Verdict ===
phase('Verdict')

const pass = (lint?.passed ?? true) && (test?.passed ?? true)

if (pass) {
  log('=== VERDICT: PASS — safe to commit ===')
} else {
  const reasons = []
  if (lint && !lint.passed) reasons.push(`lint: ${lint.errors} errors`)
  if (test && !test.passed) reasons.push(`test: ${test.failed}/${test.total} failed`)
  log(`=== VERDICT: FAIL — ${reasons.join(', ')} ===`)
}

return {
  passed: pass,
  lint: lint,
  test: test,
  git: git,
  reasons: pass ? [] : [
    ...(lint && !lint.passed ? [`Lint: ${lint.errors} errors`] : []),
    ...(test && !test.passed ? [`Test: ${test.failed}/${test.total} failed`] : [])
  ]
}
