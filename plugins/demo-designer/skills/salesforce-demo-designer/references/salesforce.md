# Salesforce

What is different about recording in a Salesforce org: logging in without a password, knowing when Lightning is ready, clicking through shadow DOM, keeping the frame free of what does not belong in a demo - also in an org that other teams and clients share - and products with habits of their own, such as Marketing Cloud Next.

## Org and login

Check the org before anything else. `salesforceLogin` does it on every run, but say it before the first take, so the user can pick another org:

```bash
sf org list
sf data query --target-org <alias> --query "SELECT Name, IsSandbox, OrganizationType, TrialExpirationDate FROM Organization" --json
```

Safe to record without further questions: `IsSandbox` true (sandbox), `TrialExpirationDate` set (scratch org, trial), `OrganizationType` `Developer Edition`. Anything else is a production org. Demo orgs for presales are often production-type orgs with demo data only - record there only after the user confirms that, and pass `allowProduction: true`. A customer's production org is never a demo stage.

`salesforceLogin(director, { org, path })` takes the frontdoor URL from `sf org open --url-only --path <path> --json` and opens it in the stage - the browser is logged in as the CLI's user, without a password. The URL is a live session: it never appears in output, files or the conversation. If the org is not authorised, the user runs `sf org login web --alias <alias>` themselves.

**An expired password stops the login.** Once the user's password has expired, often after 90 days, the frontdoor URL ends on "Change Your Password" and `ready` times out. Take a screenshot when `ready` fails, so the cause is visible. The user sets the new password - never the script - and never change the org's password policy to get past it.

Paths that open a page directly:

| Page                     | Path                                                   |
| ------------------------ | ------------------------------------------------------ |
| Home                     | `/lightning/page/home`                                 |
| App page (Lightning tab) | `/lightning/n/<Tab_API_Name>`                          |
| Record                   | `/lightning/r/<Object>/<Id>/view`                      |
| List view                | `/lightning/o/<Object>/list?filterName=<ListViewName>` |
| New record form          | `/lightning/o/<Object>/new`                            |
| Setup page               | `/lightning/setup/<Page>/home`                         |

Find tab names with `sf data query --use-tooling-api --query "SELECT DeveloperName, Type FROM CustomTab"`, record ids with a SOQL query on demo records.

## Ready, set, record

Lightning has no reliable "done" signal - spinners come and go, the network never goes quiet, the page title changes seconds after the content. Wait for the element the scene starts with:

```js
await salesforceLogin(app, { org: 'demo', path: '/lightning/n/Quote_Builder' });
await ready(app, app.page.getByText('Quote Builder').first());
```

- **Load outside the scene.** Log in and navigate before `captureScene`, so the take starts on a finished page. Between scenes, navigate in the gap - the cross-fade hides the cut.
- **Warm the cache.** The first load of an app is the slowest. Open the pages of the click path once before the scenes, so the take shows Lightning at its fastest.
- **Inside a scene,** wait for the result element of a click before the hold, not for time: `await d.page.getByText('Quote created').waitFor()`.
- **Wait for the data, not the first paint.** A component can reload right after its content first appears. Before a screenshot or a take, wait until its spinner is gone: `await component.locator('lightning-spinner').first().waitFor({ state: 'detached' })`. A fixed sleep is how a spinner ends up in the picture.
- **Debug mode** makes Lightning much slower. If pages crawl, check whether it is on for the user (Setup, Debug Mode).

## Locators in Lightning

Playwright's `getByRole`, `getByLabel` and `getByText` pierce shadow DOM, and the Lightning base components expose proper labels and roles - `getByLabel('Target URL')` finds the input inside a `lightning-input`, `getByRole('button', { name: 'Save' })` finds a `lightning-button`. Prefer them over CSS: generated ids and class names change between releases.

- Labels and texts are in the user's language. Record with a user whose language matches the video, and write locators in that language.
- Several matches - a field label on a page and in a modal - need narrowing: `d.page.getByRole('dialog').getByLabel('Name')`, or `.first()` once the probe proved the first is the right one.
- `hide` and `blur` take CSS selectors and only reach elements in the page's light DOM, including the host elements of components. Elements inside a component's shadow root cannot be styled from outside - hide their host instead.

