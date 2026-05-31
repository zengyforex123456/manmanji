// Feedback → PRD Closed Loop
// 1-person company: user feedback → analysis → PRD draft → decision → implementation

export const meta = {
  name: 'feedback-to-prd',
  description: 'User feedback closed loop — collect, analyze, prioritize, draft PRD, submit to decision layer.',
  phases: [
    { title: 'Collect' },
    { title: 'Analyze' },
    { title: 'Prioritize' },
    { title: 'Draft' },
    { title: 'Decide' }
  ]
}

// ================================================================
// Phase: Collect — gather feedback from all sources
// ================================================================
phase('Collect')

const sources = await parallel([
  // GitHub Issues (open, unassigned)
  async () => {
    return await agent(
      `List open GitHub Issues for this repository that are unassigned or labeled "triage".
       Use "gh issue list --label triage --json number,title,labels,createdAt" or equivalent.
       Also check issues without labels that may be new feedback.
       Return: { issues: Array<{ number: number, title: string, labels: string[], created_at: string, body: string }>, count: number }`,
      { schema: { type: 'object', properties: { issues: { type: 'array', items: { type: 'object', properties: { number: { type: 'number' }, title: { type: 'string' }, labels: { type: 'array', items: { type: 'string' } }, created_at: { type: 'string' }, body: { type: 'string' } }, required: ['number', 'title'] } }, count: { type: 'number' } }, required: ['count'] } }
    )
  },

  // PR comments with feedback-like content
  async () => {
    return await agent(
      `Check recent PRs for unresolved review comments that contain feedback (feature requests, UX suggestions, bug reports).
       Search closed PRs from the last 30 days.
       Return: { feedback_comments: Array<{ pr_number: number, comment: string, author: string }>, count: number }`,
      { schema: { type: 'object', properties: { feedback_comments: { type: 'array', items: { type: 'object', properties: { pr_number: { type: 'number' }, comment: { type: 'string' }, author: { type: 'string' } }, required: ['comment'] } }, count: { type: 'number' } }, required: ['count'] } }
    )
  },

  // Local file input (if args is a filename)
  async () => {
    const inputFile = typeof args === 'string' ? args : null
    if (!inputFile) return { items: [], count: 0 }
    log(`Reading local feedback file: ${inputFile}`)
    return await agent(
      `Read the file "${inputFile}" in the project root. It contains user requirements/feedback in Chinese.
       Parse it into structured feedback items. Each section or bullet point is one item.
       For each item, extract: the requirement description, implied category, and any acceptance criteria mentioned.

       File to read: ${inputFile}

       Return: { items: Array<{ title: string, body: string, category_hint: string }>, count: number }`,
      { schema: { type: 'object', properties: { items: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, body: { type: 'string' }, category_hint: { type: 'string' } }, required: ['title', 'body'] } }, count: { type: 'number' } }, required: ['count'] } }
    )
  }
])

const [issues, prFeedback, localFile] = sources.filter(Boolean)
const totalFeedback = (issues?.count || 0) + (prFeedback?.count || 0) + (localFile?.count || 0)
log(`Collected: ${issues?.count || 0} issues + ${prFeedback?.count || 0} PR comments + ${localFile?.count || 0} local = ${totalFeedback} total`)

if (totalFeedback === 0) {
  log('No new feedback to process.')
  return { processed: 0, prd_drafts: [], status: 'no_feedback' }
}

// ================================================================
// Phase: Analyze — categorize, deduplicate, score each item
// ================================================================
phase('Analyze')

const allItems = []
if (issues?.issues) {
  issues.issues.forEach(i => allItems.push({
    source: `github_issue_#${i.number}`,
    raw_title: i.title,
    raw_body: i.body || '',
    labels: i.labels || [],
    created_at: i.created_at
  }))
}
if (localFile?.items) {
  localFile.items.forEach(i => allItems.push({
    source: 'local_file',
    raw_title: i.title,
    raw_body: i.body || '',
    labels: [],
    created_at: 'SESSION_TIMESTAMP'
  }))
}

const analyzed = await pipeline(
  allItems,
  async (item) => {
    return await agent(
      `Analyze this user feedback as a feedback analyst:

       SOURCE: ${item.source}
       TITLE: ${item.raw_title}
       BODY: ${item.raw_body}

       Steps:
       1. Categorize: bug / feature / ux / performance / content / other
       2. Check for duplicates in GitHub Issues
       3. Priority: Must / Should / Could / Wont (MoSCoW)
       4. Estimate: impact (users affected × frequency) and implementation cost
       5. Calculate ROI score: (impact_score * 10) / cost_score

       Return: {
         source: string,
         category: string,
         priority: string,
         dedup: string,
         roi_score: number,
         summary: string (≤30 chars),
         detail: string,
         acceptance: string[],
         suggested_assignee: string
       }`,
      {
        phase: 'Analyze',
        agentType: 'feedback-analyst',
        schema: {
          type: 'object',
          properties: {
            source: { type: 'string' },
            category: { type: 'string' },
            priority: { type: 'string' },
            dedup: { type: 'string' },
            roi_score: { type: 'number' },
            summary: { type: 'string' },
            detail: { type: 'string' },
            acceptance: { type: 'array', items: { type: 'string' } },
            suggested_assignee: { type: 'string' }
          },
          required: ['source', 'category', 'priority', 'roi_score', 'summary']
        }
      }
    )
  }
)

