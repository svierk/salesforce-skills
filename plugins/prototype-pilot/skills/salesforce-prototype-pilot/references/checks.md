# Checks

`scripts/proto-check.mjs` looks at a running prototype through the installed Google Chrome and its DevTools protocol - no packages to install. Copy it next to the prototype or run it from the skill folder; the prototype must be running (`npm run dev`).

## Commands

| Command   | Does                                                                                                                         | Key options                                                                                        |
| --------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `shots`   | Loads every deep link fresh, crops the phone at 2x, screenshots the desktop at each window size, and reports layout findings | `--views a,b,c` · `--desktop 1920x1080,1440x900,1280x720` · `--out shots` · `--settle 2200`        |
| `flow`    | Runs a click path from JSON and reports each step                                                                            | `--steps flow.json` · `--size 1600x1100` · `--out shots`                                           |
| `preview` | Composes the README preview: logo, title, subtitle, phone crops with captions                                                | `--views` · `--captions` · `--title` · `--subtitle` · `--logo file.svg` · `--out docs/preview.jpg` |

Selectors default to the starter's markup (`.phone`, `.inspector`, `.desk-bar`, `.viewport`); `--phone`, `--panel`, `--header` change them. `CHROME_PATH` points to another browser binary. The exit code is 1 when a finding or a step fails.

Run `shots` with **every deep link** and three window sizes - a large monitor, a laptop (1440x900) and a projector (1280x720). Then **look at the images**: the script finds geometry problems, not taste problems.

## Flow format

A JSON array, one action per step:

```json
[
  { "click": "Accept invitation" },
  { "wait": 2000 },
  { "click": "Turn on Face ID", "after": 3000 },
  { "expect": "days until your handover" },
  { "goto": "advisor/chat" },
  { "type": { "selector": ".composer input", "text": "How do I charge at home?", "submit": true }, "after": 4500 },
  { "expect": "90 minutes" },
  { "shot": "chat-answer" }
]
```

`click` finds a visible button, link or label by its text; `after` waits in milliseconds after a click or type. `expect` looks for text on the page - use it after every scripted reply and status change. Keep the flow next to the prototype (`checks/flow.json`) so every change can re-run it.

## Findings and their fixes

| Finding                           | Cause                                                                                | Fix                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| the header overlaps the phone     | Desktop chrome with `position: fixed` or absolute, outside the layout                | Put it in the flow: a header row above the phone and panel                 |
| the phone does not fit the window | Stage scaled with `transform: scale` - the layout box keeps its full size            | Scale the stage with `zoom` in height media queries                        |
| the phone overlaps the data panel | Fixed widths without room, or a transform                                            | Flex row with a gap; panel hidden below a breakpoint                       |
| content is wider than the phone   | A grid column grown by a long word, an image without `width: 100%`, negative margins | `minmax(0, 1fr)` columns, `min-width: 0` on flex children, images at 100 % |
| image did not load                | Wrong path, or a path without the base URL                                           | Build image paths with `import.meta.env.BASE_URL`, as `brand.ts` does      |
| no element matches .phone         | Different markup, or the app crashed on that deep link                               | Pass `--phone`; open the deep link in a browser and read the console       |

## Pitfalls the script cannot see

- A screen shorter than the phone: `min-height: 100%` without a parent height does nothing - the starter wraps screens in a flex column for that.
- Text over the product in a photo, or an accent colour that disappears on a bright sky.
- A placeholder left in a gallery, a sample name ("Meridian") left in a text.
- A toggle or control that sits on top of the photo it switches.
- A dark logo on a dark header after a rebrand.
- A chat reply that does not match the question the presenter will type.

## Visual review before hand-over

Look at each phone crop and at least one desktop shot: brand and logo right, photos sharp and on topic, no placeholders, no sample brand left, text readable on every photo, the panel's names plausible, the main click path green.
