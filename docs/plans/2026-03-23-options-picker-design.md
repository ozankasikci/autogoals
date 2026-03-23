# Interactive Options Picker for Chat Panel

## Overview
Replace plain-text A/B/C options in agent interview messages with clickable interactive buttons rendered inline in the chat bubble.

## Agent Output Format
Agent outputs a fenced code block with language `options`:
```
```options
{
  "mode": "single",
  "options": [
    {"id": "A", "label": "Directional Light Shader", "description": "Dot-product lighting with dramatic shadows"},
    {"id": "B", "label": "Fresnel-style Shader", "description": "Cel-shaded toon outline effect"}
  ]
}
```
```

- `mode`: `"single"` (click sends immediately) or `"multi"` (checkboxes + submit)
- `description`: optional — shown as smaller text under the label

## Component: OptionsPicker

### Props
- `options`: array of `{id, label, description?}`
- `mode`: `"single" | "multi"`
- `onSelect`: callback with selected option text(s)
- `disabled`: boolean (true after selection made)

### Behavior
- **Single mode**: click an option → sends immediately, disables all
- **Multi mode**: checkboxes on each, "Submit" button when 1+ selected
- **Custom text**: input at bottom "Or type your own..." with send button
- **After selection**: all options stay visible, selected highlighted with border/bg, unselected dim to 40% opacity, custom input disappears, no longer interactive

### Message Sent Format
- Single: `"A) Directional Light Shader"`
- Multi: `"A) Directional Light Shader, C) Color/Emoji Gradient"`
- Custom: whatever the user typed

## Files

### New
- `packages/dashboard/src/components/OptionsPicker.tsx`

### Modify
- `packages/dashboard/src/components/ChatPanel.tsx` — detect ```options blocks in MarkdownMessage, render OptionsPicker instead of code block
- `packages/api/src/agent-manager/manager.ts` — update interview prompt to use ```options format
