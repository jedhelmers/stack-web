// Runtime theming for switchboard-web.
//
// Every Tailwind colour utility used by the library reads through a
// `--switchboard-*` CSS variable defined in `src/index.css`. This module
// is the programmatic surface for changing those variables — point
// a host app's theme system at `applyTheme()` and the entire UI
// will follow.

type NeutralScale = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950
type AccentScale = 300 | 400 | 500 | 600 | 900 | 950
type SuccessScale = 400 | 500 | 600 | 700 | 900 | 950
type WarningScale = 200 | 300 | 400 | 500 | 900 | 950
type DangerScale = 300 | 400 | 500 | 900 | 950
type InfoScale = 400 | 900 | 950
type HighlightScale = 400

type ScalePalette<K extends number> = Record<K, string>
type PartialScale<K extends number> = Partial<ScalePalette<K>>

/** Syntax-highlighting tokens for fenced code blocks. Backs the
 *  `.hljs-*` CSS classes produced by lowlight. The default palette
 *  approximates VS Code's "Dark+" theme. */
export interface SwitchBoardSyntaxPalette {
  /** Default text colour inside code blocks. Unhighlighted tokens. */
  base: string
  /** Language keywords (`if`, `return`, `fn`, …). */
  keyword: string
  /** String / character literals. */
  string: string
  /** Numeric literals. */
  number: string
  /** Comments (set in italic by default). */
  comment: string
  /** Function names / titles. */
  function: string
  /** Variable / property identifiers. */
  variable: string
  /** Types, classes, generics. */
  type: string
  /** Built-in identifiers, meta tokens, preprocessor directives. */
  builtin: string
  /** HTML/XML tag names. */
  tag: string
  /** HTML attribute names. */
  attr: string
}

export interface SwitchBoardPalette {
  /** Body / prominent foreground text. Backs `<body>` and the
   *  `text-zinc-100` / `text-zinc-300` utilities. */
  textBody: string
  /** Chrome and type. Lighter shades are foreground, darker
   *  shades are surfaces. Defaults to Tailwind's zinc. */
  neutral: ScalePalette<NeutralScale>
  /** Primary CTA, focus rings, links. Defaults to Tailwind's sky. */
  accent: ScalePalette<AccentScale>
  /** Confirmations, healthy state. Defaults to emerald. */
  success: ScalePalette<SuccessScale>
  /** Caution, pending state. Defaults to amber. */
  warning: ScalePalette<WarningScale>
  /** Errors, destructive actions. Defaults to rose. */
  danger: ScalePalette<DangerScale>
  /** Secondary accent for less-urgent badges. Defaults to violet. */
  info: ScalePalette<InfoScale>
  /** Inline marks in the rich-text editor. Defaults to orange. */
  highlight: ScalePalette<HighlightScale>
  /** Syntax highlighting for fenced code blocks. */
  syntax: SwitchBoardSyntaxPalette
}

export interface SwitchBoardPaletteOverrides {
  textBody?: string
  neutral?: PartialScale<NeutralScale>
  accent?: PartialScale<AccentScale>
  success?: PartialScale<SuccessScale>
  warning?: PartialScale<WarningScale>
  danger?: PartialScale<DangerScale>
  info?: PartialScale<InfoScale>
  highlight?: PartialScale<HighlightScale>
  syntax?: Partial<SwitchBoardSyntaxPalette>
}

/** Default palette, identical to the values shipped in `style.css`.
 *  Use as a starting point when building a variant. */
