// Auto-Fix Loop — Detect → Fix → Test → Knowledge
// Antigravity closed loop: acts on hints, auto-fixes, verifies, accumulates patterns.

export const meta = {
  name: 'auto-fix-loop',
  description: 'Automated detect-fix-test-knowledge loop. Reads PostWrite hints, applies fixes, verifies, saves patterns to memory.',
  phases: [
    { title: 'Detect' },
    { title: 'Fix' },
    { title: 'Verify' },
    { title: 'Learn' }
  ]
}

// ================================================================
// Phase: Detect — scan project for fixable issues
// ================================================================
phase('Detect')

const findings = await agent(
  `Scan the current project for fixable code quality issues. Focus on:

  1. **Security**: innerHTML with unsanitized data, eval(), hardcoded credentials
  2. **UI/UX**: touch targets < 44px, contrast < 4.5:1, font-size < 16px without scaling
  3. **Code quality**: functions > 50 lines, nesting > 3 levels, duplicate code
  4. **Performance**: missing lazy loading, unoptimized loops

  For each finding, report: file, line, severity (critical/high/medium/low), description (≤30 chars), and whether it can be auto-fixed.

  Return: { issues: Array<{ file: string, line: number, severity: string, description: string, auto_fixable: boolean }> }`,
  {
    schema: {
      type: 'object',
      properties: {
        issues: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              file: { type: 'string' },
              line: { type: 'number' },
              severity: { type: 'string' },
              description: { type: 'string' },
              auto_fixable: { type: 'boolean' }
            },
            required: ['file', 'severity', 'description', 'auto_fixable']
          }
        }
      },
      required: ['issues']
    }
  }
)

const issues = findings?.issues || []
const autoFixable = issues.filter(i => i.auto_fixable)
const manualReview = issues.filter(i => !i.auto_fixable)

log(`Found ${issues.length} issues: ${autoFixable.length} auto-fixable, ${manualReview.length} need manual review`)

if (manualReview.length > 0) {
  log('Manual review needed:')
  manualReview.forEach(i => log(`  [${i.severity}] ${i.file}:${i.line} — ${i.description}`))
}

// ================================================================
// Phase: Fix — auto-fix each fixable issue
// ================================================================
phase('Fix')

let fixResults = []
if (autoFixable.length > 0) {
  fixResults = await pipeline(
    autoFixable,
    async (issue) => {
      log(`Fixing: ${issue.file}:${issue.line} — ${issue.description}`)
      const result = await agent(
        `Fix this issue in the codebase:

         File: ${issue.file}
         Line: ${issue.line}
         Issue: ${issue.description}
         Severity: ${issue.severity}

         Rules:
         1. Make the MINIMAL change — only what's needed to fix this specific issue
         2. Do NOT refactor surrounding code
         3. Do NOT introduce new features
         4. Use the Edit tool (not Write) to change only the relevant lines
         5. If the fix is ambiguous or risky, report it as "skipped" with reason

         Return: { fixed: bool, file: string, description: string, change_summary: string, skipped_reason: string }`,
        {
          phase: 'Fix',
          schema: {
            type: 'object',
            properties: {
              fixed: { type: 'boolean' },
              file: { type: 'string' },
              description: { type: 'string' },
              change_summary: { type: 'string' },
              skipped_reason: { type: 'string' }
            },
            required: ['fixed', 'description']
          }
        }
      )
      return result
    }
  )

  const fixed = fixResults.filter(Boolean).filter(r => r.fixed)
  const skipped = fixResults.filter(Boolean).filter(r => !r.fixed)
  log(`Fixed: ${fixed.length}, Skipped: ${skipped.length}`)
} else {
  log('No auto-fixable issues found.')
}

// ================================================================
// Phase: Verify — run quality gate check on fixed files
// ================================================================
phase('Verify')

const fixedFiles = fixResults
  .filter(Boolean)
  .filter(r => r.fixed)
  .map(r => r.file)
  .filter((v, i, a) => a.indexOf(v) === i) // unique

if (fixedFiles.length > 0) {
  log(`Verifying ${fixedFiles.length} fixed files: ${fixedFiles.join(', ')}`)

  const verifyResult = await agent(
    `Verify the fixes applied to these files: ${fixedFiles.join(', ')}

    1. Check that each fix correctly addresses the reported issue
    2. Check that no regressions were introduced
    3. Run relevant tests if available
    4. Report whether the fixes are verified

    Return: { verified: bool, regressions: string[], summary: string }`,
    {
      phase: 'Verify',
      schema: {
        type: 'object',
        properties: {
          verified: { type: 'boolean' },
          regressions: { type: 'array', items: { type: 'string' } },
          summary: { type: 'string' }
        },
        required: ['verified']
      }
    }
  )

  log(`Verification: ${verifyResult?.verified ? 'PASS' : 'REGRESSIONS FOUND'}`)
  if (verifyResult?.regressions?.length > 0) {
    verifyResult.regressions.forEach(r => log(`  ! ${r}`))
  }
} else {
  log('Verify: SKIP (no files were fixed)')
}

// ================================================================
// Phase: Learn — save fix patterns to memory
// ================================================================
phase('Learn')

const fixedIssues = fixResults.filter(Boolean).filter(r => r.fixed)
if (fixedIssues.length > 0) {
  const patterns = fixedIssues.map(r =>
    `- **${r.description}**: ${r.change_summary || 'fixed'}`
  ).join('\n')

  const learnResult = await agent(
    `Save these fix patterns to the project memory system.

     Fixed in this session:
     ${patterns}

     For each unique fix pattern, write a memory file to:
     C:\\Users\\Administrator\\.claude\\projects\\D--project-kaoshi\\memory\\

     Format:
     ---
     name: <slug>
     description: <one-line summary>
     metadata:
       type: feedback
       auto_generated: true
     ---
     # <title>
     **Detection pattern**: <how to detect this issue>
     **Fix**: <the fix applied>
     **Verification**: <how to verify fix worked>

     Then update MEMORY.md to include the new entries.

     Return: { memories_created: number, patterns: string[] }`,
    {
      phase: 'Learn',
      schema: {
        type: 'object',
        properties: {
          memories_created: { type: 'number' },
          patterns: { type: 'array', items: { type: 'string' } }
        },
        required: ['memories_created']
      }
    }
  )

  log(`Knowledge accumulated: ${learnResult?.memories_created || 0} new memory entries`)
} else {
  log('Learn: SKIP (no fixes to learn from)')
}

return {
  detected: issues.length,
  auto_fixable: autoFixable.length,
  fixed: fixedIssues.length,
  skipped: fixResults.filter(Boolean).filter(r => !r.fixed).length,
  verified: true,
  memories: learnResult?.memories_created || 0
}