## Keep the frame clean

Look at a probe screenshot of every page and decide what stays. What was in the way in a Developer Edition org in October 2026 - verify on your org, these change with releases:

| What                                                            | Selector                              | Treatment                                                                          |
| --------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------- |
| Org type bar above the header ("Developer Edition")             | `devops_center-base-component`        | `hide`                                                                             |
| Profile photo of the logged-in user                             | `img.branding-user-profile`           | `blur`                                                                             |
| Background band that fades over content crossing its lower edge | `.slds-brand-band::before`, `::after` | `display: none` through `page.addStyleTag` - `hide` does not reach pseudo elements |

Also look for: leftovers of rehearsals - a folder "Rehearsal drafts", a campaign "test 2" - that later show up in pickers, lists and search results (name rehearsal records like the real ones, and delete them with a yes before the final takes), the "Logged in as" banner of a Login As session, the sandbox name banner, setup assistants and welcome dialogs (close them during the warm-up), toasts from earlier actions, "Recently Viewed" list views that are empty in a fresh org (open a named list view instead), and a page opened outside the app's navigation, which shows as a temporary tab with an asterisk (add it to the app's navigation - an org change, ask first - or start the path from a tab that is there).

## Shared orgs

Presales orgs are often shared: other teams demo other products in them, and other clients' records, apps and themes are a click away. Nothing of theirs may appear in the video, and nothing of yours may change their demo.

**Look and feel - three levels, picked per demo:**

| Level                 | How                                                                                                                                                                 | Reaches                                 | When                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------- |
| The recording browser | `stage({ css })`, for example a logo as data URL on `.slds-global-header__logo` (`background-image`, `background-size: contain`), plus `hide` for system banners    | This stage only; the org stays as it is | The default in a shared org, and for a one-off video in another brand. No org change         |
| The app's branding    | The Lightning app's own logo and primary colour (App Manager, App Branding), with the option to use them instead of the org's theme                                 | Everyone in that app                    | A demo app that is yours alone and keeps its look in live demos too - an org change          |
| The org theme         | Setup, Themes and Branding: a theme with logo, brand colour and background, activated for the org (`BrandingSet` and `LightningExperienceTheme` deploy as metadata) | Every user of the org, in every app     | A demo org of your own, or a live demo that needs the look outside the video - an org change |

Each org change needs the user's yes (ground rule 7). In a shared org, switching the org theme also needs a time window agreed with the other teams: note the active theme, switch, record, switch back. Either way the product recording stays the product - the theme sets its colours and logo, the brand lives around it ([storyboard.md](storyboard.md#visual-language)).

**Other clients out of frame:**

- **Hide what renders.** `stage({ conceal: ['Acme', /globex/i] })` hides rows, options and menu items that name them as they appear - in pickers, recent items, list views and frames. Counts on the page ("Items (12)") do not change; keep such headers out of frame or filter the view.
- **Check before and after every take.** `await leaks(app, words)` lists what of the deny list is visible right now; stop when it is not empty. Text drawn on canvas (charts, dashboards) is not covered - look at the stills.
- **Demo records of your own,** created for the video, rather than another team's records - even when theirs would fit.
- **Your reserved domain may be taken.** Another team may already use `.example` to mark its records (a formula field, list view filters, KPIs). Check before loading data, and use another reserved domain such as `.test` when it is.

## Personas and demo data

The viewer sees who is logged in - the name in "Created by" and "Owner" fields, in Chatter, on the avatar. For a pitch, record as a demo persona with a plausible name and role: a separate user, authorised with its own alias (`sf org login web --alias demo-sales-rep`). Creating that user is an org change - ask first.

- **Login As instead of a second alias.** When the CLI user is an admin and the org lets administrators log in as any user, log the stage in as the admin and open `/servlet/servlet.su?oid=<org id>&suorgadminid=<user id>&retURL=<path>`. Lightning then shows a "Logged in as" banner - find its selector in a probe and put it into `hide`.
- **The persona's settings show.** Time zone and locale decide every date and time on screen - a meeting at 1:00 AM gives the setting away. Check them before the first take.
- **The persona's email may be someone's real address** - a colleague's login reused for the demo. It appears in email composers, "From" fields and generated documents: blur it there.