export const defaultDarkTheme: SwitchBoardPalette = {
  textBody: 'rgba(255, 255, 255, 0.78)',
  neutral: {
    100: 'oklch(96.7% 0.001 286.375)',
    200: 'oklch(92% 0.004 286.32)',
    300: 'oklch(87.1% 0.006 286.286)',
    400: 'oklch(70.5% 0.015 286.067)',
    500: 'oklch(55.2% 0.016 285.938)',
    600: 'oklch(44.2% 0.017 285.786)',
    700: 'oklch(37% 0.013 285.805)',
    800: 'oklch(27.4% 0.006 286.033)',
    900: 'oklch(21% 0.006 285.885)',
    950: 'oklch(14.1% 0.005 285.823)',
  },
  accent: {
    300: 'oklch(82.8% 0.111 230.318)',
    400: 'oklch(74.6% 0.16 232.661)',
    500: 'oklch(68.5% 0.169 237.323)',
    600: 'oklch(58.8% 0.158 241.966)',
    900: 'oklch(39.1% 0.09 240.876)',
    950: 'oklch(29.3% 0.066 243.157)',
  },
  success: {
    400: 'oklch(76.5% 0.177 163.223)',
    500: 'oklch(69.6% 0.17 162.48)',
    600: 'oklch(59.6% 0.145 163.225)',
    700: 'oklch(50.8% 0.118 165.612)',
    900: 'oklch(37.8% 0.077 168.94)',
    950: 'oklch(26.2% 0.051 172.552)',
  },
  warning: {
    200: 'oklch(92.4% 0.12 95.746)',
    300: 'oklch(87.9% 0.169 91.605)',
    400: 'oklch(82.8% 0.189 84.429)',
    500: 'oklch(76.9% 0.188 70.08)',
    900: 'oklch(41.4% 0.112 45.904)',
    950: 'oklch(27.9% 0.077 45.635)',
  },
  danger: {
    300: 'oklch(81% 0.117 11.638)',
    400: 'oklch(71.2% 0.194 13.428)',
    500: 'oklch(64.5% 0.246 16.439)',
    900: 'oklch(41% 0.159 10.272)',
    950: 'oklch(27.1% 0.105 12.094)',
  },
  info: {
    400: 'oklch(70.2% 0.183 293.541)',
    900: 'oklch(38% 0.189 293.745)',
    950: 'oklch(28.3% 0.141 291.089)',
  },
  highlight: {
    400: 'oklch(75% 0.183 55.934)',
  },
  syntax: {
    // Approximate VS Code Dark+ token palette.
    base: 'rgba(255, 255, 255, 0.7)',
    keyword: '#569CD6',
    string: '#CE9178',
    number: '#B5CEA8',
    comment: '#6A9955',
    function: '#DCDCAA',
    variable: '#9CDCFE',
    type: '#4EC9B0',
    builtin: '#569CD6',
    tag: '#569CD6',
    attr: '#9CDCFE',
  },
}

type Scope = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'highlight'

function cssVar(scope: Scope, shade: number): string {
  return `--switchboard-${scope}-${shade}`
}

function collectVars(overrides: SwitchBoardPaletteOverrides): Array<[string, string]> {
  const out: Array<[string, string]> = []
  if (overrides.textBody !== undefined) out.push(['--switchboard-text-body', overrides.textBody])
  const scopes: Scope[] = ['neutral', 'accent', 'success', 'warning', 'danger', 'info', 'highlight']
  for (const scope of scopes) {
    const scale = overrides[scope]
    if (!scale) continue
    for (const shade of Object.keys(scale)) {
      const value = (scale as Record<string, string | undefined>)[shade]
      if (value === undefined) continue
      out.push([cssVar(scope, Number(shade)), value])
    }
  }
  if (overrides.syntax) {
    for (const [token, value] of Object.entries(overrides.syntax)) {
      if (value === undefined) continue
      out.push([`--switchboard-syntax-${token}`, value])
    }
  }
  return out
}

/** Resolve the target element. Defaults to `:root` (the documentElement).
 *  Returns `null` when called outside a browser environment so callers
 *  can no-op gracefully during SSR. */
function resolveTarget(target?: HTMLElement | null): HTMLElement | null {
  if (target) return target
  if (typeof document === 'undefined') return null
  return document.documentElement
}

/**
 * Apply a partial palette to the document (or a scoped element).
 *
 * Only the keys you provide are written — everything else falls
 * through to the defaults defined in `style.css`. Returns a
 * function that restores the previous inline values, suitable for
 * use as a `useEffect` cleanup.
 *
 * @example
 *   useEffect(() => applyTheme({
 *     accent: { 600: '#3b82f6', 500: '#60a5fa' },
 *     textBody: '#f5f7fb',
 *   }), [])
 */
export function applyTheme(
  overrides: SwitchBoardPaletteOverrides,
  target?: HTMLElement | null,
): () => void {
  const el = resolveTarget(target)
  if (!el) return () => {}

  const vars = collectVars(overrides)
  const previous: Array<[string, string, string]> = vars.map(([name]) => [
    name,
    el.style.getPropertyValue(name),
    el.style.getPropertyPriority(name),
  ])

  for (const [name, value] of vars) {
    el.style.setProperty(name, value)
  }

  return () => {
    for (const [name, prevValue, prevPriority] of previous) {
      if (prevValue) {
        el.style.setProperty(name, prevValue, prevPriority)
      } else {
        el.style.removeProperty(name)
      }
    }
  }
}

/**
 * Remove every `--switchboard-*` override that was set inline on the
 * target element, restoring the defaults from `style.css`. Use
 * this when switching back to the bundled theme without remembering
 * which keys were overridden.
 */
export function resetTheme(target?: HTMLElement | null): void {
  const el = resolveTarget(target)
  if (!el) return
  for (let i = el.style.length - 1; i >= 0; i--) {
    const name = el.style.item(i)
    if (name && name.startsWith('--switchboard-')) {
      el.style.removeProperty(name)
    }
  }
}
