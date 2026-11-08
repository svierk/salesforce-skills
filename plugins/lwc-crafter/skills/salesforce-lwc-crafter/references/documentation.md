# Documentation

A component that others place - admins in the Lightning App Builder, developers in their templates - needs to say how. The collection's convention is a README per component, checked against the source in CI, and published as a catalog. Read the current rules in its `CONTRIBUTING.md` ("Adding a new component") before writing one.

## README

A README in the component folder, in this order:

1. **`# Title`** - the display name, the same as `masterLabel`.
2. **One line** of what it does - the same sentence as `description` in `js-meta.xml` and the JSDoc.
3. **`**Type:**`** directly below that line: `Component`, `Building Block` or `Utility` - see [design.md](design.md#what-kind-of-component).
4. **`**Available in:**`** with the places from the targets: `App Page · Home Page · Record Page · Flow Screen`, or `Not exposed in the Lightning App Builder - intended to be embedded in other components.`
5. **A screenshot**, if the component has a visible UI - see [below](#screenshots-and-teasers).
6. **`## Usage`** with an ` ```html ` snippet that embeds the tag, and what to set.
7. **`## Attributes`** - a table of every `@api` property in kebab-case: name, type, default, description.
8. **`## Events`** - a table of every event it dispatches: name, `detail`, when it fires.
9. **`## Custom Labels`** - a table of the labels the component and the bundles it depends on import, with their values, so whoever copies it can create them.
10. **Dependencies** - other components, Apex classes, static resources, field sets, permissions.

If the project uses the collection's `scripts/check-readmes.mjs` (`npm run lint:readme`), it fails when the type, availability, screenshots, usage snippet, attributes, events or Custom Labels drift from the source - run it after every change to the public API.

## Screenshots and teasers

- **The component, not the page.** An element screenshot at device scale 2, with demo data, taken after every spinner has gone. The collection keeps it as `images/<component>/screenshot.png`, with the README title as its alt text.
- **Previews of a similar size.** Set the image width so that a tall component and a wide one look alike in a catalog: about 400 pixels high at most, and never wider than the image itself.
- **A teaser if the value shows in motion.** One clear action in at most 12 seconds, no sound, a seamless loop. GitHub does not play video files from a repository inside a README, so the README shows an animated `teaser.webp` of at most 3 MB, and a docs site plays `teaser.mp4` or `teaser.webm` with `poster.png`. All of them go next to the screenshot in `images/<component>/`.
- **Twins look like twins.** Two components with the same features - the collection's datatables - get the same click path and the same demo data.
- **Finished files only.** The page that places components for a capture stays in the org, and the capture scripts stay out of the repository. The Demo Designer records them, if it is installed.

## In the code

- **JSDoc on the class** with a one-line description and an `@example` of the tag - as every component of the collection has.
- **JSDoc on every `@api` property**: description, `@type`, `@default`, `@example` where the format is not obvious.
- **Comments that explain why**, not what - a workaround names the reason and, if there is one, the ticket.

## In the metadata

- **`masterLabel` and `description`** in `js-meta.xml` - what admins see in the builder.
- **Every `targetConfig` property** with `label`, `description` and a `default` that matches the JavaScript default.

## When the public API changes

Update README, JSDoc and `js-meta.xml` in the same change, and say in the handover whether existing placements are affected: a renamed property loses its configured value on every page that uses it, and a removed target breaks deployments of pages that still place the component there. A builder property cannot be removed either while the component sits on any Lightning page, even one that never set it: the deployment fails until the component is taken off those pages. Expose only properties you mean to keep.
