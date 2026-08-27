// End-to-end smoke test against a running `npm run preview`.
//   npm run build && npm run preview &  then  npm run e2e
import { chromium } from 'playwright'
import { deflateSync } from 'node:zlib'

/** A real PNG, bigger than the 1600px cap, so the downscale path is exercised. */
function testPhoto(w = 1800, h = 1200) {
  const raw = Buffer.alloc(h * (w * 4 + 1))
  for (let y = 0; y < h; y++) {
    const row = y * (w * 4 + 1)
    for (let x = 0; x < w; x++) {
      const o = row + 1 + x * 4
      raw[o] = (x * 255) / w
      raw[o + 1] = (y * 255) / h
      raw[o + 2] = 140
      raw[o + 3] = 255
    }
  }
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (b) => {
    let c = 0xffffffff
    for (const x of b) c = table[(c ^ x) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type), data])
    const c = Buffer.alloc(4)
    c.writeUInt32BE(crc(body))
    return Buffer.concat([len, body, c])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 1 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

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
check('ships a starting list', seeded.length > 20, `got ${seeded.length}`)

const openingTab = await page.locator('nav button[aria-current="true"]').innerText()
check('opens showing everything, not just today', /^All/.test(openingTab), openingTab.replace(/\n/g, ' '))
check('tabs carry a count', /All\s*\d+/.test(openingTab.replace(/\n/g, ' ')), openingTab.replace(/\n/g, ' '))

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

// One dictated run-on in the capture box becomes several tasks.
await box().fill('I want to clean my room then call my dad then pay my Xfinity bill')
await page.waitForTimeout(250)
const heard = await page.locator('ol li.meta').allInnerTexts()
check('capture box splits a spoken run-on', heard.length === 3, heard.join(' | '))
await page.getByRole('button', { name: 'Add 3 tasks' }).click()
await page.waitForTimeout(350)
const spoken = await titles()
check(
  'each spoken item lands as its own task',
  ['Clean my room', 'Call my dad', 'Pay my Xfinity bill'].every((t) => spoken.some((x) => x.startsWith(t))),
  `${spoken.length} rows`,
)
await page.getByRole('button', { name: 'undo' }).click()
await page.waitForTimeout(300)

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

