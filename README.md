# stack-web

Drop-in React screens for the [Stack](https://github.com/jedhelmers/stack-client) chat platform. Compose `<Chat />`, `<Dashboard />`, `<Login />`, and `<InviteAccept />` into your own app — bring your own router, auth gating, and query client.

The companion data layer is [`@stack/client`](https://github.com/jedhelmers/stack-client), which provides the typed REST client, React Query hooks, and realtime patcher. `stack-web` depends on it and re-exports nothing from it — import data hooks (`useMe`, `useChannels`, …) directly from `@stack/client`.

## Install

```sh
npm install \
  github:jedhelmers/stack-web#v0.1.0 \
  github:jedhelmers/stack-client#v0.2.3 \
  react react-dom @tanstack/react-query
```

`react`, `react-dom`, and `@tanstack/react-query` are peer dependencies — the consumer app provides them.

The `prepare` script builds `lib/` automatically on install (both JS via `tsc` and CSS via the Tailwind v4 CLI), so a clean `npm install` is all you need.

## Quick start

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { configure, useMe } from '@stack/client'
import {
  Chat,
  ModalProvider,
  RightSidebarProvider,
  Modal,
  installBuiltinPlugins,
} from 'stack-web'
import 'stack-web/style.css'

// Point @stack/client at your backend (defaults assume same-origin /v1/...).
configure({ baseURL: 'https://chat.example.com' })

// Register built-in slash commands + payload renderers (e.g. /giphy).
// Optional — call at module top level if you want them. Safe to omit.
installBuiltinPlugins()

const qc = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

export function App() {
  return (
    <QueryClientProvider client={qc}>
      <ChatGate />
    </QueryClientProvider>
  )
}

function ChatGate() {
  const { data: user, isLoading } = useMe()
  if (isLoading) return <div>Loading…</div>
  if (!user) return <div>Please sign in.</div>
  return (
    <ModalProvider>
      <RightSidebarProvider>
        <Chat
          user={user}
          activeWorkspaceSlug={null}
          activeChannelId={null}
        />
      </RightSidebarProvider>
      <Modal />
    </ModalProvider>
  )
}
```

## Screens

Each screen is fully decoupled — you wire it into whatever router you use.

### `<Chat />`

The main messaging surface (workspace list, channel list, message stream, composer, threads).

```tsx
<Chat
  user={user}                                 // from useMe()
  activeWorkspaceSlug={slug ?? null}          // controlled selection
  activeChannelId={channelId ?? null}
  onSelectWorkspace={(slug) => navigate(`/chat/${slug}`)}
  onSelectChannel={(slug, id) => navigate(`/chat/${slug}/${id}`)}
  onOpenDashboard={user.is_operator ? () => navigate('/admin') : undefined}
/>
```

**Required wrappers** (both must be ancestors, and `<Modal />` must be rendered as a sibling so it can portal-ish over the chat):

```tsx
<ModalProvider>
  <RightSidebarProvider>
    <Chat {...props} />
  </RightSidebarProvider>
  <Modal />
</ModalProvider>
```

Threads, member profiles, and channel info open in the right sidebar; settings and confirms open in the modal. Both are single-slot — opening a second item replaces the first.

### `<Dashboard />`

Operator-only admin surface (stats, workspaces, channels, users, parent apps + API keys, audit log, system health). The server gates the underlying endpoints; this UI assumes `user.is_operator === true`.

```tsx
<Dashboard
  user={user}
  activeTab={tab}                              // optional; controlled tab
  onTabChange={(t) => navigate(`/admin/${t}`)} // optional
  onExit={() => navigate('/chat')}
/>
```

### `<Login />`

Email + password sign-in form. Posts to `useLogin()` from `@stack/client`; on success the `/me` query repopulates and your auth gate re-renders.

```tsx
<Login />
```

### `<InviteAccept />`

Self-serve account creation from an invite token (typically the `:token` segment of an `/invite/:token` route).

```tsx
<InviteAccept
  token={tokenFromUrl}
  onAccepted={() => navigate('/chat')}
/>
```

## Styling

Import the prebuilt stylesheet **once** at app startup:

```tsx
import 'stack-web/style.css'
```

It's a compiled Tailwind v4 build that includes every class used by the screens. The file also defines a few app-shell rules — most notably `html, body, #root { height: 100%; overflow: hidden }` — because the chat shell expects a viewport-sized container that doesn't scroll (every scroll lives inside a designated panel). If you mount the chat inside a non-fullscreen container, override those rules in your own CSS after the import.

The bundle uses plain Tailwind utility classes (`bg-zinc-950`, `text-zinc-100`, etc.) so it composes cleanly with a host app that also uses Tailwind. There's no scoping or CSS-modules layer.

### Theming

Every colour utility used inside the library reads through a semantic `--stack-*` CSS variable. The default values are dark with a sky/emerald/amber/rose accent set — they're listed in `src/index.css` and re-exported as `defaultDarkTheme` from the package.

#### Overrides at runtime

Use `applyTheme()` from a host that flips themes (system preference, brand picker, multi-tenant skinning, …). Only the keys you pass are written, so partial overrides are fine.

```tsx
import { applyTheme, resetTheme, defaultDarkTheme } from 'stack-web'

// Recolour just the primary accent and the body text.
applyTheme({
  textBody: '#f5f7fb',
  accent: {
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
  },
})

// Inside a React effect, return the cleanup to undo the override
// when the host theme changes again.
useEffect(() => applyTheme(currentBrandPalette), [currentBrandPalette])

// Or drop every inline override back to the bundled defaults.
resetTheme()
```

`applyTheme(overrides, target?)` writes the CSS variables onto `target` (default `document.documentElement`). Pass a more specific element to scope the override to a subtree — handy if you mount the library inside a panel that wants a different palette from the rest of the page.

#### Token reference

| Group | Shades | Role | Default mapping |
| --- | --- | --- | --- |
| `textBody` | — | `<body>` and high-emphasis text utilities (`text-zinc-100`/`text-zinc-300`) | `rgba(255,255,255,0.78)` |
| `neutral` | `100,200,300,400,500,600,700,800,900,950` | Chrome, panels, type | Tailwind `zinc-*` |
| `accent` | `300,400,500,600,900,950` | Primary CTA, focus rings, links | Tailwind `sky-*` |
| `success` | `400,500,600,700,900,950` | Confirmations, healthy state | Tailwind `emerald-*` |
| `warning` | `200,300,400,500,900,950` | Caution, pending state | Tailwind `amber-*` |
| `danger`  | `300,400,500,900,950` | Errors, destructive | Tailwind `rose-*` |
| `info` | `400,900,950` | Secondary accent / badges | Tailwind `violet-*` |
| `highlight` | `400` | Inline marks in the rich-text editor | Tailwind `orange-400` |

The components keep using `bg-zinc-950`, `text-rose-400`, etc. — those classes resolve to `var(--color-zinc-950)`, which is rewired in `src/index.css` to point at `--stack-neutral-950`. Override `--stack-*` (via `applyTheme()` or your own CSS) and every utility follows.

If you'd rather set the variables in plain CSS:

```css
:root {
  --stack-neutral-950: #0b0d12;
  --stack-accent-600: #3b82f6;
  --stack-text-body: #f5f7fb;
}
```

## Plugins

Slash commands and payload renderers are registered globally via `@stack/client`'s plugin registry. `stack-web` ships one optional plugin (`/giphy`) and an `installBuiltinPlugins()` helper:

```tsx
import { installBuiltinPlugins } from 'stack-web'
installBuiltinPlugins()  // registers /giphy + the GiphyBlock payload renderer
```

To register a custom command, use `registerSlashCommand` / `registerPayloadRenderer` from `@stack/client` directly. See [`src/plugins/giphy.tsx`](src/plugins/giphy.tsx) for a worked example.

## What's exported

| Export | What it is |
| --- | --- |
| `Chat`, `Dashboard`, `Login`, `InviteAccept` | Top-level screens |
| `ModalProvider`, `Modal`, `useModal`, `ModalSlot` | Global modal slot — Chat needs this |
| `RightSidebarProvider`, `RightSidebar`, `useRightSidebar`, `SidebarSlot` | Global right-side drawer — Chat needs this |
| `useChatEditor`, `EditorView`, `MessageRender`, `docIsEmpty`, `EditorOpts` | TipTap-based composer + renderer if you want to embed message editing outside `<Chat />` |
| `Mention`, `extractMentionsFromDoc`, `docMentionsUser`, `MentionAttrs`, `MentionKind` | Mention mark + helpers |
| `GiphyPicker`, `GiphyPickResult` | Standalone Giphy search component |
| `installBuiltinPlugins`, `installGiphy` | Plugin registration helpers |
| `applyTheme`, `resetTheme`, `defaultDarkTheme`, `StackPalette`, `StackPaletteOverrides` | Runtime palette controls — see [Theming](#theming) |

Data hooks, the REST client, types like `User`/`Channel`/`Message`, and the realtime layer all live in `@stack/client` — import them from there.

## Development

```sh
npm install
npm run typecheck   # tsc --noEmit
npm run build       # tsc emit -> lib/ + tailwind -> lib/style.css
npm run clean       # rm -rf lib
```

There's no dev server in this repo any more — `stack-web` is a library. Work on it from inside a consumer app via `npm link`, or run an in-repo example.

## Versioning

Tagged releases live on GitHub (`vX.Y.Z`). Pin a tag in your consumer's `package.json`:

```json
"stack-web": "github:jedhelmers/stack-web#v0.1.0"
```

To cut a new release: bump `version` in `package.json`, commit, `git tag vX.Y.Z`, `git push --tags`. Consumers re-run `npm install` to pull the new tag; the `prepare` script rebuilds `lib/` on their machine.
