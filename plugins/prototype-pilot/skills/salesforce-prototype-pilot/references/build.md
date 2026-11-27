# Building on the starter

The [Salesforce Prototype Starter](https://github.com/svierk/salesforce-prototype-starter) is a template repository: Vite, React and TypeScript, no backend, no UI library. Read its README for the current structure - it is the source of truth; this page says how to work with it.

## Start

```bash
gh repo create <owner>/<name> --private --template svierk/salesforce-prototype-starter --clone
cd <name> && npm install && npm run dev
```

- Then align the repository with the user's other demo repositories when they name one: `gh repo view <owner>/<repo> --json description,hasWikiEnabled,hasIssuesEnabled,hasProjectsEnabled,mergeCommitAllowed,squashMergeAllowed,rebaseMergeAllowed,deleteBranchOnMerge` and apply the same with `gh repo edit`.
- No `gh` or no network: `git clone` the starter, delete `.git`, `git init`.
- Remove what the customer does not need right away (a screen, the onboarding) - less to adapt, less to check.

## What lives where

| Change                                                      | File                                                |
| ----------------------------------------------------------- | --------------------------------------------------- |
| Brand name, product, edition, image slots                   | `src/brand/brand.ts`                                |
| Colours, font, headline width                               | `src/brand/theme.css` (tokens, `@font-face`)        |
| Logo                                                        | `src/brand/Logo.tsx`; app icon in `public/icon.svg` |
| Records (Account, Asset, Case, chat…)                       | `src/data/records.ts`                               |
| Guides as Knowledge articles                                | `src/data/knowledge.ts`                             |
| Data panel: screen → records, API, SOQL                     | `src/data/inspector.ts` (`blocksFor`, `JUMPS`)      |
| Tabs and screen routing                                     | `src/App.tsx` (`TABS`, `Screen`)                    |
| View types, deep links, scripted replies, request lifecycle | `src/store.tsx`, `advisorReply` in `records.ts`     |
| Screens                                                     | `src/screens/*.tsx`                                 |
| Layout and components                                       | `src/styles.css` - change only for new patterns     |

## Screens

- **Rename before rewriting.** The sample tabs (Home, asset, guides, advisor) cover most customer apps: rename the tab, the screen and the view type (for example `asset` → `vehicle`, `advisor` → `ambassador`) and change the content.
- **New screen:** add the view to the `View` type and `fromHash` in `store.tsx`, route it in `App.tsx`, add a block to `inspector.ts` and a jump to `JUMPS`, and a deep link to the check list.
- **Patterns in the starter**, reuse them before writing new ones: hero photo with overlay, journey timeline with countdown, tiles, list rows with swatches and codes, headline stats, accordion spec table, photo stage with view switch, gallery with lightbox, search with category chips, article with notes and warnings, chat with typing indicator and quick replies, bottom sheet with options, request cards with a status bar, toasts, onboarding with invitation, OTP and biometric step.
- **Language.** All UI text in the customer's language, including dates (`toLocaleDateString` with the locale), scripted replies and the panel's labels.
- **Dates.** The starter fixes "today" (`DEMO_TODAY`) so countdowns and screenshots stay stable; set it to the presentation day.
- **Scripted replies.** Keyword rules in the customer's language for the questions the audience will ask; a polite default for everything else.

## Presenting

- **Laptop:** the phone and the panel side by side; the presenter tab jumps between screens and resets the demo; deep links (`#asset/specs`) work in the URL.
- **Phone:** `npm run dev` binds to the network; open the shown address on a phone in the same Wi-Fi and add it to the home screen - it runs full screen like an app.
- **Hosting:** neutral material can go to GitHub Pages; a prototype in a customer's brand stays local or on private hosting.
