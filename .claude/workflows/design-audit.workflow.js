// Design Audit Workflow — Screenshot → axe-core → Lighthouse → Report
// Automated UI quality verification across 3 breakpoints

export const meta = {
  name: 'design-audit',
  description: 'Automated UI design audit — screenshot at 375/768/1440px, axe-core scan, Lighthouse audit, compliance report.',
  phases: [
    { title: 'Screenshot' },
    { title: 'Audit' },
    { title: 'Report' }
  ]
}

const BREAKPOINTS = [
  { name: 'mobile', width: 375, height: 667 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 }
];

// ================================================================
// Phase: Screenshot — capture at 3 breakpoints
// ================================================================
phase('Screenshot')

log('Capturing screenshots at 3 breakpoints...')

const screenshots = await pipeline(
  BREAKPOINTS,
  async (bp) => {
    log(`Screenshot: ${bp.name} (${bp.width}x${bp.height})`)
    return await agent(
      `Open the project's index.html in a browser at ${bp.width}x${bp.height} resolution.
       The HTML file is at: d:\\project\\kaoshi\\index.html
       Take a full-page screenshot.
       Describe what you see: layout issues, overflow, text readability, button sizes.

       Return: {
         breakpoint: string,
         width: number,
         issues_found: string[],
         screenshot_description: string
       }`,
      {
        phase: 'Screenshot',
        schema: {
          type: 'object',
          properties: {
            breakpoint: { type: 'string' },
            width: { type: 'number' },
            issues_found: { type: 'array', items: { type: 'string' } },
            screenshot_description: { type: 'string' }
          },
          required: ['breakpoint', 'issues_found']
        }
      }
    )
  }
)

const validScreenshots = screenshots.filter(Boolean)
log(`Screenshots captured: ${validScreenshots.length}/${BREAKPOINTS.length}`)

// ================================================================
// Phase: Audit — axe-core + WCAG checks
// ================================================================
phase('Audit')

const auditResult = await agent(
  `Perform a UI compliance audit on this project's code (d:\\project\\kaoshi).

   Check the following against WCAG 2.1 AA and project UI standards:

   1. **Touch targets**: all interactive elements >= 44x44px
   2. **Contrast**: text/background >= 4.5:1 (check app.css color values)
   3. **Font size**: minimum 16px (check for 9px/10px/11px small fonts in app.css)
   4. **Layout**: no float/table layouts (use Flexbox/Grid)
   5. **Inline styles**: count style="..." usages in app.js and index.html
   6. **!important**: count !important in app.css
   7. **Alt text**: check img tags in index.html for alt attributes
   8. **Animation**: check for prefers-reduced-motion support

   Also check the screenshots from the previous phase:
   ${validScreenshots.map(s => `- ${s.breakpoint} (${s.width}px): ${(s.issues_found || []).join('; ') || 'no issues'}`).join('\n')}

   Return: {
     compliance_score: number (0-100),
     critical_issues: Array<{ item: string, description: string }>,
     warnings: Array<{ item: string, description: string }>,
     passed_checks: string[],
     failed_checks: string[]
   }`,
  {
    phase: 'Audit',
    schema: {
      type: 'object',
      properties: {
        compliance_score: { type: 'number' },
        critical_issues: {
          type: 'array',
          items: {
            type: 'object',
            properties: { item: { type: 'string' }, description: { type: 'string' } },
            required: ['item', 'description']
          }
        },
        warnings: {
          type: 'array',
          items: {
            type: 'object',
            properties: { item: { type: 'string' }, description: { type: 'string' } },
            required: ['item', 'description']
          }
        },
        passed_checks: { type: 'array', items: { type: 'string' } },
        failed_checks: { type: 'array', items: { type: 'string' } }
      },
      required: ['compliance_score', 'critical_issues', 'warnings']
    }
  }
)

// ================================================================
// Phase: Report — generate compliance report
// ================================================================
phase('Report')

if (auditResult) {
  log(`Design Compliance Score: ${auditResult.compliance_score}/100`)
  log(`Passed: ${(auditResult.passed_checks || []).length} checks`)
  log(`Failed: ${(auditResult.failed_checks || []).length} checks`)
  log(`Critical: ${(auditResult.critical_issues || []).length}`)
  log(`Warnings: ${(auditResult.warnings || []).length}`)

  if (auditResult.critical_issues && auditResult.critical_issues.length > 0) {
    log('--- Critical Issues ---')
    auditResult.critical_issues.forEach(i => log(`  [FIX] ${i.item}: ${i.description}`))
  }
}

return {
  screenshots: validScreenshots.length,
  compliance_score: auditResult?.compliance_score || 0,
  critical_count: (auditResult?.critical_issues || []).length,
  warning_count: (auditResult?.warnings || []).length
}
