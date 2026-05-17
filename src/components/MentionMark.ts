// MentionMark — a custom TipTap mark for @-mentions. Stored as a TipTap mark
// (not a node) so it attaches to a run of text characters — the visible
// "@Bob" stays editable like any other text but carries the user id + kind
// in mark attrs. On send we walk the JSON for these marks and ship the
// structural mentions array to the server. On read, MessageRender's TipTap
// instance has this mark registered so the same JSON round-trips back into
// a styled span.
//
// Why a mark not a node? Marks compose with text; you can backspace through
// "@Bob" character by character and the mention naturally shrinks then
// disappears, the same way bold or italic would. Nodes are atomic — which
// is closer to Slack's behavior, but requires custom NodeView code and
// dedicated keyboard handling. Marks Just Work with TipTap StarterKit.
//
// The mark schema uses `inclusive: false` so text typed *after* the mention
// doesn't pick up the mark (otherwise typing "@Bob hi" turns "hi" into a
// styled mention too).

import { Mark, mergeAttributes } from '@tiptap/core'
import type { JSONContent } from '@tiptap/react'

export type MentionKind = 'user' | 'channel' | 'here' | 'everyone'

export type MentionAttrs = {
  userId: string | null
  kind: MentionKind
  // Display name captured at insert time. Surfaces in the rendered span
  // and survives even if the user is later renamed (we want the message
  // to read the same way it was written — Slack-style frozen mentions).
  label: string
}

export const Mention = Mark.create({
  name: 'mention',
  inclusive: false,
  excludes: '_', // can't combine with other marks like bold for a mention

  addAttributes() {
    return {
      userId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-user-id'),
        renderHTML: (attrs) =>
          attrs.userId ? { 'data-user-id': attrs.userId } : {},
      },
      kind: {
        default: 'user' as MentionKind,
        parseHTML: (el) => (el.getAttribute('data-kind') as MentionKind) || 'user',
        renderHTML: (attrs) => ({ 'data-kind': attrs.kind }),
      },
      label: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-label') ?? '',
        renderHTML: (attrs) =>
          attrs.label ? { 'data-label': attrs.label } : {},
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-mention]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-mention': '',
        // Tailwind classes baked in so the mark renders consistently
        // wherever the editor is mounted (composer, message list, thread).
        class:
          'mention rounded px-1 py-0.5 font-medium text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 cursor-default',
      }),
      0, // 0 = render the text content here
    ]
  },
})

// extractMentionsFromDoc walks a TipTap doc and collects every distinct
// mention mark into the structural array the server expects. Dedupes by
// (kind, userId) — repeating "@Bob @Bob" still only notifies Bob once.
export function extractMentionsFromDoc(
  doc: JSONContent | undefined,
): { kind: MentionKind; user_id?: string }[] {
  if (!doc) return []
  const seen = new Set<string>()
  const out: { kind: MentionKind; user_id?: string }[] = []

  function walk(node: JSONContent | undefined): void {
    if (!node) return
    const marks = node.marks ?? []
    for (const mark of marks) {
      if (mark.type !== 'mention') continue
      const attrs = (mark.attrs ?? {}) as Partial<MentionAttrs>
      const kind = (attrs.kind as MentionKind) || 'user'
      const userId = attrs.userId ?? undefined
      const dedupKey = kind === 'user' ? `user:${userId ?? ''}` : kind
      if (seen.has(dedupKey)) continue
      seen.add(dedupKey)
      if (kind === 'user' && !userId) continue
      out.push(kind === 'user' ? { kind, user_id: userId! } : { kind })
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) walk(child)
    }
  }

  walk(doc)
  return out
}

// docMentionsUser returns true when the doc contains a mention that would
// notify the given user — either @user matching their id, or any of the
// channel-wide kinds. Used by MessageItem to apply the "you got pinged"
// highlight without a separate API field.
export function docMentionsUser(
  doc: JSONContent | undefined,
  userId: string,
): boolean {
  for (const m of extractMentionsFromDoc(doc)) {
    if (m.kind === 'user' && m.user_id === userId) return true
    if (m.kind !== 'user') return true
  }
  return false
}
