// Decision Workflow — Gather → Evaluate → Decide → Recommend
// The decision layer: reads all execution-layer outputs, produces Go/No-Go judgment.

export const meta = {
  name: 'decide',
  description: 'SDLC decision layer — reads gate data, CI reports, git history, and memory to produce Go/No-Go + risk score + action plan.',
  phases: [
    { title: 'Gather' },
    { title: 'Evaluate' },
    { title: 'Decide' },
    { title: 'Recommend' }
  ]
}

// ================================================================
// Phase: Gather — collect all data sources
// ================================================================
phase('Gather')

const dataSources = await parallel([
  // Gate status from project-state.json
  async () => {
    return await agent(
      `Read .claude/project-state.json and return the current state.
       Return: { phase: string, gates: { P1: object, P2: object, P3: object, P4: object, P5: object }, phase_history: array }`,
      { schema: { type: 'object', properties: { phase: { type: 'string' }, gates: { type: 'object' }, phase_history: { type: 'array', items: { type: 'string' } } }, required: ['phase', 'gates'] } }
    )
  },

  // Recent git history
  async () => {
    return await agent(
      `Run "git log --oneline -15" and "git diff --stat HEAD~3" to understand recent changes.
       Return: { commits: array, files_changed: array, has_uncommitted: bool }`,
      { schema: { type: 'object', properties: { commits: { type: 'array', items: { type: 'string' } }, files_changed: { type: 'array', items: { type: 'string' } }, has_uncommitted: { type: 'boolean' } }, required: ['has_uncommitted'] } }
    )
  },

  // Memory patterns
  async () => {
    return await agent(
      `Read the project memory index and recent memory entries.
       Look for: known error patterns, fix patterns, historical decisions.
       Return: { patterns_found: array, recent_issues: array, fix_templates: array }`,
      { schema: { type: 'object', properties: { patterns_found: { type: 'array', items: { type: 'string' } }, recent_issues: { type: 'array', items: { type: 'string' } }, fix_templates: { type: 'array', items: { type: 'string' } } }, required: ['patterns_found'] } }
    )
  }
])

const [gateData, gitData, memoryData] = dataSources.filter(Boolean)

log(`Phase: ${gateData?.phase || '?'}`)
log(`Commits: ${gitData?.commits?.length || 0} recent`)
log(`Memory patterns: ${memoryData?.patterns_found?.length || 0}`)

// ================================================================
// Phase: Evaluate — score each dimension
// ================================================================
phase('Evaluate')

const evaluation = await agent(
  `Evaluate the following data from the execution layer and produce a scored assessment.

  GATE DATA:
  ${JSON.stringify(gateData, null, 2)}

  GIT DATA:
  ${JSON.stringify(gitData, null, 2)}

  MEMORY DATA:
  ${JSON.stringify(memoryData, null, 2)}

  Score each dimension from 0-100:

  1. **Code Quality** (P2 gates: lint, typecheck, build, security)
     - All PASS → 100
     - Some SKIP (not configured) → 80
     - One FAIL → 50
     - Multiple FAIL → 20

  2. **Test Coverage** (P3 gates: unit test, coverage, UI test, a11y)
     - All PASS or coverage > 80% → 100
     - Some SKIP → 70
     - Coverage < 80% → 40
     - Tests failing → 10

  3. **Code Review** (P4 gates: review, PRD trace, integration)
     - All PASS → 100
     - Review not done → 50

  4. **Change Risk** (from git history)
     - < 5 files changed → low risk (90)
     - 5-15 files → medium risk (60)
     - > 15 files → high risk (30)
     - Has uncommitted changes → -20

  5. **Historical Safety** (from memory)
     - No known error patterns → 100
     - Known patterns exist but fixed → 70
     - Known patterns exist, unresolved → 30

  Return: {
    scores: { code_quality: number, test_coverage: number, code_review: number, change_risk: number, historical_safety: number },
    overall_score: number,
    blocking_issues: string[],
    warnings: string[]
  }`,
  {
    phase: 'Evaluate',
    schema: {
      type: 'object',
      properties: {
        scores: {
          type: 'object',
          properties: {
            code_quality: { type: 'number' },
            test_coverage: { type: 'number' },
            code_review: { type: 'number' },
            change_risk: { type: 'number' },
            historical_safety: { type: 'number' }
          },
          required: ['code_quality', 'test_coverage', 'code_review', 'change_risk', 'historical_safety']
        },
        overall_score: { type: 'number' },
        blocking_issues: { type: 'array', items: { type: 'string' } },
        warnings: { type: 'array', items: { type: 'string' } }
      },
      required: ['scores', 'overall_score', 'blocking_issues', 'warnings']
    }
  }
)

const ev = evaluation
if (ev) {
  log(`Scores: Quality=${ev.scores.code_quality} Test=${ev.scores.test_coverage} Review=${ev.scores.code_review} Risk=${ev.scores.change_risk} History=${ev.scores.historical_safety}`)
  log(`Overall: ${ev.overall_score}/100`)
}

