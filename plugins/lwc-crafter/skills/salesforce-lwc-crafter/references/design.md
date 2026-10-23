# Design

What to decide before the first line of code: whether a component is needed at all, where its boundaries are, and the contract it offers - the part other people build against and that is expensive to change later.

## Reuse before you build

Go down the list and stop at the first step that covers the need:

1. **Standard feature.** Dynamic Forms, related lists, list views, path, Flow screens with standard components, quick actions with a page layout. A requirement that a standard feature covers needs configuration, not code - say so, even when the user asked for a component.
2. **Base component.** `lightning-record-form`, `lightning-datatable`, `lightning-combobox`, `lightning-dual-listbox`, `lightning-file-upload`, `lightning-map`, `lightning/modal` and the rest of the Component Reference - accessible, styled, maintained by Salesforce. Check its attributes in the reference before deciding it does not fit.
3. **The collection.** Search its catalog ([sources.md](sources.md#the-catalog)) - a configurable datatable over a field set or GraphQL, a multi-select combobox, file tables, maps, signature capture, QR codes, an org chart, PDF helpers and more.
4. **Salesforce recipes.** `lwc-recipes` shows the pattern for most single concepts.
5. **Build it** - small, with a contract designed below.

**Copying from the collection.** Take the whole unit: the bundle, its `__tests__` folder with the data files, the README, the Apex classes with their test classes, static resources, field sets and every component it imports. Keep the name unless it clashes. Then run the checker on the copy and fix what it reports there, adjust labels and texts to the project, and run the tests. A copied component without its tests is a component nobody can change safely.

## Boundaries

- **One job per component.** A container gets the data, holds the state and handles saves; presentational children get properties and send events. That split is what makes children reusable and easy to test.
- **Size is a signal.** The collection's ESLint limits - 500 lines per file, 50 per function - are where a component asks to be split, not a target to reach.
- **Shared logic in a service module** - a bundle with only a JavaScript file and `isExposed` false, imported as `c/<name>` - like the collection's `datatableUtils`. Not copied into each component.
- **Extend a base component only where it is designed for it** - `lightning-datatable` takes custom types by extension (see the collection's `datatableExtension`). Do not wrap a base component just to restyle it.

## Names

- Folder and files in camelCase, starting lowercase: `orderSummary/orderSummary.js`. The tag is the kebab-case form: `<c-order-summary>`.
- Every capital letter becomes a hyphen in the tag. Avoid runs of capitals and single-letter words: the collection's `render3DElementsThreeJS` becomes `<c-render3-d-elements-three-j-s>`.
- Name it for what it is (`orderSummary`), not for where it is used (`accountPageRightColumn`).

## Public API

Public properties and methods are a contract - with parent components, with admins in the Lightning App Builder, with Flow builders.

- **`@api` properties** with a sensible default and a JSDoc comment: what it does, type, default, example - the collection documents every one this way.
- **Booleans default to `false`** and are named for the non-default case - an attribute that is present means `true`, so `hide-checkbox-column` works and `show-header="false"` does not.
- **The parent owns `@api` properties.** Do not reassign them inside the component. To normalise or derive, use a getter and setter with a private field - the collection's `customCarousel` accepts its slides as an array or as a JSON string from the App Builder that way.
- **Public methods** (`@api focus()`, `@api validate()`) only where a parent must trigger something. Everything else is a property or an event.
- **Objects and arrays from outside are read-only.** Copy before you change them.

## Events and communication

| From → to                            | Use                                                                                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Parent → child                       | `@api` properties; `@api` methods for actions                                                                                         |
| Child → parent                       | `CustomEvent` dispatched by the child, handled with `on<name>` in the parent's template                                               |
| Between siblings                     | Through the common parent                                                                                                             |
| Components without a common template | Lightning Message Service (`lightning/messageService`) with a message channel; or a state manager where the org's release supports it |
| Component → Flow                     | `FlowAttributeChangeEvent` and `FlowNavigationNextEvent` from `lightning/flowSupport`                                                 |
| Component → quick action             | `CloseActionScreenEvent` from `lightning/actions`                                                                                     |

Event rules:

- **Names** in lowercase letters, digits and underscores, without an `on` prefix: `statuschange`, `row_selected`.
- **`detail`** carries a plain, copied value - never an internal object the listener could change. Primitive values or a small object built for the event.
- **Default propagation.** No `bubbles`, no `composed`, unless a grandparent in the same template needs it (`bubbles: true`). `composed: true` makes the event part of every ancestor's API across shadow boundaries; use it only when that is the point.
- **Document every event** - name, `detail`, when it fires - in JSDoc and in the README.

Lightning Message Service: subscribe in `connectedCallback`, unsubscribe in `disconnectedCallback`, get the context with `@wire(MessageContext)`. Never the old `pubsub` module.

## Where it runs

`js-meta.xml` decides where admins can place the component. Read the target names and their options in "XML Configuration File Elements" ([sources.md](sources.md#documentation)) before writing them.

- **Targets** only for places the component really works in. A component that needs `recordId` does not belong on a home page.
- **Record pages** set `@api recordId` and `@api objectApiName` themselves.
- **`targetConfigs`** expose properties to the builder, each with `label`, `description` and a `default` that matches the JavaScript. Types follow the JavaScript (`String`, `Integer`, `Boolean`). `datasource` turns a `String` property into a picklist of allowed values; `supportedFormFactors` limits a target to desktop or phone.
- **Flow screens** - properties with `role="inputOnly"` or `role="outputOnly"` where only one direction makes sense; tell Flow about output changes with `FlowAttributeChangeEvent`; an `@api validate()` method returning `{ isValid, errorMessage }` lets Flow block navigation.
- **Quick actions** - `lightning__RecordAction` with `actionType` `ScreenAction` (a modal with your component) or `Action` (headless, `@api invoke()`).
- **Experience Cloud and mobile** have their own targets and limits - guest users, no Lightning Experience navigation, smaller screens, offline. Ask early whether either is in scope.
- **`masterLabel` and `description`** are what admins read in the builder. `apiVersion` is the project's `sourceApiVersion` for new components.

## Text and languages

- **User-facing text in Custom Labels** (`import LABEL from '@salesforce/label/c.Order_Summary_Title'`) when the org has more than one language, or might. One label per sentence - never glue translated fragments together.
- **Numbers, dates, currencies** with `lightning-formatted-number`, `lightning-formatted-date-time` and their siblings, or `@salesforce/i18n/*` for locale, currency and time zone.
- **Labels of fields and objects** come from the schema (`getObjectInfo`), not from strings in the component.