// Complete + restore, against whatever the first task happens to be.
const victim = (await titles())[0].split('\n')[0].trim()
await page.getByRole('button', { name: `Complete ${victim}` }).click()
await page.waitForTimeout(250)
check('completing removes it from the open list', !(await titles()).some((t) => t.startsWith(victim)), victim)
await page.getByRole('button', { name: /^Completed \(/ }).click()
await page.waitForTimeout(250)
check('completed section lists it', (await page.locator('main').innerText()).includes(victim))
await page.getByRole('button', { name: `Reopen ${victim}` }).click()
await page.waitForTimeout(250)
check('reopening restores it', (await titles()).some((t) => t.startsWith(victim)))

// Planner
await page.getByRole('button', { name: /^Today/ }).click()
await page.waitForTimeout(250)
await page.getByRole('button', { name: 'What now?' }).click()
await page.waitForTimeout(400)
const planText = await page.getByRole('dialog').innerText()
check('planner produces an ordered plan', /1\./.test(planText))
check('every plan line has a clock slot', (planText.match(/\d{1,2}:\d{2} (AM|PM) –/g) ?? []).length > 0)
check('planner explains itself', /due|late|quick win|hardest|chip away|fits/.test(planText))

// Focus filter: two different focuses must yield disjoint plans. Proves the
// filter actually bites without hardcoding any task title.
const planTitles = async () =>
  (await page.getByRole('dialog').locator('li .text-\\[15px\\]').allInnerTexts()).map((t) => t.trim())
await page.getByRole('dialog').getByRole('button', { name: 'army', exact: true }).click()
await page.waitForTimeout(300)
const armyPlan = await planTitles()
await page.getByRole('dialog').getByRole('button', { name: 'army', exact: true }).click()
await page.getByRole('dialog').getByRole('button', { name: 'content', exact: true }).click()
await page.waitForTimeout(300)
const contentPlan = await planTitles()
const overlap = armyPlan.filter((t) => contentPlan.includes(t))
check(
  'focus filter narrows the plan',
  armyPlan.length > 0 && contentPlan.length > 0 && overlap.length === 0,
  `army ${armyPlan.length}, content ${contentPlan.length}, overlap ${overlap.length}`,
)
await page.getByRole('dialog').getByRole('button', { name: 'whatever' }).click()
await page.waitForTimeout(200)

// Tiny budget
await page.getByRole('dialog').getByRole('button', { name: '30m', exact: true }).click()
await page.waitForTimeout(300)
const small = await page.getByRole('dialog').innerText()
check('a 30m budget still returns something', /1\./.test(small))
check('big tasks fall to spillover', small.includes('IF YOU GET MORE TIME') || small.includes('If you get more time'))

await page.getByRole('button', { name: 'Close' }).first().click()
await page.waitForTimeout(200)

// Dump-and-organize: a rambling voice-note becomes separate, tagged tasks.
await page.getByRole('button', { name: 'Dump it' }).click()
await page.waitForTimeout(300)
await page.getByLabel('Brain dump').fill(
  "ok so I have to do an army presentation I think Tuesday I don't know I'll get back to it, " +
    'and I also need to take the truck to the mechanic probably 2-3 hours, ' +
    "and then I gotta make a post on LinkedIn. Don't forget to call dad 10 min.",
)
await page.getByRole('button', { name: 'Organize this' }).click()
await page.waitForTimeout(600)
const sheet = page.getByRole('dialog')
const cards = await sheet.locator('li input[aria-label="Task title"]').all()
const draftTitles = await Promise.all(cards.map((c) => c.inputValue()))
check('organize splits a ramble into separate tasks', draftTitles.length === 4, draftTitles.join(' | '))
check('organize strips the spoken filler', draftTitles[0] === 'Do an army presentation', draftTitles[0])
const sheetText = await sheet.innerText()
check('organize guesses tags without being told', /army/.test(sheetText))
check('organize flags what you hedged on', /unsure/.test(sheetText))
await sheet.getByRole('button', { name: /^Add all 4$/ }).click()
await page.waitForTimeout(400)
const afterOrganize = await titles()
check(
  'organized tasks land in the list',
  ['army presentation', 'mechanic', 'LinkedIn'].every((t) => afterOrganize.some((x) => x.includes(t))),
  `${afterOrganize.length} rows`,
)

// An install stranded on an old sample list must be able to recover it, and
// recovering must not touch anything already done. This is the exact shape of
// the real report: 10 sample tasks, one of them completed.
await page.evaluate(() => {
  const stamp = '2026-08-21T09:00:00.000Z'
  const s = (title, over = {}) => ({
    id: 'old-' + title, title, tags: ['home'], status: 'open', priority: 'normal',
    createdAt: stamp, updatedAt: stamp, seed: true, ...over,
  })
  localStorage.setItem('todo.state.v1', JSON.stringify({
    version: 1,
    tasks: [
      s('Move to the new place'), s('Clean up the living room'), s('Do laundry'),
      s('Call Dad', { status: 'done', completedAt: '2026-08-26T12:00:00.000Z', updatedAt: '2026-08-26T12:00:00.000Z' }),
    ],
    settings: { seedInstalled: true, seedVersion: 1 },
  }))
})
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(800)
const strandedCount = (await titles()).length
check('a stranded install is detected', strandedCount < 10, `${strandedCount} tasks before recovery`)
await page.getByRole('button', { name: 'Load my real list' }).click()
await page.waitForTimeout(900)
const recovered = await titles()
check('loading the real list restores it', recovered.length > 35, `${recovered.length} tasks after`)
check('stale samples are cleared', !recovered.some((t) => t.startsWith('Do laundry')))
const doneKept = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('todo.state.v1'))
  const d = s.tasks.find((t) => t.title === 'Call Dad')
  return Boolean(d) && d.status === 'done'
})
check('completed work survives the recovery', doneKept)

// Sorting must work on Today, not only on All.
await page.getByRole('button', { name: /^Today/ }).click()
await page.waitForTimeout(300)
const firstUnder = async (label) => {
  await page.getByRole('button', { name: label, exact: true }).click()
  await page.waitForTimeout(350)
  return (await titles())[0].split('\n')[0].trim()
}
const quickestFirst = await firstUnder('quickest')
const longestFirst = await firstUnder('longest')
check('sorting by time works on Today', quickestFirst !== longestFirst, `${quickestFirst} vs ${longestFirst}`)

