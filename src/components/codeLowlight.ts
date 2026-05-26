// Shared lowlight instance for code-block syntax highlighting.
//
// Curated language set — ~20 grammars that cover what people actually
// paste into chat. Each grammar is roughly 5-15KB minified, so the
// total addition is ~150-250KB. Add languages here if you keep
// pasting one that's missing; remove any that haven't been seen in
// real channels to claw back bundle weight.
//
// Aliases registered on each language's definition (e.g. js → javascript,
// rb → ruby, sh → bash, html → xml) work out of the box — no need to
// list them separately. Inspect with `codeLowlight.listLanguages()`.

import { createLowlight } from 'lowlight'

import bash from 'highlight.js/lib/languages/bash'
import c from 'highlight.js/lib/languages/c'
import cpp from 'highlight.js/lib/languages/cpp'
import css from 'highlight.js/lib/languages/css'
import diff from 'highlight.js/lib/languages/diff'
import dockerfile from 'highlight.js/lib/languages/dockerfile'
import go from 'highlight.js/lib/languages/go'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import kotlin from 'highlight.js/lib/languages/kotlin'
import markdown from 'highlight.js/lib/languages/markdown'
import python from 'highlight.js/lib/languages/python'
import ruby from 'highlight.js/lib/languages/ruby'
import rust from 'highlight.js/lib/languages/rust'
import sql from 'highlight.js/lib/languages/sql'
import swift from 'highlight.js/lib/languages/swift'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'

export const codeLowlight = createLowlight({
  bash, c, cpp, css, diff, dockerfile, go,
  java, javascript, json, kotlin, markdown,
  python, ruby, rust, sql, swift, typescript,
  xml, yaml,
})
