// Public entry. Consumers compose these screens into their own router and
// auth shell. The matching CSS is at `switchboard-web/style.css` — import once at
// app startup.

export { Chat } from './components/Chat'
export { Dashboard } from './components/Dashboard'
export { Login } from './components/Login'
export { InviteAccept } from './components/InviteAccept'
export { AddTenant, type AddTenantProps, type AddTenantValues } from './components/AddTenant'

export { Modal, ModalProvider, useModal, type ModalSlot } from './components/Modal'
export {
  RightSidebar,
  RightSidebarProvider,
  useRightSidebar,
  type SidebarSlot,
} from './components/RightSidebar'

export {
  EditorView,
  MessageRender,
  docIsEmpty,
  useChatEditor,
  type EditorOpts,
} from './components/RichEditor'
export {
  Mention,
  docMentionsUser,
  extractMentionsFromDoc,
  type MentionAttrs,
  type MentionKind,
} from './components/MentionMark'
export { GiphyPicker, type GiphyPickResult } from './components/GiphyPicker'

export { installBuiltinPlugins } from './plugins'
export { installGiphy } from './plugins/giphy'

export {
  applyTheme,
  resetTheme,
  defaultDarkTheme,
  type SwitchBoardPalette,
  type SwitchBoardPaletteOverrides,
} from './theme'