// ================================================================
// Phase: Decide — produce Go/No-Go judgment
// ================================================================
phase('Decide')

const decision = await agent(
  `You are the SDLC Decision Agent. Based on the evaluation below, make a deployment decision.

  EVALUATION:
  - Overall Score: ${ev?.overall_score || '?'}/100
  - Code Quality: ${ev?.scores?.code_quality || '?'}/100
  - Test Coverage: ${ev?.scores?.test_coverage || '?'}/100
  - Code Review: ${ev?.scores?.code_review || '?'}/100
  - Change Risk: ${ev?.scores?.change_risk || '?'}/100
  - Historical Safety: ${ev?.scores?.historical_safety || '?'}/100
  - Blocking Issues: ${ev?.blocking_issues?.join(', ') || 'none'}
  - Warnings: ${ev?.warnings?.join(', ') || 'none'}

  Phase: ${gateData?.phase || '?'}
  Has uncommitted changes: ${gitData?.has_uncommitted || false}

  DECISION RULES (applied in order):
  1. Any blocking CRITICAL issue → NO_GO
  2. Overall score < 40 → NO_GO
  3. Overall score 40-69 → CONDITIONAL_GO (list conditions)
  4. Overall score >= 70 → GO

  Return: {
    decision: "GO" | "NO_GO" | "CONDITIONAL_GO",
    risk_score: number (0-100),
    confidence: number (0-100),
    rationale: string,
    conditions: string[] (if CONDITIONAL_GO),
    gates_summary: { P2: string, P3: string, P4: string, P5: string },
    risks: Array<{ severity: string, description: string, mitigation: string }>,
    actions_required: string[],
    actions_recommended: string[]
  }`,
  {
    phase: 'Decide',
    agentType: 'decider',
    schema: {
      type: 'object',
      properties: {
        decision: { type: 'string', enum: ['GO', 'NO_GO', 'CONDITIONAL_GO'] },
        risk_score: { type: 'number' },
        confidence: { type: 'number' },
        rationale: { type: 'string' },
        conditions: { type: 'array', items: { type: 'string' } },
        gates_summary: {
          type: 'object',
          properties: {
            P2: { type: 'string' },
            P3: { type: 'string' },
            P4: { type: 'string' },
            P5: { type: 'string' }
          },
          required: ['P2', 'P3', 'P4', 'P5']
        },
        risks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              severity: { type: 'string' },
              description: { type: 'string' },
              mitigation: { type: 'string' }
            },
            required: ['severity', 'description', 'mitigation']
          }
        },
        actions_required: { type: 'array', items: { type: 'string' } },
        actions_recommended: { type: 'array', items: { type: 'string' } }
      },
      required: ['decision', 'risk_score', 'confidence', 'rationale', 'gates_summary']
    }
  }
)

// ================================================================
// Phase: Recommend — output final report + save decision
// ================================================================
phase('Recommend')

if (decision) {
  log(`========================================`)
  log(`DECISION: ${decision.decision}`)
  log(`Risk: ${decision.risk_score}/100 | Confidence: ${decision.confidence}/100`)
  log(`Rationale: ${decision.rationale}`)
  log(`========================================`)
  log(`Gates: P2=${decision.gates_summary.P2} P3=${decision.gates_summary.P3} P4=${decision.gates_summary.P4} P5=${decision.gates_summary.P5}`)

  if (decision.risks && decision.risks.length > 0) {
    log(`Risks (${decision.risks.length}):`)
    decision.risks.forEach(r => log(`  [${r.severity}] ${r.description} → ${r.mitigation}`))
  }

  if (decision.actions_required && decision.actions_required.length > 0) {
    log(`Required actions:`)
    decision.actions_required.forEach(a => log(`  - ${a}`))
  }

  if (decision.conditions && decision.conditions.length > 0) {
    log(`Conditions for GO:`)
    decision.conditions.forEach(c => log(`  - ${c}`))
  }
}

// Save decision to project-state.json
await agent(
  `Update .claude/project-state.json with the following decision result:
   - Add to phase_history: "SESSION_TIMESTAMP: decision=${decision?.decision}, risk=${decision?.risk_score}, confidence=${decision?.confidence}" （agent will replace SESSION_TIMESTAMP with actual time）
   - If decision is GO or CONDITIONAL_GO, update the relevant phase gate
   - If decision is NO_GO, add blocked_operations with the blocking reasons`,
  { phase: 'Recommend' }
)

log('Decision saved to project-state.json')

return {
  decision: decision?.decision,
  risk_score: decision?.risk_score,
  confidence: decision?.confidence,
  rationale: decision?.rationale,
  conditions: decision?.conditions || [],
  actions_required: decision?.actions_required || [],
  actions_recommended: decision?.actions_recommended || []
}