const valid = analyzed.filter(Boolean)
const duplicates = valid.filter(i => i.dedup && i.dedup !== 'new')
const newItems = valid.filter(i => !i.dedup || i.dedup === 'new')

log(`Analyzed: ${valid.length} total, ${duplicates.length} duplicates, ${newItems.length} new`)

// ================================================================
// Phase: Prioritize — sort by ROI, assign Must/Should/Could/Wont
// ================================================================
phase('Prioritize')

// Sort: Must first, then by ROI score descending
const sorted = [...newItems].sort((a, b) => {
  const priorityOrder = { Must: 0, Should: 1, Could: 2, Wont: 3 }
  const pDiff = (priorityOrder[a.priority] || 4) - (priorityOrder[b.priority] || 4)
  if (pDiff !== 0) return pDiff
  return (b.roi_score || 0) - (a.roi_score || 0)
})

const mustDo = sorted.filter(i => i.priority === 'Must')
const shouldDo = sorted.filter(i => i.priority === 'Should')
const couldDo = sorted.filter(i => i.priority === 'Could')

log(`Priority: ${mustDo.length} Must, ${shouldDo.length} Should, ${couldDo.length} Could`)

// ================================================================
// Phase: Draft — create PRD entries for top items
// ================================================================
phase('Draft')

// Draft PRD for Must + top-3 Should items
const toDraft = [...mustDo, ...shouldDo.slice(0, 3)]

if (toDraft.length === 0) {
  log('No items to draft.')
  return { processed: newItems.length, prd_drafts: [], prioritized: sorted }
}

const prdDrafts = await pipeline(
  toDraft,
  async (item) => {
    log(`Drafting PRD: ${item.summary}...`)
    return await agent(
      `Create a PRD draft entry for this analyzed feedback:

       SUMMARY: ${item.summary}
       DETAIL: ${item.detail}
       CATEGORY: ${item.category}
       PRIORITY: ${item.priority}
       ROI SCORE: ${item.roi_score}
       ACCEPTANCE: ${(item.acceptance || []).join('; ')}
       ASSIGNEE: ${item.suggested_assignee}

       Write the PRD entry to .claude/prd-inbox/<slug>.yml with this format:
       \`\`\`yaml
       id: <auto-generated>
       source: ${item.source}
       summary: "${item.summary}"
       category: ${item.category}
       priority: ${item.priority}
       roi_score: ${item.roi_score}
       acceptance:
         - "condition 1"
         - "condition 2"
       suggested_assignee: ${item.suggested_assignee}
       drafted_at: <timestamp>
       status: draft
       \`\`\`

       Return: { prd_file: string, summary: string, priority: string }`,
      {
        phase: 'Draft',
        schema: {
          type: 'object',
          properties: {
            prd_file: { type: 'string' },
            summary: { type: 'string' },
            priority: { type: 'string' }
          },
          required: ['prd_file']
        }
      }
    )
  }
)

const drafted = prdDrafts.filter(Boolean)
log(`Drafted ${drafted.length} PRD entries to .claude/prd-inbox/`)

// ================================================================
// Phase: Decide — submit to decision layer
// ================================================================
phase('Decide')

if (drafted.length > 0) {
  const decisionInput = drafted.map(d => `- [${d.priority}] ${d.summary} → ${d.prd_file}`).join('\n')

  const decision = await agent(
    `Review the following PRD drafts and decide which to accept into the main PRD.

     DRAFTS:
     ${decisionInput}

     Decision criteria (1-person company):
     1. Does this align with the product vision? (慢慢记 = 28-45岁职场考生备考)
     2. Can this be built in < 1 day? (1-person constraint)
     3. Does this block any existing user flow?
     4. Is the ROI compelling?

     For each draft, decide: ACCEPT / DEFER / REJECT (with reason)
     ACCEPTED items should be merged into .claude/prd.md

     Return: {
       decisions: Array<{ prd_file: string, decision: string, reason: string }>,
       accepted_count: number,
       summary: string
     }`,
    {
      phase: 'Decide',
      agentType: 'decider',
      schema: {
        type: 'object',
        properties: {
          decisions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                prd_file: { type: 'string' },
                decision: { type: 'string' },
                reason: { type: 'string' }
              },
              required: ['prd_file', 'decision']
            }
          },
          accepted_count: { type: 'number' },
          summary: { type: 'string' }
        },
        required: ['accepted_count']
      }
    }
  )

  const accepted = decision?.decisions?.filter(d => d.decision === 'ACCEPT') || []
  log(`Decision: ${accepted.length} accepted, ${(decision?.decisions?.length || 0) - accepted.length} deferred/rejected`)

  return {
    collected: totalFeedback,
    analyzed: newItems.length,
    drafted: drafted.length,
    accepted: accepted.length,
    prioritized: {
      must: mustDo.length,
      should: shouldDo.length,
      could: couldDo.length
    }
  }
}

return { processed: newItems.length, prd_drafts: drafted?.length || 0 }