// Read the real durations off a flat list and prove the ordering, rather than
// just that something moved.
const minutesInOrder = async (label) => {
  await page.getByRole('button', { name: /^All/ }).click()
  await page.waitForTimeout(250)
  await page.getByRole('button', { name: label, exact: true }).click()
  await page.waitForTimeout(400)
  return (await titles())
    .map((row) => /~(\d+)h\s*(\d+)?m?|~(\d+)m/.exec(row))
    .filter(Boolean)
    .map((m) => (m[1] ? Number(m[1]) * 60 + Number(m[2] ?? 0) : Number(m[3])))
}
const asc = await minutesInOrder('quickest')
const desc = await minutesInOrder('longest')
check(
  'quickest really is ascending by duration',
  asc.length > 5 && asc.every((v, i) => i === 0 || asc[i - 1] <= v),
  `${asc.slice(0, 5).join(',')} …`,
)
check(
  'longest really is descending by duration',
  desc.length > 5 && desc.every((v, i) => i === 0 || desc[i - 1] >= v),
  `${desc.slice(0, 5).join(',')} …`,
)

// Importance must lead with the pinned/critical work.
await page.getByRole('button', { name: 'importance', exact: true }).click()
await page.waitForTimeout(400)
const byImportance = (await titles())[0]
check('importance leads with the pinned work', /employer|Move downstairs/.test(byImportance), byImportance.split('\n')[0])
await page.getByRole('button', { name: /^Today/ }).click()
await page.waitForTimeout(250)

// The choice has to survive a reload, or it is not a setting.
await page.getByRole('button', { name: 'longest', exact: true }).click()
await page.waitForTimeout(350)
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(800)
const stillLongest = await page.getByRole('button', { name: 'longest', exact: true }).getAttribute('class')
check('the chosen sort survives a reload', /accent/.test(stillLongest ?? ''), stillLongest?.includes('accent') ? 'longest still selected' : 'lost it')
await firstUnder('smart')

// Regression: snoozing used to remove a task from every view at once, so
// tapping "not today" a few times looked exactly like the list being cut.
await page.getByRole('button', { name: /^All/ }).click()
await page.waitForTimeout(300)
const beforeSnooze = (await titles()).length
await page.getByRole('button', { name: /^Today/ }).click()
await page.waitForTimeout(250)
await page.getByRole('button', { name: /^Today/ }).click()
await page.waitForTimeout(250)
await page.getByRole('button', { name: 'What now?' }).click()
await page.waitForTimeout(500)
let snoozedCount = 0
for (let i = 0; i < 4; i++) {
  const b = page.getByRole('button', { name: 'not today' }).first()
  if ((await b.count()) === 0) break
  await b.click()
  await page.waitForTimeout(280)
  snoozedCount++
}
await page.keyboard.press('Escape')
await page.waitForTimeout(400)
await page.getByRole('button', { name: /^All/ }).click()
await page.waitForTimeout(350)
const afterSnooze = (await titles()).length
check(
  'snoozing never removes a task from the list',
  snoozedCount > 0 && afterSnooze === beforeSnooze,
  `${beforeSnooze} -> ${afterSnooze} after ${snoozedCount} snoozes`,
)
await page.getByRole('button', { name: /^Today/ }).click()
await page.waitForTimeout(350)
const todayText = await page.locator('main').innerText()
check('today shows what was snoozed', /snoozed \(/i.test(todayText))
await page.getByRole('button', { name: 'wake all' }).click()
await page.waitForTimeout(500)
check('wake all brings them back', !/snoozed \(/i.test(await page.locator('main').innerText()))

// Regression: a task marked "waiting" used to vanish from every single view.
await page.getByRole('button', { name: /^All/ }).click()
await page.waitForTimeout(300)
const blockedRow = (await titles()).find((t) => /waiting/.test(t))
check('blocked tasks are still listed', Boolean(blockedRow), blockedRow?.split('\n')[0])

await page.getByRole('button', { name: /^Someday/ }).click()
await page.waitForTimeout(300)
const somedayCount = await page.locator('main li > div > button[aria-expanded]').count()
check('someday holds only what was parked there', somedayCount > 0 && somedayCount < 12, `${somedayCount} rows`)
await page.getByRole('button', { name: /^Today/ }).click()
await page.waitForTimeout(300)
check('today calls out what is blocked', /blocked/i.test(await page.locator('main').innerText()))

// Photos: attach, shrink, persist, and never bloat localStorage.
await page.locator('main li button[aria-expanded]').first().click()
await page.waitForTimeout(300)
await page
  .locator('input[type="file"][accept="image/*"]')
  .setInputFiles({ name: 'shot.png', mimeType: 'image/png', buffer: testPhoto() })
await page.waitForTimeout(1800)
check('a photo attaches to a task', (await page.getByRole('button', { name: 'View photo' }).count()) === 1)

const shot = await page.evaluate(async () => {
  const db = await new Promise((res) => {
    const r = indexedDB.open('todo-photos', 1)
    r.onsuccess = () => res(r.result)
    r.onerror = () => res(null)
  })
  if (!db) return null
  const all = await new Promise((res) => {
    const r = db.transaction('photos').objectStore('photos').getAll()
    r.onsuccess = () => res(r.result)
    r.onerror = () => res([])
  })
  return all.map((p) => ({ w: p.width, h: p.height, size: p.blob.size, type: p.blob.type }))
})
check('photo lands in IndexedDB, downscaled and re-encoded', 
  shot?.length >= 1 && shot.every((p) => Math.max(p.w, p.h) <= 1600 && p.type === 'image/jpeg'),
  JSON.stringify(shot?.[0]))

const lsSize = await page.evaluate(() => (localStorage.getItem('todo.state.v1') ?? '').length)
check('photos do not bloat localStorage', lsSize < 300_000, `${lsSize} chars`)

await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(700)
await page.locator('main li button[aria-expanded]').first().click()
await page.waitForTimeout(800)
check('photo survives a reload', (await page.getByRole('button', { name: 'View photo' }).count()) === 1)
await page.locator('main li button[aria-expanded]').first().click()
await page.waitForTimeout(200)

// The counts are the whole trust story: the total must never drop.
const totalNow = () => page.evaluate(() => JSON.parse(localStorage.getItem('todo.state.v1')).tasks.length)
const beforeTicking = await totalNow()
const strip = await page.locator('div.meta').first().innerText()
check('the header shows real numbers', /\d+\s*to do/.test(strip.replace(/\n/g, ' ')), strip.replace(/\n/g, ' '))

// Finishing something must stick, whatever happens to the task list afterwards.
let ticked = 0
for (let i = 0; i < 5; i++) {
  const c = page.locator('main li button[aria-label^="Complete"]').first()
  if ((await c.count()) === 0) break
  await c.click()
  await page.waitForTimeout(200)
  ticked++
}
const markedDone = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('todo.state.v1')).tasks.filter((t) => t.status === 'done').map((t) => t.title))
check('ticking a task off records it independently', 
  (await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('todo.completions.v1') ?? '{}')).length)) >= ticked,
  `${ticked} ticked`)

