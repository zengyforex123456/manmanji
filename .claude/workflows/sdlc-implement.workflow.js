// SDLC P2 Implementation Workflow
// Fan-out parallel implementation of PRD modules, then sequential verification.

export const meta = {
  name: 'sdlc-implement',
  description: 'SDLC P2: Parallel implementation by PRD module. Each module independently coded → verified.',
  phases: [
    { title: 'Discover' },
    { title: 'Implement' },
    { title: 'Verify' },
    { title: 'Integrate' }
  ]
}

// === Phase: Discover - read PRD and identify modules ===
phase('Discover')

const prdModules = await agent(
  `Read the PRD file for this project (look for .claude/prd.md or prd.md or similar).
   Extract all requirements and group them into independent implementation modules.

   Each module should:
   - Have a clear name (≤20 chars)
   - List the PRD requirement IDs it covers
   - Be independently implementable (no dependencies on other modules)
   - Have 1-3 acceptance criteria

   Return: { modules: Array<{ name: string, prd_ids: string[], description: string, acceptance: string[] }> }`,
  { schema: { type: 'object', properties: { modules: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, prd_ids: { type: 'array', items: { type: 'string' } }, description: { type: 'string' }, acceptance: { type: 'array', items: { type: 'string' } } }, required: ['name', 'description', 'acceptance'] } } }, required: ['modules'] } }
)

if (!prdModules || !prdModules.modules || prdModules.modules.length === 0) {
  log('No PRD modules found. Check if .claude/prd.md exists.')
  return { implemented: [], status: 'no_modules' }
}

log(`Found ${prdModules.modules.length} modules: ${prdModules.modules.map(m => m.name).join(', ')}`)

// === Phase: Implement - parallel implementation of all modules ===
phase('Implement')

const implementations = await pipeline(
  prdModules.modules,
  // Stage 1: Implement each module
  async (mod) => {
    log(`Implementing: ${mod.name}...`)
    const result = await agent(
      `Implement the module "${mod.name}" per PRD requirements.

       Module description: ${mod.description}
       PRD requirements: ${mod.prd_ids.join(', ')}
       Acceptance criteria: ${mod.acceptance.join('; ')}

       Rules:
       1. ONLY implement what's specified in this module - no extra features
       2. Follow project coding standards (from CLAUDE.md)
       3. If UI is involved, follow UI/UX constraints (touch ≥44px, contrast ≥4.5:1, responsive)
       4. Write the implementation and report what files were created/modified

       Return: { module_name: string, files: string[], success: bool, notes: string }`,
      {
        phase: 'Implement',
        agentType: 'sdlc-coder',
        schema: { type: 'object', properties: { module_name: { type: 'string' }, files: { type: 'array', items: { type: 'string' } }, success: { type: 'boolean' }, notes: { type: 'string' } }, required: ['module_name', 'files', 'success'] }
      }
    )
    return result
  }
)

const successful = implementations.filter(Boolean).filter(m => m.success)
const failed = implementations.filter(Boolean).filter(m => !m.success)
log(`Implemented: ${successful.length}/${implementations.length} modules` + (failed.length > 0 ? ` (${failed.length} failed)` : ''))

// === Phase: Verify - test each implemented module ===
phase('Verify')

const testResults = await pipeline(
  successful,
  async (mod) => {
    log(`Testing: ${mod.module_name}...`)
    const result = await agent(
      `Verify the implementation of module "${mod.module_name}".
       Files: ${mod.files.join(', ')}
       Acceptance criteria: ${prdModules.modules.find(m => m.name === mod.module_name)?.acceptance?.join('; ') ?? 'N/A'}

       Run relevant tests for these files. Check:
       1. Does the implementation match the acceptance criteria?
       2. Are there any obvious bugs or edge cases?
       3. Does it integrate correctly with existing code?

       Return: { module_name: string, verified: bool, test_results: string, issues: string[] }`,
      {
        phase: 'Verify',
        agentType: 'sdlc-tester',
        schema: { type: 'object', properties: { module_name: { type: 'string' }, verified: { type: 'boolean' }, test_results: { type: 'string' }, issues: { type: 'array', items: { type: 'string' } } }, required: ['module_name', 'verified'] }
      }
    )
    return result
  }
)

const verified = testResults.filter(Boolean).filter(t => t.verified)
log(`Verified: ${verified.length}/${successful.length} modules`)

// === Phase: Integrate - cross-module consistency check ===
phase('Integrate')

const allFiles = successful.flatMap(m => m.files).filter(Boolean)
if (allFiles.length > 0) {
  const integration = await agent(
    `Perform cross-module integration check.
     All modified files: ${allFiles.join(', ')}

     Check:
     1. Are there any interface mismatches between modules?
     2. Are there duplicate functions or conflicting variable names?
     3. Do all modules together satisfy the complete PRD?

     Return: { consistent: bool, conflicts: string[], summary: string }`,
    {
      phase: 'Integrate',
      agentType: 'sdlc-reviewer',
      schema: { type: 'object', properties: { consistent: { type: 'boolean' }, conflicts: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } }, required: ['consistent'] }
    }
  )

  log(`Integration: ${integration?.consistent ? 'CONSISTENT' : 'CONFLICTS FOUND'}`)
  if (integration && !integration.consistent) {
    integration.conflicts.forEach(c => log(`  - ${c}`))
  }
} else {
  log('Integration: SKIP (no files changed)')
}

return {
  modules_total: prdModules.modules.length,
  implemented: successful.length,
  failed: failed.length,
  verified: verified.length,
  files: allFiles
}
