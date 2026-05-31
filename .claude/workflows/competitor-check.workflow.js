// Competitor Monitor Workflow — Track competitor updates, reviews, pricing
// Weekly automated competitive intelligence for 1-person company

export const meta = {
  name: 'competitor-check',
  description: 'Automated competitor monitoring — App Store reviews, website changes, pricing updates. Weekly report.',
  phases: [
    { title: 'Research' },
    { title: 'Analyze' },
    { title: 'Report' }
  ]
}

// ================================================================
// Competitor definitions for 慢慢记 (exam prep market)
// ================================================================
const COMPETITORS = [
  { name: '粉笔', type: 'exam_app', url: 'https://fenbi.com', keywords: ['公考', '教师', '题库'] },
  { name: '中公教育', type: 'exam_app', url: 'https://offcn.com', keywords: ['公务员', '事业单位', '教师招聘'] },
  { name: '华图教育', type: 'exam_app', url: 'https://huatu.com', keywords: ['公务员', '事业单位', '教师资格证'] },
  { name: '对啊网', type: 'exam_app', url: 'https://duia.com', keywords: ['会计', '教师', '自考'] }
];

// ================================================================
// Phase: Research — gather competitor intelligence
// ================================================================
phase('Research')

const intel = await pipeline(
  COMPETITORS,
  async (comp) => {
    log(`Researching: ${comp.name}...`)
    return await agent(
      `Research the competitor "${comp.name}" (${comp.type}) for the Chinese exam preparation market.

       Search for:
       1. Recent product updates or new features (last 3 months)
       2. App Store / market ratings and recent reviews (trends, common complaints)
       3. Pricing model and any recent pricing changes
       4. Target user segments and positioning
       5. Key differentiators vs 慢慢记 (which focuses on 28-45 age group, memory-weak candidates, simplified content)

       Use WebSearch to find the latest information.
       Focus on actionable intelligence that helps a 1-person company compete.

       Return: {
         competitor: string,
         rating_trend: string,
         recent_updates: string[],
         pricing_summary: string,
         user_complaints: string[],
         strengths: string[],
         weaknesses: string[],
         threat_level: string (HIGH/MEDIUM/LOW),
         opportunities: string[]
       }`,
      {
        phase: 'Research',
        schema: {
          type: 'object',
          properties: {
            competitor: { type: 'string' },
            rating_trend: { type: 'string' },
            recent_updates: { type: 'array', items: { type: 'string' } },
            pricing_summary: { type: 'string' },
            user_complaints: { type: 'array', items: { type: 'string' } },
            strengths: { type: 'array', items: { type: 'string' } },
            weaknesses: { type: 'array', items: { type: 'string' } },
            threat_level: { type: 'string' },
            opportunities: { type: 'array', items: { type: 'string' } }
          },
          required: ['competitor', 'threat_level', 'opportunities']
        }
      }
    )
  }
)

const validIntel = intel.filter(Boolean)
log(`Competitors researched: ${validIntel.length}/${COMPETITORS.length}`)

// ================================================================
// Phase: Analyze — identify patterns and opportunities
// ================================================================
phase('Analyze')

const analysis = await agent(
  `Analyze the following competitive intelligence for 慢慢记 (a simplified exam prep platform for 28-45 age group):

  ${validIntel.map(c => `
  **${c.competitor}** (Threat: ${c.threat_level})
  - Rating trend: ${c.rating_trend}
  - Pricing: ${c.pricing_summary}
  - Strengths: ${(c.strengths || []).join(', ')}
  - Weaknesses: ${(c.weaknesses || []).join(', ')}
  - User complaints: ${(c.user_complaints || []).join(', ')}
  - Opportunities for 慢慢记: ${(c.opportunities || []).join(', ')}
  `).join('\n')}

  Identify:
  1. Common user complaints across competitors (opportunities for 慢慢记 to differentiate)
  2. Pricing gaps (where 慢慢记 can position better)
  3. Features all competitors have that 慢慢记 should prioritize
  4. Features competitors are missing that 慢慢记 already has (competitive advantage)

  Return: {
    common_complaints: string[],
    pricing_opportunities: string[],
    must_have_features: string[],
    our_advantages: string[],
    recommended_actions: string[],
    overall_threat_level: string
  }`,
  {
    phase: 'Analyze',
    schema: {
      type: 'object',
      properties: {
        common_complaints: { type: 'array', items: { type: 'string' } },
        pricing_opportunities: { type: 'array', items: { type: 'string' } },
        must_have_features: { type: 'array', items: { type: 'string' } },
        our_advantages: { type: 'array', items: { type: 'string' } },
        recommended_actions: { type: 'array', items: { type: 'string' } },
        overall_threat_level: { type: 'string' }
      },
      required: ['recommended_actions']
    }
  }
)

// ================================================================
// Phase: Report — generate weekly competitive report
// ================================================================
phase('Report')

if (analysis) {
  log(`=== Weekly Competitive Intelligence ===`)
  log(`Overall threat level: ${analysis.overall_threat_level}`)
  log(`Our advantages: ${(analysis.our_advantages || []).join(', ')}`)
  log(`Recommended actions:`)
  ;(analysis.recommended_actions || []).forEach(a => log(`  - ${a}`))
}

return {
  competitors_analyzed: validIntel.length,
  threat_level: analysis?.overall_threat_level || 'unknown',
  recommended_actions: analysis?.recommended_actions || [],
  our_advantages: analysis?.our_advantages || []
}
