# Maintenance

Keeping a UTAM suite alive: classifying failures, following Salesforce releases, and reviewing what makes a suite fragile.

## Failure classes

Name the class before fixing anything - each has a different place to fix and often a different owner.

| Class                           | Signs                                                                                                 | Fix in                                                                         | Owner                   |
| ------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------- |
| **Setup or session**            | Fails at login or before the first page object; every spec fails the same way                         | `.env`, the login helper, the test user, CI secrets                            | Whoever runs the tests  |
| **Page object chain**           | Element not found at a specific step, on every run                                                    | The spec's chain, or the custom page object                                    | Test author             |
| **Timing**                      | Fails sometimes, at different steps; passes headed or on a rerun                                      | A wait in the page object or one `utam.waitFor` in the spec                    | Test author             |
| **Component changed**           | A custom page object's selector no longer matches after a change to the LWC                           | The component's `__utam__` page object, in the same pull request as the change | Developer of the change |
| **Salesforce release**          | Standard UI steps break after the org was upgraded; custom components unaffected                      | `salesforce-pageobjects` version and the chains that moved                     | Test author             |
| **Data or configuration drift** | A record, field, picklist value, record type or permission the test relies on is missing or different | Test data setup, or the org's configuration                                    | Admin or test author    |
| **Defect**                      | The application does something else than the acceptance criteria say                                  | The application - the test stays red                                           | Developer               |

For a defect, report the steps, the expected and the actual result, and the evidence (assertion message, screenshot, query result). Do not skip, `xit` or loosen the test to make the run green; if the team wants to accept the known failure for now, that is their call, recorded with the ticket of the fix.

## Salesforce releases

Salesforce upgrades every org three times a year; sandboxes on a preview instance get the release weeks before production. The page objects follow:

```bash
npm view salesforce-pageobjects dist-tags --json     # versions per release
npm view salesforce-pageobjects readme | head -20    # compatible wdio-utam-service range
sf org display --json                                # apiVersion: the org's release
```

Each release adds one API version. Map the org's version to its release name, and compare with the release in the dist-tags. If no page objects for the org's release are published yet, stay on the latest version and expect the differences to show up in Lightning Experience chains - say so to the user rather than guessing a version.

Upgrade on a branch:

1. Install the version for the release, with the `utam` and `wdio-utam-service` versions its README names - all three in one change.
2. **Compile.** Custom page objects that use a Salesforce page object as `type` fail here when it was renamed or removed.
3. **Run the whole suite** against an org on that release - a preview sandbox before the production upgrade is the early warning the release cycle allows.
4. **Repair what moved.** For each failing chain, compare the page object sources of the two versions:

   ```bash
   mkdir -p /tmp/po-old && npm pack salesforce-pageobjects@<old version> --pack-destination /tmp/po-old
   tar -xzf /tmp/po-old/*.tgz -C /tmp/po-old
   diff /tmp/po-old/package/dist/<folder>/<name>.utam.json node_modules/salesforce-pageobjects/dist/<folder>/<name>.utam.json
   ```

   Use the scratchpad directory of the session instead of `/tmp` where one exists.

5. Hand over the upgrade as one pull request: versions, repaired chains, and anything that still fails, classified.

## When a component changes

A custom page object belongs to its component: a change to the component's markup that breaks a selector should change the page object in the same pull request. To find the specs a component's page object affects:

```bash
grep -rln "pageObjects/<component>" force-app/test
grep -rln "utam-sfdx/pageObjects/<component>" --include="*.utam.json" force-app
```

Run those specs before the pull request is merged. Suggest the team makes this visible - for example a CODEOWNERS entry for `**/__utam__/**`, or the UI test job on pull requests that change components.

## Review checklist

Ranked by how often each item breaks a run. A quick first pass:

```bash
grep -rnE "browser\.(execute|pause)|shadowRoot|querySelector|browser\.\\\$|[^.\w]\\\$\(" force-app/test
grep -rnE "get(Section|Row|Item|Column)\([0-9]|\[[0-9]+\]\.|pickItem\([0-9]" force-app/test
grep -rnE "['\"][a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?['\"]|\.my\.salesforce\.com|\.lightning\.force\.com" force-app/test
grep -rnE "\b(fit|fdescribe|xit|xdescribe)\(" force-app/test
git ls-files .env pageObjects utam-lint.sarif
```

Then read every spec and custom page object for:

1. **Assertions** - an `it` without `expect`; only a toast checked where the story is about data; `toBeTruthy()` on a value that should be compared; expected values that no longer match the acceptance criteria.
2. **DOM access around page objects** - `browser.execute` into shadow roots, CSS selectors in specs.
3. **Time instead of conditions** - `browser.pause`, sleeps, retry loops with `try`/`catch` around getters.
4. **Position instead of identity** - fields by section and row index, list items by index, picklist values by position.
5. **Org-specific values** - record ids, usernames, instance URLs.
6. **Data** - no cleanup, fixed names that collide, tests that rely on records someone else created.
7. **Independence** - `it`s that only pass in order; focused or skipped tests left in.
8. **Custom page objects** - specs using public elements where a method should exist, missing waits, `root: true` on components that are not roots, selectors on SLDS utility classes, missing descriptions, open linter warnings.
9. **Setup** - the alias, the login per browser session, `.forceignore` and `.gitignore` items from [setup.md](setup.md); page objects older than the org's release; a `wdio-utam-service` outside the range of `salesforce-pageobjects`; `.env` tracked in Git.

Report findings ranked, each with file, line, why it breaks and the fix. End with what is already good, so the user knows what not to touch.

## Coverage

Ask which business processes would hurt most if they broke - usually a handful: lead to opportunity, quote to order, case handling, an approval. List each with the specs that cover it and the steps they leave out. Suggest the next test by risk and by how often the process changes, not by the number of tests.