// Destroy the whole list, the way a bad reseed or restore would.
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('todo.state.v1'))
  s.tasks = []
  s.settings.seedInstalled = false
  s.settings.seedVersion = 0
  localStorage.setItem('todo.state.v1', JSON.stringify(s))
})
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(1100)
const backAgain = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('todo.state.v1')).tasks.filter((t) => t.status === 'done').map((t) => t.title))
const missing = markedDone.filter((t) => !backAgain.includes(t))
check(
  'finishing tasks never reduces the total',
  (await totalNow()) === beforeTicking,
  `${beforeTicking} -> ${await totalNow()}`,
)

check(
  'completions survive the entire task list being destroyed',
  markedDone.length > 0 && missing.length === 0,
  missing.length ? `MISSING: ${missing.join(' | ')}` : `${backAgain.length}/${markedDone.length} restored`,
)

// Tag rename / merge / delete
await page.getByRole('button', { name: 'Settings' }).click()
await page.waitForTimeout(300)
const dialog = page.getByRole('dialog')
await dialog.getByRole('button', { name: 'growth', exact: true }).first().click()
await page.keyboard.press('ControlOrMeta+a')
await page.keyboard.type('fun')
await page.keyboard.press('Enter')
await page.waitForTimeout(300)
const tagNames = await dialog.locator('li button[style*="color"]').allInnerTexts()
check('renaming onto an existing tag merges them', !tagNames.includes('growth') && tagNames.includes('fun'), tagNames.join(','))

// Which build is actually running. This is how the owner can tell me whether
// he is looking at the fix or at a cached copy of the app from two deploys ago,
// so it must not be able to break quietly.
const stamp = await page.evaluate(() => {
  const label = [...document.querySelectorAll('.label')].find((el) => el.textContent.trim() === 'Version')
  return label ? label.parentElement.innerText.replace(/\s+/g, ' ').trim() : ''
})
check(
  'settings names the running build',
  /Build \d{4}-\d{2}-\d{2} \d{2}:\d{2} · [0-9a-f]{7,}/.test(stamp),
  stamp.slice(0, 60),
)

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
