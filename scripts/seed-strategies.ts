/**
 * scripts/seed-strategies.ts
 * Seed strategy templates into the database
 * Run: npx tsx scripts/seed-strategies.ts
 */
import { getDb } from '../lib/db'
import { STRATEGY_TEMPLATES } from '../lib/options/strategies'

async function main() {
  const db = getDb()

  let inserted = 0
  let skipped  = 0

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO strategy_templates
      (name, category, description, legs, max_profit, max_loss, breakeven_formula)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  for (const tpl of STRATEGY_TEMPLATES) {
    const result = stmt.run(
      tpl.name,
      tpl.category,
      tpl.description,
      JSON.stringify(tpl.legs),
      tpl.maxProfit ?? null,
      tpl.maxLoss   ?? null,
      tpl.breakevenFormula ?? null,
    )
    if (result.changes > 0) inserted++
    else skipped++
  }

  console.log(`✅ Strategy templates: ${inserted} inserted, ${skipped} already existed`)
  console.log(`   Total templates: ${STRATEGY_TEMPLATES.length}`)
}

main().catch(console.error)
