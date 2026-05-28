// MrkdwnRender — render the SwitchBoard mrkdwn dialect (m.text) as a
// React tree. Used as the fallback when a message arrives WITHOUT a
// TipTap payload (e.g. from native iOS, CLI, bots, third-party clients).
//
// Web users compose via the TipTap RichEditor which writes m.payload —
// that path still goes through MessageRender. This component only kicks
// in for the text-only branch.

import { Fragment, type ReactNode } from 'react'
import { parse, type MrkdwnNode } from '@switchboard/client/mrkdwn'
import { codeLowlight } from './codeLowlight'

// hast (HTML AST) shape produced by lowlight.highlight(). We only walk
// the subset of node types lowlight actually emits.
type HastNode =
  | { type: 'text'; value: string }
  | {
      type: 'element'
      tagName: string
      properties?: { className?: string[]; [k: string]: unknown }
      children: HastNode[]
    }

function renderHast(nodes: HastNode[]): ReactNode[] {
  return nodes.map((n, i) => {
    if (n.type === 'text') return <Fragment key={i}>{n.value}</Fragment>
    const className = Array.isArray(n.properties?.className)
      ? n.properties.className.join(' ')
      : undefined
    return (
      <span key={i} className={className}>
        {renderHast(n.children)}
      </span>
    )
  })
}

// Same selector set as RichEditor uses for the TipTap output, minus the
// editor-only bits, so mrkdwn and TipTap messages look identical.
const renderClasses = [
  'text-sm text-zinc-100 break-words',
  '[&_p]:my-1',
  '[&_strong]:font-semibold',
  '[&_em]:italic',
  '[&_s]:line-through',
  '[&_a]:text-sky-400 [&_a]:underline [&_a:hover]:text-sky-300',
  '[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-1',
  '[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-1',
  '[&_blockquote]:border-l-2 [&_blockquote]:border-zinc-600 [&_blockquote]:pl-3 [&_blockquote]:text-zinc-300',
  '[&_:not(pre)>code]:rounded [&_:not(pre)>code]:bg-zinc-800 [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:text-[0.9em] [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-orange-400',
  // Code blocks: full width, always left aligned (the own-message wrapper
  // sets text-right). `.hljs` rules in index.css own the per-token colors;
  // don't set a competing `color` here.
  '[&_pre]:my-2 [&_pre]:w-full [&_pre]:max-w-none [&_pre]:rounded-md [&_pre]:bg-[var(--switchboard-syntax-bg)] [&_pre]:border [&_pre]:border-zinc-800 [&_pre]:px-4 [&_pre]:py-3 [&_pre]:overflow-x-auto [&_pre]:text-left',
  '[&_pre_code]:block [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[13px] [&_pre_code]:leading-relaxed [&_pre_code]:font-mono [&_pre_code]:text-left',
].join(' ')

// Allowlist of URL schemes. The spec lets users put arbitrary text
// between `<` and `>`, so we have to keep `javascript:` and friends out.
function safeURL(url: string): string | null {
  const trimmed = url.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (/^mailto:/i.test(trimmed)) return trimmed
  return null
}

export function MrkdwnRender({ text }: { text: string }): ReactNode {
  if (!text) return null
  const blocks = parse(text)
  return <div className={renderClasses}>{blocks.map(renderNode)}</div>
}

function renderNode(node: MrkdwnNode, idx: number): ReactNode {
  switch (node.type) {
    case 'text':
      return <Fragment key={idx}>{node.value}</Fragment>
    case 'emphasis': {
      const inner = node.children.map(renderNode)
      if (node.style === 'bold') return <strong key={idx}>{inner}</strong>
      if (node.style === 'italic') return <em key={idx}>{inner}</em>
      return <s key={idx}>{inner}</s>
    }
    case 'code_inline':
      return <code key={idx}>{node.value}</code>
    case 'code_block': {
      const lang = node.lang && codeLowlight.registered(node.lang) ? node.lang : null
      if (!lang) {
        return (
          <pre key={idx}>
            <code>{node.value}</code>
          </pre>
        )
      }
      const tree = codeLowlight.highlight(lang, node.value)
      return (
        <pre key={idx}>
          <code className={`hljs language-${lang}`}>
            {renderHast(tree.children as HastNode[])}
          </code>
        </pre>
      )
    }
    case 'link': {
      const href = safeURL(node.url)
      const inner = node.children.map(renderNode)
      if (!href) return <Fragment key={idx}>{inner}</Fragment>
      return (
        <a key={idx} href={href} target="_blank" rel="noopener noreferrer">
          {inner}
        </a>
      )
    }
    case 'paragraph':
      return <p key={idx}>{node.children.map(renderNode)}</p>
    case 'blockquote':
      return <blockquote key={idx}>{node.children.map(renderNode)}</blockquote>
    case 'list': {
      const items = node.items.map((item, i) => (
        <li key={i}>{item.map(renderNode)}</li>
      ))
      return node.ordered ? <ol key={idx}>{items}</ol> : <ul key={idx}>{items}</ul>
    }
  }
}
