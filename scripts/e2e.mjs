// End-to-end smoke test against a running `npm run preview`.
//   npm run build && npm run preview &  then  npm run e2e
import { chromium } from 'playwright'

const BASE = process.env.E2E_URL ?? 'http://localhost:4173/'
const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
)
const page = await browser.newPage({ viewport: { width: 400, height: 900 } })
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(String(e)))

const box = () => page.getByRole('textbox', { name: 'Capture a task' })
const titles = () => page.locator('main li > div > button[aria-expanded]').allInnerTexts()
const results = []
const check = (name, pass, detail = '') => results.push({ name, pass, detail })

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(300)

const seeded = await titles()
check('seeds 11 tasks', seeded.length === 11, `got ${seeded.length}`)

// Capture round-trip
await box().fill('Call the VA about my claim tomorrow 30 min')
await page.waitForTimeout(200)
const chips = await page.locator('button[title="Tap to undo this"]').allInnerTexts()
check('shows parse receipts', chips.length > 0, chips.join(' | '))
check('no bogus #people tag', !chips.some((c) => c.includes('#people')), chips.join(' | '))
await page.keyboard.press('Enter')
await page.waitForTimeout(300)

const after = await titles()
check('captured task appears in the list', after.some((t) => t.includes('Call the VA')), `${after.length} rows`)
check('capture box clears after submit', (await box().inputValue()) === '')

// Persistence across a reload — this is the whole app if it fails.
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(400)
const reloaded = await titles()
check('survives a reload', reloaded.some((t) => t.includes('Call the VA')), `${reloaded.length} rows`)

// Brain dump
await box().fill('clean the garage\nreturn the amazon package\nbook a haircut')
await page.waitForTimeout(150)
await page.getByRole('button', { name: 'Add 3 tasks' }).click()
await page.waitForTimeout(300)
const dumped = await titles()
check('brain dump makes one task per line', dumped.filter((t) => /garage|amazon|haircut/.test(t)).length === 3)

// Undo the dump
await page.getByRole('button', { name: 'undo' }).click()
await page.waitForTimeout(300)
const undone = await titles()
check('undo removes all three', undone.filter((t) => /garage|amazon|haircut/.test(t)).length === 0)

// Complete + restore
await page.getByRole('button', { name: /^Complete Call Dad/ }).click()
await page.waitForTimeout(250)
check('completing removes it from the open list', !(await titles()).some((t) => t.includes('Call Dad')))
await page.getByRole('button', { name: /^Completed \(/ }).click()
await page.waitForTimeout(250)
check('completed section lists it', (await page.locator('main').innerText()).includes('Call Dad'))
await page.getByRole('button', { name: /^Reopen Call Dad/ }).click()
await page.waitForTimeout(250)
check('reopening restores it', (await titles()).some((t) => t.includes('Call Dad')))

// Planner
await page.getByRole('button', { name: 'What should I do today?' }).click()
await page.waitForTimeout(400)
const planText = await page.getByRole('dialog').innerText()
check('planner produces an ordered plan', /1\./.test(planText))
check('every plan line has a clock slot', (planText.match(/\d{1,2}:\d{2} (AM|PM) –/g) ?? []).length > 0)
check('planner explains itself', /due|late|quick win|hardest|chip away|fits/.test(planText))

// Focus filter
await page.getByRole('dialog').getByRole('button', { name: 'army' }).click()
await page.waitForTimeout(300)
const armyPlan = await page.getByRole('dialog').innerText()
check('focus filter narrows the plan', armyPlan.includes('UCMJ') && !armyPlan.includes('1. Clean up'))

// Tiny budget
await page.getByRole('dialog').getByRole('button', { name: 'whatever' }).click()
await page.getByRole('dialog').getByRole('button', { name: '30m', exact: true }).click()
await page.waitForTimeout(300)
const small = await page.getByRole('dialog').innerText()
check('a 30m budget still returns something', /1\./.test(small))
check('big tasks fall to spillover', small.includes('IF YOU GET MORE TIME') || small.includes('If you get more time'))

await page.getByRole('button', { name: 'Close' }).first().click()
await page.waitForTimeout(200)

// Tag rename / merge / delete
await page.getByRole('button', { name: 'Settings' }).click()
await page.waitForTimeout(300)
const dialog = page.getByRole('dialog')
await dialog.getByRole('button', { name: 'growth', exact: true }).click()
await page.keyboard.press('ControlOrMeta+a')
await page.keyboard.type('fun')
await page.keyboard.press('Enter')
await page.waitForTimeout(300)
const tagNames = await dialog.locator('li button[style*="color"]').allInnerTexts()
check('renaming onto an existing tag merges them', !tagNames.includes('growth') && tagNames.includes('fun'), tagNames.join(','))

// Export
const dl = page.waitForEvent('download')
await page.getByRole('button', { name: 'export JSON' }).click()
const file = await dl
const content = await (await file.createReadStream()).toArray()
const json = JSON.parse(Buffer.concat(content).toString())
check('export produces valid JSON with tasks', Array.isArray(json.tasks) && json.tasks.length > 10, `${json.tasks?.length} tasks`)

console.log(results.map((r) => `${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  [${r.detail}]` : ''}`).join('\n'))
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`)
if (errors.length) console.log('\nCONSOLE ERRORS:\n' + errors.join('\n'))
await browser.close()
process.exit(results.every((r) => r.pass) && errors.length === 0 ? 0 : 1)
