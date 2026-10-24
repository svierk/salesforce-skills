# Styling and accessibility

How a component looks like Lightning in every theme - light, dark, SLDS 1 and SLDS 2 - and works for everyone, with a mouse, a keyboard or a screen reader.

## Styling

**Base components and SLDS classes first.** A `lightning-card`, `lightning-button` or `lightning-layout` already looks right in every theme. SLDS utility classes in the template are fine: `slds-grid`, `slds-text-heading_small`, and the `slds-var-*` spacing classes, which follow the user's density setting.

**What your CSS may style:** the component's own elements, through classes of its own and `:host` for the component itself. Its styles stay inside the shadow tree.

**What it may not** - Salesforce does not support it, and it breaks with SLDS or base component updates:

- **SLDS classes** - changing `.slds-button_brand` or any other `.slds-*` selector.
- **The inside of a base component** - `.my-wrapper .slds-combobox__input` reaches into its rendered markup. Use the styling hooks the component documents.
- **Generated class names or attributes** of the LWC engine.
- **`!important`** - a fight with SLDS that a class of your own or a styling hook wins cleanly.

**Colors, spacing, fonts, borders through global styling hooks** (`--slds-g-*`), with a fallback value:

```css
.summary {
  color: var(--slds-g-color-on-surface-2, #2e2e2e);
  padding: var(--slds-g-spacing-3, 0.75rem);
  border-radius: var(--slds-g-radius-border-2, 0.25rem);
}
```

**Pick the hook by its SLDS 1 value.** The global hooks are defined in SLDS 1 orgs too, partly with other values than in SLDS 2 - `--slds-g-radius-border-1` is smaller in SLDS 1, for example. When a fixed value becomes a hook, take the hook whose SLDS 1 value equals it and keep that value as fallback: the component looks the same in SLDS 1 and follows the theme in SLDS 2. The SLDS Linter suggests hooks by their SLDS 2 value, so check its suggestion. Both values of every hook are in the `@salesforce-ux/sds-metadata` package, which the linter installs: `current/globalStylingHooks.metadata.json`, fields `values.slds` and `values.cosmos`. For colors, pick the hook by its role - border, surface, accent, text - and take its SLDS 1 value as fallback.

- **Fixed colors** (`#fff`, `rgb(...)`) ignore the theme and break dark mode. The exception is a surface that has to stay light or dark in every theme, such as the background of a QR code, a canvas with a black pen, or a text overlay on an image - keep its color, with a comment that says why.
- **Layout sizes** (`100%`, the height of a chart or canvas) stay as they are, even where the linter suggests a sizing hook with a similar value.
- **SLDS 1 design tokens** (`--lwc-colorBorder`, `--lwc-borderWidthThin`) do not exist in SLDS 2.
- **Component-level hooks** (`--slds-c-*`) only as the base component documents them for SLDS 2. Several SLDS 1 names were renamed; the SLDS Linter reports the old ones.

Look up the hook names on `lightningdesignsystem.com` - do not invent them. The SLDS Linter checks CSS and templates for SLDS 2 and fixes much of it:

```bash
npx @salesforce-ux/slds-linter lint force-app/main/default/lwc/<component>
npx @salesforce-ux/slds-linter lint force-app/main/default/lwc/<component> --fix
```

The Salesforce Code Analyzer runs the same rules in its ESLint engine, tagged `SLDS`. A `code-analyzer.yml` that turns the engine off drops them too; to avoid duplicate JavaScript findings next to the project's own ESLint, turn off the engine's JavaScript and LWC base configs instead.

**Layout:** `lightning-layout` or SLDS grid classes, responsive with the `slds-*-size_*` classes or a media query. Logical properties (`margin-inline-start`, `padding-block`) instead of left and right work in right-to-left languages too.

## Accessibility

Base components handle most of this; custom markup has to do it on its own. The rules that catch most problems:

- **Native elements for what they are.** A `button` for actions, an `a` with `href` for navigation, `ul`/`li` for lists, `table` with `th` for tables, headings in order. A `div` with `onclick` is invisible to keyboards and screen readers.
- **Everything clickable works with the keyboard** - reachable with Tab, triggered with Enter or Space, with visible focus. Drag and drop needs a keyboard alternative.
- **Every input has a label** - `label` on base components even with `variant="label-hidden"`, which keeps it for screen readers.
- **Every icon or image that carries meaning has a text alternative** - `alternative-text` on `lightning-icon` and `lightning-button-icon`, `alt` on `img` (`alt=""` for decoration).
- **Color is never the only signal** - an error is red and says "Error".
- **Changes are announced** - an error message near the field, `aria-live` for content that updates without a page change, focus moved into a modal and back.
- **Contrast** - text at least 4.5:1 against its background; the styling hooks have it built in, custom colors need checking.

Check it twice:

- **Automated:** `await expect(element).toBeAccessible()` in Jest with `@sa11y/jest` - the collection asserts it in every component's tests. It finds missing labels, roles and alternative texts; it cannot judge keyboard flows or contrast in the real theme.
- **By hand:** ask the user to use the component with the keyboard only, and with a screen reader where the component is central to someone's work.

## Localization

- User-facing text in Custom Labels; numbers, dates and currencies through `lightning-formatted-*` components or `@salesforce/i18n` - see [design.md](design.md#text-and-languages).
- No layout that only works for English text lengths - German labels are often a third longer.
- Right-to-left languages: logical CSS properties, and SLDS classes that follow the direction.
