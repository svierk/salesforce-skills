# Documentation

A component that others place - admins in the Lightning App Builder, developers in their templates - needs to say how. The collection's convention is a README per component, checked against the source in CI, and published as a catalog. Read the current rules in its `CONTRIBUTING.md` ("Adding a new component") before writing one.

## README

A README in the component folder, in this order:

1. **`# Title`** - the display name, the same as `masterLabel`.
2. **One line** of what it does - the same sentence as `description` in `js-meta.xml` and the JSDoc.
3. **`**Available in:**`** with the places from the targets: `App Page · Home Page · Record Page · Flow Screen`, or `Not exposed in the Lightning App Builder - intended to be embedded in other components.`
4. **A screenshot**, if the component has a visible UI.
5. **`## Usage`** with an ` ```html ` snippet that embeds the tag, and what to set.
6. **`## Attributes`** - a table of every `@api` property in kebab-case: name, type, default, description.
7. **`## Events`** - a table of every event it dispatches: name, `detail`, when it fires.
8. **Dependencies** - other components, Apex classes, static resources, field sets, permissions.

If the project uses the collection's `scripts/check-readmes.mjs` (`npm run lint:readme`), it fails when the attributes, events or availability drift from the source - run it after every change to the public API.

## In the code

- **JSDoc on the class** with a one-line description and an `@example` of the tag - as every component of the collection has.
- **JSDoc on every `@api` property**: description, `@type`, `@default`, `@example` where the format is not obvious.
- **Comments that explain why**, not what - a workaround names the reason and, if there is one, the ticket.

## In the metadata

- **`masterLabel` and `description`** in `js-meta.xml` - what admins see in the builder.
- **Every `targetConfig` property** with `label`, `description` and a `default` that matches the JavaScript default.

## When the public API changes

Update README, JSDoc and `js-meta.xml` in the same change, and say in the handover whether existing placements are affected: a renamed property loses its configured value on every page that uses it, and a removed target breaks deployments of pages that still place the component there.
