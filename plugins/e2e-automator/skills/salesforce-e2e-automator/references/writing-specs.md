# Writing specs

How a UTAM spec in the template's setup is built: WebdriverIO runs it with Jasmine, the UTAM service provides the `utam` global, page objects come from `salesforce-pageobjects` and the project's `pageObjects/` folder. Follow the conventions of specs that already exist in the project over this page.

## Shape of a spec

```js
import RecordActionWrapper from 'salesforce-pageobjects/global/pageObjects/recordActionWrapper';
import { logInSalesforce } from './utam-helper.js';
import { deleteRecord, getField, openPath, query } from './salesforce-helper.js';

describe('ABC-123 account onboarding', () => {
  const name = `E2E Account ${Date.now()}`;
  let accountId;

  beforeEach(async () => {
    await logInSalesforce();
  });

  afterAll(() => {
    if (accountId) deleteRecord('Account', accountId);
  });

  it('creates an account with its industry from the new record form', async () => {
    await openPath('/lightning/o/Account/new');
    const modal = await utam.load(RecordActionWrapper);
    const form = await modal.getRecordForm();
    const layout = await form.getRecordLayout();

    const nameField = await getField(layout, 'Account', 'Name');
    await (await nameField.getTextInput()).setText(name);

    const industryField = await getField(layout, 'Account', 'Industry');
    const industry = await (await industryField.getPicklist()).getBaseCombobox();
    await industry.expand();
    await industry.selectItemByValue('Energy');

    await form.clickFooterButton('Save');
    await modal.waitForAbsence();

    const [account] = query(`SELECT Id, Industry FROM Account WHERE Name = '${name}'`);
    accountId = account?.Id;
    expect(account?.Industry).toBe('Energy');
  });
});
```

- **Title with the ticket key**, one behaviour per `it`, named as the behaviour.
- **Log in per test** with the template's helper - it checks the session age and waits for Lightning.
- **Navigate by URL** to where the behaviour starts. Click through navigation only when navigation is the behaviour under test.
- **One `const` per page object** the test uses again; `await` every step.
- **Assertions** are Jasmine (`toBe`, `toEqual`, `toContain`, `toBeTrue`, `toBeNull`) - no Jest-only matchers.
- **Data** created in the test is deleted in `afterAll`, also when the test fails before the end.

Every method in this example exists in the page objects at the time of writing - check them with `show` in the project, as with any chain.

## Helpers

Put shared steps into a helper module next to the specs - `force-app/test/utam/salesforce-helper.js` or the project's equivalent - instead of repeating them. The ones most specs need:

### Navigation by URL

```js
/** Opens a path in the org the test is logged in to, e.g. '/lightning/o/Account/new'. */
export async function openPath(path) {
  const { origin } = new URL(await browser.getUrl());
  await browser.navigateTo(`${origin}${path}`);
}
```

Useful paths: `/lightning/o/<Object>/list`, `/lightning/o/<Object>/new`, `/lightning/r/<Object>/<id>/view`, `/lightning/n/<Tab>` for a custom tab, `/lightning/app/<appId>` for an app. If the object has several record types, `/new` first shows the record type selection - `waitForChangeRecordFooter()` on `RecordActionWrapper` handles it.

### Fields by API name

```js
/** The record layout item of a field, once the layout has rendered it. */
export async function getField(recordLayout, objectApiName, fieldApiName) {
  const target = `.${objectApiName}.${fieldApiName}`;
  return utam.waitFor(
    async () => {
      for (const item of await recordLayout.getAllItems()) {
        const field = await item.getTargetField().catch(() => null);
        if (field?.endsWith(target)) return item;
      }
      return null;
    },
    { message: `Field ${objectApiName}.${fieldApiName} is not on the layout` }
  );
}
```

`utam.waitFor` polls until the function returns something truthy, retries when it throws, and fails with the message after the explicit timeout. `getTargetField()` returns the field reference of the layout item, which ends with `<Object>.<Field>` - log it once if a field is not found. A field that is not on the layout for this persona is a finding, not something to work around.

### Data through the CLI

```js
import { execFileSync } from 'node:child_process';

const sf = (...args) =>
  JSON.parse(execFileSync('sf', [...args, '--json'], { encoding: 'utf8', shell: process.platform === 'win32' })).result;

export const query = (soql) => sf('data', 'query', '--query', soql).records;
export const createRecord = (sobject, values) => sf('data', 'create', 'record', '--sobject', sobject, '--values', values).id;
export const deleteRecord = (sobject, id) => sf('data', 'delete', 'record', '--sobject', sobject, '--record-id', id);
```

The CLI talks to its default org - the one `npm run test:ui:generate:login` wrote the login for. Values for `createRecord` use the CLI's syntax: `"Name='E2E Account' Industry=Energy"`. For larger setups, an anonymous Apex script (`sf apex run --file`) or a data plan (`sf data import tree`) is faster than one call per record.

## Waiting

- Prefer the page object's own waits: `waitFor...` methods, methods described as "waits for", `waitForAbsence()` after a modal closes, `waitForVisible()`.
- Need to wait for something the page objects do not offer? First consider a method in a custom page object. In a spec, use `utam.waitFor(fn, { message })` on one concrete condition - not `browser.pause`, not a loop with `try`/`catch` around getters.
- After a navigation or a refresh, element references are stale. Load the root page object again with `utam.load` and walk the chain anew - do not reuse page objects from before the refresh.
- Salesforce hydrates pages lazily. If the first click after loading does nothing, wait for the component to be ready - the waiting method, or a `waitFor` on a property of it - rather than clicking twice.

## Not in a spec

- **`browser.execute` into shadow roots.** It bypasses UTAM, breaks with every DOM change and hides from the linter what the test depends on. The template's example spec fills fields this way; for new tests, use the record layout item by API name as above. If there is truly no other way, keep it in one helper with a comment that says why.
- **CSS selectors** (`$('...')`, `browser.$`). Write or extend a page object instead.
- **Record ids, usernames, URLs of one org.** Query or create them; take the URL from the session.
- **Order dependencies between `it`s.** Each `it` can run alone with `--spec` and a filter.
- **`fit`, `fdescribe`, `xit`** left in by accident - they silently change what CI runs.
