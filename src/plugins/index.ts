// Built-in plugins. Imported for side effects from main.tsx so they register
// before the first render. Consumers of @stack/client outside this app are
// free to install their own (or none) — nothing here is required by the
// chat surface itself.

import { installGiphy } from './giphy'

export function installBuiltinPlugins(): void {
  installGiphy()
}
