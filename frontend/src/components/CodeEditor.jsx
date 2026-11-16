import { useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { java } from '@codemirror/lang-java'
import { python } from '@codemirror/lang-python'
import { cpp } from '@codemirror/lang-cpp'
import { HighlightStyle, indentUnit, syntaxHighlighting } from '@codemirror/language'
import { EditorView, keymap } from '@codemirror/view'
import { Prec } from '@codemirror/state'
import { tags as t } from '@lezer/highlight'

// Every colour is a CSS variable (index.css), so the editor follows the light / dark theme with no re-mount.
const theme = EditorView.theme({
  '&': { backgroundColor: 'var(--code-bg)', color: 'var(--ink)', fontSize: '13px', height: '100%' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.6' },
  '.cm-content': { caretColor: 'var(--accent)', padding: '12px 0' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
  '&.cm-focused': { outline: 'none' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'var(--syn-selection) !important' },
  '.cm-activeLine': { backgroundColor: 'var(--syn-active-line)' },
  '.cm-gutters': { backgroundColor: 'transparent', color: 'var(--syn-gutter)', border: 'none', paddingLeft: '6px' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--accent)' },
  '.cm-matchingBracket': { backgroundColor: 'var(--accent-soft)', outline: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)' },
  '.cm-tooltip': { backgroundColor: 'var(--surface-strong)', border: '1px solid var(--line-strong)', borderRadius: '10px', color: 'var(--ink)' },
  '.cm-tooltip-autocomplete ul li[aria-selected]': { backgroundColor: 'var(--accent-soft)', color: 'var(--ink)' },
  '.cm-foldPlaceholder': { backgroundColor: 'var(--accent-soft)', border: 'none', color: 'var(--accent)' },
})

const highlight = syntaxHighlighting(HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.definitionKeyword, t.modifier], color: 'var(--syn-keyword)' },
  { tag: [t.string, t.special(t.string), t.character], color: 'var(--syn-string)' },
  { tag: [t.number, t.bool, t.null], color: 'var(--syn-number)' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--syn-comment)', fontStyle: 'italic' },
  { tag: [t.typeName, t.className, t.namespace, t.standard(t.typeName)], color: 'var(--syn-type)' },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.macroName], color: 'var(--syn-function)' },
  { tag: [t.operator, t.punctuation, t.bracket], color: 'var(--syn-operator)' },
  { tag: t.invalid, color: 'var(--brick)' },
]))

const LANGS = { JAVA: java, PYTHON: python, CPP: cpp }

// Real code editor (CodeMirror 6): syntax highlighting, line numbers, bracket matching, auto-indent,
// folding, search (Ctrl/Cmd+F) and multiple cursors. Tab indents; Escape then Tab leaves the editor.
// onRun / onSubmit are bound to Ctrl/Cmd+' and Ctrl/Cmd+Enter.
export default function CodeEditor({ value, onChange, language = 'JAVA', readOnly = false, height = '100%',
  ariaLabel = 'Code editor', onRun, onSubmit }) {
  const extensions = useMemo(() => {
    const ext = [
      (LANGS[language] ?? java)(),
      theme,
      highlight,
      indentUnit.of('    '),
      EditorView.contentAttributes.of({ 'aria-label': ariaLabel }),
    ]
    if (onRun || onSubmit) {
      ext.push(Prec.highest(keymap.of([
        { key: "Mod-'", preventDefault: true, run: () => { onRun?.(); return true } },
        { key: 'Mod-Enter', preventDefault: true, run: () => { onSubmit?.(); return true } },
      ])))
    }
    return ext
  }, [language, ariaLabel, onRun, onSubmit])

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      editable={!readOnly}
      readOnly={readOnly}
      height={height}
      theme="none"
      indentWithTab
      basicSetup={{ highlightActiveLineGutter: true, foldGutter: true, autocompletion: true, tabSize: 4 }}
    />
  )
}