Demo data makes or breaks a pitch. Records should fit the prospect's industry, have plausible names, amounts and dates relative to today, and fill every field the click path shows. Plan the data with the user, then load it - after a yes - with the Salesforce CLI:

```bash
sf data import tree --target-org <alias> --plan data/demo-plan.json
```

Click paths that create or change records leave traces. Prefer showing existing demo records; when the story needs a create, delete the record afterwards or reset the data before the next take, so every take starts from the same state.

- **Record in story order from a known state.** Summaries and recommendations read the whole record: an AI summary in scene 1 picks up the visit that scene 5 created. Write down the baseline (record ids, statuses), reset to it with the user's OK, then record the scenes in order.
- **Fill what the story looks at.** An empty Home page or an empty related list undermines the story; seed a few plausible records for today - after a yes - and note them for the reset.

## AI features

Prompt Builder, Agentforce and other generative features answer differently on every run.

- **Guard the take.** Read the generated text in the script and check it for what the story needs before anything is confirmed; regenerate a few times, then stop with a clear message. Never confirm whatever came back - a wrong product in a confirmed offer creates records you then have to clean up.
- **Wait outside the beat.** Generation takes seconds to minutes. Start it, then trim the wait in the edit (or record the wait off camera) and show the result.
- **Check every claim it makes on screen.** Generated text may state things the data does not support, or details from a different record. Read it before hand-over like any caption.
- **Prepared results are an option.** When the live answer is too unpredictable for a recording, load a prepared result the team agrees on, and say so in the hand-over.
- **First-use notices.** Many AI buttons show a notice the first time in a browser session ("You're about to use Agentforce", Got It). A stage is a fresh session on every run: dismiss it in a warm-up before the scene and reload, or cut it out of the take with `cut()`.
- **Wait for the result or the error.** A generation fails ("Something went wrong") as easily as it succeeds. Wait in the script for either and stop the take on the error, instead of holding on an error message.
- **One-click actions over typed prompts.** A button that drafts on its own ("Draft with Agentforce" next to a subject line) records more reliably than a prompt typed into a panel, where the typed request may never be sent. Probe both.
- **Buttons inside editors.** AI buttons inside an editor's frame (a paragraph in an email builder) can ignore synthetic clicks; the same feature in the property panel of the main page usually works.
- **Unsaved beats are free.** Showing a draft and closing without saving - a segment drafted from a sentence, a subject line that is not applied - creates nothing, and retakes need no reset.

## Illustrative numbers

Ground rule 3 says every claim is true. A demo org often has no history for the step that closes the story - a performance dashboard right after a journey started shows zeros. Only when the user asks for it, a recording may show illustrative numbers:

