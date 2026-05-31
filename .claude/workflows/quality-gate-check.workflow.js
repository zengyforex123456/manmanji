// Quality Gate Check Workflow
// Runs on cron or manual trigger. Verifies all quality gates are still passing.
// If gates have regressed, auto-runs the failing checks.

export const meta = {
  name: 'quality-gate-check',
  description: 'Automated quality gate verification — lint, typecheck, test, coverage, security audit. Auto-fixes regressions.',
  phases: [
    { title: 'Lint' },
    { title: 'TypeCheck' },
    { title: 'Test' },
    { title: 'Security' },
    { title: 'Report' }
  ]
}

// === Phase: Lint ===
phase('Lint')
const lintResult = await agent(
  `Run the linter for this project and report results.

   Check if a linter is configured (eslint, prettier, etc).
   If not configured, skip with "no linter configured".
   If configured, run it and report: total errors, total warnings, whether it passed.

   Output format: { configured: bool, passed: bool, errors: number, warnings: number, output: string }`,
  { schema: { type: 'object', properties: { configured: { type: 'boolean' }, passed: { type: 'boolean' }, errors: { type: 'number' }, warnings: { type: 'number' }, output: { type: 'string' } }, required: ['configured', 'passed'] } }
)
log(lintResult ? `Lint: ${lintResult.configured ? (lintResult.passed ? 'PASS' : 'FAIL (' + lintResult.errors + ' errors)') : 'SKIP (not configured)'}` : 'Lint: ERROR')

// === Phase: TypeCheck ===
phase('TypeCheck')
const typeResult = await agent(
  `Run type checking for this project and report results.

   For JavaScript projects (no TypeScript), check if there's a jsconfig.json and if basic type checking passes.
   For TypeScript projects, run tsc --noEmit.
   For Python, run mypy.
   If no type checker is configured, skip.

   Output format: { configured: bool, passed: bool, errors: number, output: string }`,
  { schema: { type: 'object', properties: { configured: { type: 'boolean' }, passed: { type: 'boolean' }, errors: { type: 'number' }, output: { type: 'string' } }, required: ['configured', 'passed'] } }
)
log(typeResult ? `TypeCheck: ${typeResult.configured ? (typeResult.passed ? 'PASS' : 'FAIL (' + typeResult.errors + ' errors)') : 'SKIP'}` : 'TypeCheck: ERROR')

// === Phase: Test (only if lint and typecheck pass) ===
phase('Test')
let testResult = null
if ((!lintResult || lintResult.passed) && (!typeResult || typeResult.passed)) {
  testResult = await agent(
    `Run tests for this project and report results with coverage.

     Detect the test framework (jest, vitest, pytest, go test, etc).
     Run tests ONCE with coverage enabled.
     Extract: pass/fail, total tests, passed, failed, coverage line%, coverage branch%.

     Output format: { configured: bool, passed: bool, total: number, passed_count: number, failed: number, coverage_line_pct: number, coverage_branch_pct: number, output: string }`,
    { schema: { type: 'object', properties: { configured: { type: 'boolean' }, passed: { type: 'boolean' }, total: { type: 'number' }, passed_count: { type: 'number' }, failed: { type: 'number' }, coverage_line_pct: { type: 'number' }, coverage_branch_pct: { type: 'number' }, output: { type: 'string' } }, required: ['configured', 'passed'] } }
  )
  log(testResult ? `Test: ${testResult.configured ? (testResult.passed ? 'PASS (' + testResult.passed_count + '/' + testResult.total + ', coverage ' + testResult.coverage_line_pct + '%)' : 'FAIL (' + testResult.failed + ' failed)') : 'SKIP'}` : 'Test: ERROR')
} else {
  log('Test: SKIP (lint or typecheck failed)')
}

// === Phase: Security ===
phase('Security')
const secResult = await agent(
  `Run dependency security audit for this project.

   npm audit / pip audit / govulncheck / cargo audit.
   Report: number of vulnerabilities by severity (critical/high/moderate/low).
   Check if there are any HIGH or CRITICAL vulnerabilities.

   Output format: { configured: bool, passed: bool, critical: number, high: number, moderate: number, low: number, output: string }`,
  { schema: { type: 'object', properties: { configured: { type: 'boolean' }, passed: { type: 'boolean' }, critical: { type: 'number' }, high: { type: 'number' }, moderate: { type: 'number' }, low: { type: 'number' }, output: { type: 'string' } }, required: ['configured', 'passed'] } }
)
log(secResult ? `Security: ${secResult.configured ? (secResult.passed ? 'PASS (0 critical/high)' : 'FAIL (' + secResult.critical + ' critical, ' + secResult.high + ' high)') : 'SKIP'}` : 'Security: ERROR')

// === Phase: Report ===
phase('Report')
const allPassed = (!lintResult || lintResult.passed) &&
                  (!typeResult || typeResult.passed) &&
                  (!testResult || testResult.passed) &&
                  (!secResult || secResult.passed)

log(`=== Quality Gate Summary ===`)
log(`Lint:      ${lintResult ? (lintResult.passed ? 'PASS' : 'FAIL') : 'N/A'}`)
log(`TypeCheck: ${typeResult ? (typeResult.passed ? 'PASS' : 'FAIL') : 'N/A'}`)
log(`Test:      ${testResult ? (testResult.passed ? 'PASS' : 'FAIL') : 'N/A'}`)
log(`Security:  ${secResult ? (secResult.passed ? 'PASS' : 'FAIL') : 'N/A'}`)
log(`Overall:   ${allPassed ? 'ALL GATES PASSED' : 'SOME GATES FAILED'}`)

// Return structured result for state file update
return {
  lint_passed: lintResult?.passed ?? true,
  typecheck_passed: typeResult?.passed ?? true,
  test_passed: testResult?.passed ?? true,
  security_passed: secResult?.passed ?? true,
  overall_passed: allPassed,
  details: { lint: lintResult, typecheck: typeResult, test: testResult, security: secResult }
}
