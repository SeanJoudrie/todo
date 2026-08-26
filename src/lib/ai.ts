import type { Priority, TagDef, TaskContext } from '../types'
import { CONTEXTS, PRIORITIES } from '../types'
import { todayISO } from './dates'
import { UNSORTED_TAG } from './parse'
import type { Draft } from './organize'
import { newId } from './seed'

/**
 * Optional smarter organizing. The local organizer in `organize.ts` is always
 * the fallback, so everything here can fail without breaking the feature.
 *
 * The key is the user's own, kept in their own browser, and every call goes
 * straight from the phone to Anthropic — there is no server in between.
 */

const MODEL = 'claude-opus-5'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

type RawTask = {
  title: string
  notes: string
  tags: string[]
  dueDate: string
  targetDate: string
  estimateMinutes: number
  priority: string
  effort: string
  contexts: string[]
  subtasks: string[]
  uncertain: boolean
}

function systemPrompt(tags: TagDef[], now: Date): string {
  const today = todayISO(now)
  return [
    'You turn a rambling, dictated brain-dump into a clean list of tasks for one person.',
    '',
    `Today is ${WEEKDAYS[now.getDay()]}, ${today}.`,
    `Available tags: ${tags.map((t) => t.id).join(', ')}.`,
    '',
    'Rules:',
    '- One task per distinct job. Split "I have to X and also Y" into two. Never merge two jobs.',
    '- Titles are short imperative phrases. Strip all filler: "so um I have to", "I\'ll get back to it",',
    '  "I don\'t know". "I have to do an army presentation I think Tuesday" becomes "Do an army presentation".',
    '- ALWAYS assign at least one tag. Guess from the available list rather than leaving it empty —',
    '  a wrong guess is easy to fix, a missing one is not. If genuinely nothing fits, use "unsorted"',
    '  rather than an empty list, so the task is still findable.',
    '- dueDate is a HARD deadline with a real consequence. targetDate is a soft "I want it done by".',
    '  "Teaching it Monday but want it ready Sunday" means dueDate Monday, targetDate Sunday.',
    '  Use YYYY-MM-DD. Empty string when there is no date. Never invent a date that was not implied.',
    '- estimateMinutes is a rough guess in minutes; take the midpoint of a range. Use 0 when there is',
    '  genuinely no way to tell. A guess is more useful than a zero.',
    '- contexts describe where or when it can happen: at home, out and about, a phone call, needs a',
    '  computer, or only during business hours.',
    '- effort is how much brain it needs: light, normal, or deep.',
    '- subtasks only when the speaker actually listed steps. Do not invent a breakdown.',
    '- uncertain is true when the speaker hedged about a date or detail ("I think Tuesday", "maybe").',
    '- Preserve any detail that does not fit a field in notes. Otherwise leave notes empty.',
  ].join('\n')
}

function taskSchema(tagIds: string[]) {
  return {
    type: 'object' as const,
    properties: {
      tasks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Short imperative phrase, no filler.' },
            notes: { type: 'string', description: 'Leftover detail, or empty.' },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: `Prefer these: ${tagIds.join(', ')}. At least one, always.`,
            },
            dueDate: { type: 'string', description: 'YYYY-MM-DD hard deadline, or empty.' },
            targetDate: { type: 'string', description: 'YYYY-MM-DD soft target, or empty.' },
            estimateMinutes: { type: 'number', description: 'Rough guess in minutes, 0 if unknowable.' },
            priority: { type: 'string', enum: PRIORITIES },
            effort: { type: 'string', enum: ['light', 'normal', 'deep'] },
            contexts: { type: 'array', items: { type: 'string', enum: CONTEXTS } },
            subtasks: { type: 'array', items: { type: 'string' } },
            uncertain: { type: 'boolean', description: 'True if the speaker hedged.' },
          },
          required: [
            'title',
            'notes',
            'tags',
            'dueDate',
            'targetDate',
            'estimateMinutes',
            'priority',
            'effort',
            'contexts',
            'subtasks',
            'uncertain',
          ],
          additionalProperties: false,
        },
      },
    },
    required: ['tasks'],
    additionalProperties: false,
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function toDraft(raw: RawTask, source: string): Draft | null {
  const title = (raw.title ?? '').trim()
  if (!title) return null

  return {
    id: newId(),
    title,
    source,
    uncertain: Boolean(raw.uncertain),
    patch: {
      ...(raw.notes?.trim() ? { notes: raw.notes.trim() } : {}),
      tags: (() => {
        const clean = (raw.tags ?? []).map((t) => t.toLowerCase().trim()).filter(Boolean)
        return clean.length > 0 ? clean : [UNSORTED_TAG]
      })(),
      ...(ISO_DATE.test(raw.dueDate ?? '') ? { dueDate: raw.dueDate } : {}),
      ...(ISO_DATE.test(raw.targetDate ?? '') ? { targetDate: raw.targetDate } : {}),
      ...(raw.estimateMinutes > 0
        ? { estimateMinutes: Math.round(raw.estimateMinutes), estimateConfidence: 'guess' as const }
        : {}),
      ...(PRIORITIES.includes(raw.priority as Priority) && raw.priority !== 'normal'
        ? { priority: raw.priority as Priority }
        : {}),
      ...(raw.effort === 'light' || raw.effort === 'deep' ? { effort: raw.effort } : {}),
      ...(raw.contexts?.length
        ? { contexts: raw.contexts.filter((c): c is TaskContext => (CONTEXTS as string[]).includes(c)) }
        : {}),
      ...(raw.subtasks?.length
        ? { subtasks: raw.subtasks.filter(Boolean).map((s) => ({ id: newId(), title: s, done: false })) }
        : {}),
    },
  }
}

export class AiUnavailable extends Error {}

export async function organizeWithClaude(
  text: string,
  apiKey: string,
  tags: TagDef[],
  now = new Date(),
): Promise<Draft[]> {
  // Loaded on demand so the SDK stays out of the bundle for offline-only use.
  const { default: Anthropic } = await import('@anthropic-ai/sdk')

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  let response
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      // A short extraction; low effort keeps it quick enough to use on a phone.
      output_config: { effort: 'low' },
      system: systemPrompt(tags, now),
      tools: [
        {
          name: 'save_tasks',
          description: 'Record the organized tasks found in the brain-dump.',
          strict: true,
          input_schema: taskSchema(tags.map((t) => t.id)),
        },
      ],
      tool_choice: { type: 'tool', name: 'save_tasks' },
      messages: [{ role: 'user', content: text }],
    })
  } catch (error) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    if (error instanceof Anthropic.AuthenticationError) throw new AiUnavailable('That API key was rejected.')
    if (error instanceof Anthropic.RateLimitError) throw new AiUnavailable('Rate limited — try again in a moment.')
    if (error instanceof Anthropic.APIConnectionError) throw new AiUnavailable("Couldn't reach the API. Offline?")
    if (error instanceof Anthropic.APIError) throw new AiUnavailable(`API error ${error.status}: ${error.message}`)
    throw new AiUnavailable(error instanceof Error ? error.message : 'Something went wrong.')
  }

  if (response.stop_reason === 'refusal') throw new AiUnavailable('The model declined that one.')

  const call = response.content.find((block) => block.type === 'tool_use')
  if (!call) throw new AiUnavailable('No tasks came back.')

  const { tasks } = call.input as { tasks: RawTask[] }
  const drafts = (tasks ?? []).map((raw) => toDraft(raw, text)).filter((d): d is Draft => d !== null)
  if (drafts.length === 0) throw new AiUnavailable("Couldn't find any tasks in that.")
  return drafts
}