- **In the recording browser only.** Never write invented results into the org - other teams and later demos would read them as real.
- **Consistent with the story.** Derive them from what the video showed: 9 invitations and 3 reminders give 12 sends, and 8 opens give an open rate of 66.7 %.
- **Canvas KPIs.** Lightning dashboards draw their values on canvas. An init script that runs in the dashboard's frame can wrap `CanvasRenderingContext2D.prototype.fillText` and draw another value for a tile, found by walking up from the canvas to the tile's title. "As of" times and filter labels change through their text nodes.
- **What gives it away.** Hover tooltips show the real values - keep the cursor on titles, not on values. Charts without data stay empty - keep them out of frame.
- **Say it.** Name the numbers as illustrative in the hand-over and in the talk track ([delivery.md](delivery.md#talk-track)), so the presenter answers "are those real?" honestly.

## Retakes and side effects

A retake repeats everything the click path does - and some of it cannot be undone.

- **Automation of other teams.** Record-triggered flows that post notifications or send emails fire on every take. Pause them only with the owner's OK, for the take, and restore them; note the version you restored.
- **No real emails, ever.** Demo data uses a reserved domain such as `.example`; composers stay unsent.
- **Forms that start automation** - a landing page, a web-to-lead form - submit again on every take. To re-record the filling, block the submission in the browser just before the click and cut to the result of the original submission:

  ```js
  await d.page.route('**/*', (r) => (r.request().method() === 'GET' ? r.continue() : r.abort()));
  await d.click(d.page.getByRole('button', { name: 'Submit' }));
  ```

  Log what was aborted; exactly the submit request should be in that list.

- **Actions that were applied** - by a wizard, an AI proposal, a quick action - would be applied again. Prefer cutting the existing take over re-recording it; when a reset is needed, show what will be deleted and wait for a yes.

## Lightning quirks

Verify on your org - these change with releases.

| Quirk                                                                          | What works                                                                                                                                     |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `Escape` closes LWC modals                                                     | Do not press it to close a dropdown inside a modal; click elsewhere or use `Tab`                                                               |
| Checkboxes in `lightning-input` ignore clicks on the hidden input              | Click the visible `.slds-checkbox_faux`, then verify `isChecked()`                                                                             |
| A combobox pick does not always register                                       | Check the combobox's `data-value` after picking and retry - a blank field in the video is the cost                                             |
| Texts such as "Contacts (6)" are split across elements                         | Anchor on the row, header or card, not on the combined text                                                                                    |
| Element boxes inside canvases (flow builders, charts) do not match the drawing | Zoom onto the container without a frame                                                                                                        |
| Mobile web may be disabled in an org - a phone emulation lands in Classic      | Record mobile scenes on a real device, or show them on desktop                                                                                 |
| A narrow field truncates its value ("..")                                      | Fix the page if it is yours; otherwise widen it with `page.addStyleTag` for the take only, and tell the user that the page itself is unchanged |

## Marketing Cloud Next

Campaigns, segments, content and journeys live in Lightning, with habits of their own. Observed in November 2026 - verify on your org:

| What                                                                            | What works                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The campaign workspace renders blank, dashboards say "report type inaccessible" | The recording user lacks permission sets - in that org `MarketingCloudAdmin` and `CampaignCreation_and_ContentBuilder_Agent_Access`, and `CDPAdmin` for the engagement dashboards. Assigning them is an org change: ask |
| A run-once journey completes without sending                                    | Its segment was not published yet. Publish it (Publish Now) and wait for the population before activating                                                                                                               |
| A list of values for an "Is In" rule in the Segment Builder                     | Bulk Import, then Add Values - the whole list in one step instead of one value at a time                                                                                                                                |
| Adding an element in Flow Builder                                               | Type into the search of the add menu instead of scrolling its list                                                                                                                                                      |
| The email canvas of the content editor                                          | It sits in a frame (`surfaceFrame`): locate through `frameLocator`, and `focus` measures it from outside                                                                                                                |
| Red error badges on the journey while it is built                               | They stay until the schedule is set. Set it before the take, so the badge never shows; otherwise retouch it ([recording.md](recording.md#retouching))                                                                   |
| AI beats that record well                                                       | Einstein segment creation (Segments, New, create with Einstein, describe the audience in one sentence) and Draft with Agentforce for a subject line - neither saves unless you do                                       |

## Experience Cloud and other sites

Public pages of an Experience Cloud site need no login - open the site's URL in the stage. For member pages, log in through the site's login form with a demo member the user provides. Read the credentials from environment variables in the script, never write them into it, and keep the password field out of frame (log in before the scene).

## Showing a new component

A component the demo shows must be deployed to the demo org and placed on a page first - an app page tab is the quickest stage. Several components can share one showcase page.

- **It stays in the org.** A page made for a capture does not belong in the project's repository, or it lands in every org that deploys the project. The repository gets the finished files only.
- **Take it out afterwards - with a yes.** While the page places a component, no deployment can remove one of that component's builder properties, and a pipeline validating against this org fails on it. Delete in order: tabs, then FlexiPages, then what they use. A destructive deployment also deletes the local copies of the metadata, so keep a copy if the page will be needed again.

Building or fixing the component is not this skill's job; a bug found while recording goes back to whoever builds it, not into a workaround in the click path.
