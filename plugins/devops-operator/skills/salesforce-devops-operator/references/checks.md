# Read the checks

Goal: turn a red check into a plain explanation and one concrete next step.

## Find the failure

```bash
gh pr checks                       # all checks of the current branch's pull request
gh run view <run-id>               # the jobs and steps of one run
gh run view <run-id> --log-failed  # only the log of what failed
```

The run id is in the link `gh pr checks` prints. Read the failed step's log yourself, then explain - do not paste long logs at the user.

## What the kit's checks mean

Pipelines built with the Salesforce DevOps Starter Kit have three kinds of failure, and some teams add a fourth: end-to-end UI tests. Name which one it is first - they need different people and different fixes.

| Failed step                        | What it means                                                              | Usually fixed by                                        |
| ---------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------- |
| Code review / Code Analyzer        | A rule about code or metadata quality is broken above the team's threshold | Changing the flagged line; a developer for Apex and LWC |
| Validation / check-only deployment | The change would not deploy to the org behind the target branch            | Adding what is missing, or fixing the component         |
| Tests / coverage                   | An Apex test fails, or coverage drops below the required level             | A developer                                             |
| E2E UI tests (UTAM, WebdriverIO)   | A click path through an org did not behave as the test expects             | Whoever maintains the UI tests - see below              |

### Validation errors, translated

| The log says                                                                              | In plain words                                                                     | Next step                                                       |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `no CustomField named X found`, `Variable does not exist`, `In field: ... no such column` | The change uses something that is not in the target org and not in the branch      | Retrieve and commit the missing component too                   |
| `Dependent class is invalid and needs recompilation`                                      | Code that depends on the change breaks                                             | Developer: fix the depending class                              |
| `The flow version ... cannot be activated` / flow errors                                  | The flow is invalid in the target org - often a missing field or a wrong reference | Check the named element in Flow Builder, retrieve what it needs |
| `Picklist value ... not found`, `bad value for restricted picklist`                       | A picklist value the change relies on is missing in the target org                 | Retrieve and commit the field with its values                   |
| `UNABLE_TO_LOCK_ROW`, timeouts, `Polling time out`                                        | The org was busy - not your change                                                 | Run the failed job again: `gh run rerun <run-id> --failed`      |
| `INVALID_SESSION_ID`, `expired access/refresh token`, JWT errors                          | The pipeline cannot log in to the org - not your change                            | Tell the pipeline owner                                         |

Look for the component name and line in the error and point the user to it - "the Discount Approval flow, element Check_Threshold" is actionable, "deployment failed" is not.

### Tests and coverage

- `System.AssertException` in `SomeTest.testMethod` - the test expected one result and got another. Did the change alter behaviour the test relies on? Then the test or the change needs adjusting - usually developer work.
- Coverage below 75 % (or the team's threshold) - new or changed Apex lacks tests.
- Flow tests fail - the flow's behaviour changed; check whether that was intended.
- Jest tests of a Lightning web component fail (`FAIL force-app/.../lwc/<component>/__tests__/...`) - the component no longer does what its test expects. Name the component and the test; fixing it is component work - if the LWC Crafter is installed, offer to switch to it, otherwise hand it to a developer.

An admin can often still do the first diagnosis - which test, which object, which record - before handing it to a developer.

### Code review

Name the rule, the file and the line from the log or the pull request's annotations, and what the rule protects against. For declarative metadata, some rules are noisy - if a finding makes no sense for the change, say so and suggest asking the pipeline owner whether the threshold fits, rather than working around it.

ESLint or Prettier findings in files under `lwc/` are component work as well: name the rule, the file and the line, then hand over to the LWC Crafter if it is installed - it fixes the cause instead of disabling the rule.

### UI bundles

A project on Salesforce Multi-Framework has React or Angular apps under `uiBundles/`, each with its own lint, tests and build - often a job of its own per bundle. When one of them fails, name the bundle, the step and the first error, then hand over: that is app work - if the Multi-Framework Wizard is installed, offer to switch to it, otherwise hand it to a developer.

A validation or deployment that fails with `Expected source files for type 'UIBundle'` is different: the bundle was deployed without its build output. On a pull request that is the pipeline - it must build every bundle before it deploys - so it goes to the pipeline owner or the DevOps Builder, not into the change.

A project with HXL widgets (`uiWidgets/`, `lightningTypes/`, `mcpServerDefinitions/`) fails its validation with `Not available for deploy for this organization` on `UiWidgetBundle` when the Headless Experience Layer is off in the target org - that is org setup for the pipeline owner, not the change. A failing Apex test of an MCP tool class, or a widget whose bindings do not match its type, is app work: if the HXL Hero is installed, offer to switch to it.

### End-to-end UI tests

A job named like "E2E UI Tests" or running `wdio` opens an org in a browser and clicks through a business process. When it fails:

- Find the failing test (`describe` and `it` titles in the log, often with a ticket key) and the step where it stopped. A screenshot artifact on the run, if there is one, shows the page at that moment.
- Say what it means in plain words - "the test that creates a quote could not find the Discount field on the form" - not the stack trace.
- Do not judge it yourself, and do not re-run it until it passes: a UI test that passes on the second try is flaky, and that is a finding too. The cause can be the change (a field removed from the layout), test data or configuration in the org, the test itself, or a Salesforce release.
- Hand over. If the E2E Automator is installed, offer to switch to it; otherwise name whoever maintains the UI tests. Problems with the job's login or secrets are pipeline work, as below.

## Not a failure, but stuck

- **"Waiting for approval" / "Waiting for review"** on a validation run - the validation's GitHub Environment has required reviewers, so every pull request waits. That is a setup problem: tell the pipeline owner.
- **"Expected - waiting for status to be reported"** - a required check that never started. Often the pull request was opened by an automation that cannot trigger workflows. Tell the pipeline owner.
- **Merge blocked although everything is green** - a review is missing, or the branch is behind its target and must be updated first.

## Do not

- Re-run a failing check hoping it passes - only for the infrastructure errors above.
- Skip, disable or work around a check. If it is wrong, the pipeline owner fixes the check.
