# Team enablement

A pipeline the team does not trust or understand does not stick. Enablement is part of the setup, and part of maintaining it.

## Roles to name

Each blueprint needs some of these. Name a person for each, and a deputy for the critical ones - an unnamed role is an unowned one.

| Role                    | Owns                                                              | Critical in                                 |
| ----------------------- | ----------------------------------------------------------------- | ------------------------------------------- |
| Pipeline owner          | Workflows, pins, secrets, rulesets; reviews pipeline changes      | all; B5 above all - single point of failure |
| Release manager         | What enters a stage or a release; runs the approval gates         | B2, B4                                      |
| Business owner          | Sign-off in UAT                                                   | B2, B5                                      |
| Module / platform owner | The module dependency graph, the Dev Hub, scratch org definitions | B3, B4                                      |
| Regional lead           | When their org adopts a core version                              | B4                                          |
| Retrieval owner         | Getting declarative changes from a sandbox into a branch          | B1, B5                                      |

The retrieval owner is the one that gets forgotten: someone builds a flow in a sandbox, nobody retrieves it, and it reaches production by hand or is lost at the next refresh.

## Onboarding

1. **Self-service orgs.** Where the blueprint includes scratch orgs, `create-scratch-org.yml` gives a new joiner a ready org from the Actions tab - no local CLI, no Dev Hub access.
2. **Where things live.** A short written page in the repository: package directories in `sfdx-project.json`, the workflows, the branch model and who merges where. Link the blueprint page on the kit's documentation site instead of rewriting it.
3. **First pull request together.** Pair on one real change so the new joiner sees validation run end to end before they have to read a red check alone.

## What the team needs to understand

- **Three kinds of red check:** static analysis (code review), check-only deployment, tests - and where each one reports.
- **Delta vs. full:** why a pull request validates only its change, and when a full deployment is needed.
- **Destructive changes:** removing metadata works differently from adding it. Walk through it once before it happens under release pressure.
- **What green means:** the change deploys and the tests pass - not that the whole org is deployable or that UAT sign-off is unnecessary.

## Care after go-live

Suggest putting these into a shared calendar or a recurring issue - they fail silently otherwise:

| What                            | When                                 | Why                                                       |
| ------------------------------- | ------------------------------------ | --------------------------------------------------------- |
| JWT certificate expiry, per org | A month before the `-days` run out   | Every login fails on the day it expires                   |
| Dependabot pull requests        | Weekly                               | Pins that are never bumped age into unpatched versions    |
| Kit release notes               | Per kit release                      | New inputs and fixes; breaking changes need a migration   |
| Sandbox refresh                 | Per refresh interval (Full: 29 days) | Stale sandboxes produce passes that production fails      |
| Drift check, org vs. branch     | Weekly, scheduled                    | Changes made directly in an org break the next deployment |
| Blueprint migration signals     | Quarterly                            | Each blueprint names the signals that it is outgrown      |
| Pipeline owner deputy           | Rehearse once a year                 | "The owner is on holiday" should be a drill, not a crisis |

## Signals enablement lags behind the pipeline

- Pull requests merged with the validation red or skipped.
- People asking for direct production access "just to check something".
- The same onboarding question answered in chat for every new joiner.

Any of these means the setup has outpaced the team's understanding of it. Close that gap before adding more pipeline.
