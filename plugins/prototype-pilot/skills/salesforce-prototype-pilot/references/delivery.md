# Delivery

A prototype is finished when someone else can open the repository, understand what it shows, run it and know which assets they may use.

## Repository

- **Private** for anything in a customer's brand. Settings like the user's other demo repositories (see [build.md](build.md#start)).
- Commits and pull requests in the **user's name**; follow their attribution rules (some users want no co-author trailer).
- **Large images:** pushes of several megabytes over HTTPS can fail with `HTTP 400` / "RPC failed". Raise the buffer for that repository - `git config http.postBuffer 157286400` - and push again.
- Keep `node_modules`, `dist` and build info out of Git; keep licensed fonts out until the user said yes.

## README

In this order:

1. Title and one paragraph: what the prototype is, for whom, that it runs without an org and shows the Salesforce records behind each screen.
2. A demo-only note: fictitious people and data, estimated values marked, photo and font credits.
3. **The preview image** - `proto-check.mjs preview` with 4-5 key screens and short captions, saved as `docs/preview.jpg` (around 2400 px wide, under 1 MB).
4. What the demo shows - a table by area.
5. Presenter features and deep links.
6. Run: `npm install`, `npm run dev`, `npm run build`.
7. Structure, briefly.
8. **Brand assets** - asset, source, rights or licence note.
9. **Path to a real implementation** - per area, what replaces the mock data ([salesforce-mapping.md](salesforce-mapping.md#the-readmes-path-to-a-real-implementation)).

Regenerate the preview after visible changes; an outdated preview is the first thing people notice.

## Hand-over message

Short, in the user's language: the repository link, how to start it (`npm run dev`, phone in the same network), the deep links worth knowing for the presentation, what is real (photos, figures, sources) and what is demo content, open decisions (rights, assets still missing), and what was checked (`shots`, `flow`, window sizes).

## Follow-ups worth offering

- A demo video or README GIF of the prototype - the Demo Designer records it along the deep links.
- The same prototype in another language or for another brand - brand, data and replies change, the shell stays.
- Turning it into a real app on an org - the Multi-Framework Wizard takes the screens to a React UI bundle on Salesforce data.
