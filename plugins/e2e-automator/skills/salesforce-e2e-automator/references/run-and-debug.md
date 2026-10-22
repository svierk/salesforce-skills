# Run and debug

Compile, run, watch and read a UTAM test in the template's setup. The npm scripts are the template's; if the project named them differently, use its names.

## The loop

```bash
npm run test:ui:compile                                     # after every change to a .utam.json
npm run test:ui -- --spec force-app/test/utam/<name>.spec.js
npm run test:ui -- --spec <spec> --jasmineOpts.grep "<part of an it title>"
```

The login needs no step of its own if `wdio.conf.js` fetches it in a `beforeSession` hook, as the template does: the CLI's frontdoor URL logs in only once, and every spec file runs in a new browser session. Projects from an older copy of the template generate it into `.env` before the run instead - see [the org](#the-org).

Run one spec, not the suite, while you work on a test. Run the suite before you hand over, and the spec twice in a row - a test that passes once and fails once is not done.

## Compiler and linter

- **Compiler errors** name the file, the element or method, and an error code. The grammar reference has a page per topic and a page of error codes ([sources.md](sources.md)).
- **The linter** writes `utam-lint.sarif` after every compile. Read the findings without a viewer:

  ```bash
  node -e "const s=JSON.parse(require('fs').readFileSync('utam-lint.sarif','utf8')); for (const r of s.runs.flatMap(r=>r.results??[])) console.log(r.level, r.ruleId, r.message.text, r.locations?.[0]?.physicalLocation?.artifactLocation?.uri ?? '')"
  ```

## The org

The tests log in to the CLI's **default org**. To test another org, set it for the command only - the project's default stays as it is for everything else the user does:

```bash
SF_TARGET_ORG=<alias> npm run test:ui -- --spec <spec>   # the login and helpers that call sf inherit it
```

Without the `beforeSession` hook, the login comes from `.env`, written by `npm run test:ui:generate:login` - with the same `SF_TARGET_ORG` prefix, before every run. Only the first spec file of a run gets in with it; offer the hook from the template's `wdio.conf.js`. Older copies of the login script also give up on any CLI warning - an available update is enough - yet exit successfully and leave the old `.env` behind. Check that the login really is new:

```bash
npm run test:ui:generate:login >/dev/null
node -e "require('dotenv').config({quiet:true}); console.log(Date.now() - Number(process.env.SALESFORCE_LOGIN_TIME) < 60000 ? 'login is new' : 'login NOT refreshed')"
```

Never change the default with `sf config set target-org` for a test run. The org check in the orientation applies to every org you test against.

Never print `.env` or the URL - it logs in without a password. Older copies of the login script print the URL they write, so discard the script's standard output as above; errors still reach the terminal. With `logLevel: 'debug'` in `wdio.conf.js`, the run log shows the navigation to that URL as well - quote errors from a run log, never the whole log.

## Watch the browser

The template runs Chrome headless. To see what happens:

- **Visible browser.** Offer a switch in `wdio.conf.js` instead of editing it for every run, then run with `HEADED=true`:

  ```js
  args: process.env.HEADED ? ['--window-size=1920,1080'] : ['--headless=new', '--window-size=1920,1080']
  ```

- **Pause and inspect.** `DEBUG=true` raises the template's wait timeouts to 30 minutes. Put `await browser.debug();` where the test should stop, run headed, and inspect the page with Chrome's developer tools - the tag names you see are what page object selectors and `search` work with.
- **Screenshot.** `await browser.saveScreenshot('./artifacts/<name>.png')` at the point of interest, or the `afterTest` hook from [setup.md](setup.md#the-ci-job) for every failure.

You cannot see the user's screen. When a headed run is needed, ask the user to run it and describe or screenshot what they see.

## Reading errors

| The output says                                                                          | What it means                                                                                           | Next step                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Missing SALESFORCE_LOGIN_URL` / `session timed out`                                     | No login, or an old one - also right after generating one, if the login script gave up on a CLI warning | The `beforeSession` hook, or generate the login and check its age - [the org](#the-org)                                                                                        |
| `Login stopped at /ChangePassword` or `/_ui/identity/`, `Did not reach a Lightning page` | The login did not end in Lightning                                                                      | The user completes the screen once in a browser - a password change, identity verification, phone registration. Otherwise: headed run or screenshot - API-only user, wrong org |
| Only the first spec file logs in; later ones fail at login                               | The frontdoor URL works once; each spec file opens a new browser session                                | Fetch the URL per session in `beforeSession`, as the template's `wdio.conf.js` does                                                                                            |
| `utam is not defined`                                                                    | The UTAM service is not loaded                                                                          | `services` in `wdio.conf.js`                                                                                                                                                   |
| `Cannot find module` for `pageObjects/...`                                               | Not compiled, wrong import path, or the alias in `utam.config.js`                                       | Compile; check the relative path from the spec; alias as in [setup.md](setup.md)                                                                                               |
| An element or selector that cannot be found                                              | The chain is wrong for this page, or the element has not rendered yet                                   | Use the waiting method, or check the chain against the page - [salesforce-page-objects.md](salesforce-page-objects.md#when-the-page-object-and-the-page-disagree)              |
| `Timeout while waiting for condition after ...ms`                                        | A wait never became true; the message ends with the last error the condition threw                      | Read that last error - it usually names the real problem                                                                                                                       |
| `stale element reference`                                                                | The page or component re-rendered after you got the reference                                           | Load the root page object again and walk the chain anew                                                                                                                        |
| `Async function did not complete within ...ms`                                           | The whole test exceeded Jasmine's timeout - often a step waiting without a timeout                      | Find the hanging step; do not just raise the timeout                                                                                                                           |
| `This version of ChromeDriver only supports Chrome version ...`                          | Browser and driver out of step                                                                          | Update Chrome or the `@wdio/*` packages                                                                                                                                        |
| `Expected ... to be ...`                                                                 | The application did something else than the test expects                                                | Compare with the test plan. A defect, a data problem or a wrong read - never "fix" it by changing the expected value without the user                                          |
