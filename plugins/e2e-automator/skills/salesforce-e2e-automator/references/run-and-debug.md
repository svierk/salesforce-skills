# Run and debug

Compile, run, watch and read a UTAM test in the template's setup. The npm scripts are the template's; if the project named them differently, use its names.

## The loop

```bash
npm run test:ui:compile                                     # after every change to a .utam.json
npm run test:ui:generate:login >/dev/null && test -s .env  # before a run, if the last login is older than about 2 hours
npm run test:ui -- --spec force-app/test/utam/<name>.spec.js
npm run test:ui -- --spec <spec> --jasmineOpts.grep "<part of an it title>"
```

Run one spec, not the suite, while you work on a test. Run the suite before you hand over, and the spec twice in a row - a test that passes once and fails once is not done.

## Compiler and linter

- **Compiler errors** name the file, the element or method, and an error code. The grammar reference has a page per topic and a page of error codes ([sources.md](sources.md)).
- **The linter** writes `utam-lint.sarif` after every compile. Read the findings without a viewer:

  ```bash
  node -e "const s=JSON.parse(require('fs').readFileSync('utam-lint.sarif','utf8')); for (const r of s.runs.flatMap(r=>r.results??[])) console.log(r.level, r.ruleId, r.message.text, r.locations?.[0]?.physicalLocation?.artifactLocation?.uri ?? '')"
  ```

## The org

The login script asks the CLI for a frontdoor URL to its **default org** and writes it into `.env`; every spec opens it through the login helper. To test another org, the user switches the project's default (`sf config set target-org <alias>`) and generates the login again - say that this also changes the org their other CLI commands use. The org check in the orientation applies to every org you switch to.

Never print `.env` or the URL - it logs in without a password. The template's script prints the URL it writes, so discard its output as in the loop above; errors still reach the terminal. If a project's copy of the script no longer logs the URL, the redirect does no harm. With `logLevel: 'debug'` in `wdio.conf.js`, the run log shows the navigation to that URL as well - quote errors from a run log, never the whole log.

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

| The output says                                                                | What it means                                                                                      | Next step                                                                                                                                                         |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Missing SALESFORCE_LOGIN_URL` / `session timed out`                           | No login, or an old one                                                                            | Generate the login again, output discarded                                                                                                                        |
| `Did not reach a Lightning page` (or the helper's wait for the home URL fails) | The login did not end in Lightning                                                                 | Headed run or screenshot: API-only user, a screen the user must complete first (password, phone, passkey), wrong default org                                      |
| Only the first spec file logs in; later ones fail at login                     | Each spec file opens a new browser session; the org may not accept the frontdoor URL a second time | Generate the login per session - call the login script from wdio's `beforeSession` hook - and tell the user why                                                   |
| `utam is not defined`                                                          | The UTAM service is not loaded                                                                     | `services` in `wdio.conf.js`                                                                                                                                      |
| `Cannot find module` for `pageObjects/...`                                     | Not compiled, wrong import path, or the alias in `utam.config.js`                                  | Compile; check the relative path from the spec; alias as in [setup.md](setup.md)                                                                                  |
| An element or selector that cannot be found                                    | The chain is wrong for this page, or the element has not rendered yet                              | Use the waiting method, or check the chain against the page - [salesforce-page-objects.md](salesforce-page-objects.md#when-the-page-object-and-the-page-disagree) |
| `Timeout while waiting for condition after ...ms`                              | A wait never became true; the message ends with the last error the condition threw                 | Read that last error - it usually names the real problem                                                                                                          |
| `stale element reference`                                                      | The page or component re-rendered after you got the reference                                      | Load the root page object again and walk the chain anew                                                                                                           |
| `Async function did not complete within ...ms`                                 | The whole test exceeded Jasmine's timeout - often a step waiting without a timeout                 | Find the hanging step; do not just raise the timeout                                                                                                              |
| `This version of ChromeDriver only supports Chrome version ...`                | Browser and driver out of step                                                                     | Update Chrome or the `@wdio/*` packages                                                                                                                           |
| `Expected ... to be ...`                                                       | The application did something else than the test expects                                           | Compare with the test plan. A defect, a data problem or a wrong read - never "fix" it by changing the expected value without the user                             |
