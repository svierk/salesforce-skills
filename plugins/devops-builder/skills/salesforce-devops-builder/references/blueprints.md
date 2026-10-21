# Blueprints

The kit's strategy guide routes a team to one of five blueprints with five questions. This file mirrors that routing and gives each blueprint in brief - enough to decide and explain. The full pages, with diagrams and maintained callers, live in the kit (`docs/strategy/b*.md`, see [kit-sources.md](kit-sources.md)); fetch the relevant one before going into detail or writing files.

## The five questions

Always asked in this order. Every answer tailors the result, even where it cannot change the blueprint.

| #   | Question                                | Answers                                                                                           | Why it matters                                                                                    |
| --- | --------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1   | How many production orgs do you run?    | One · Several                                                                                     | Several production orgs is its own blueprint (B4) - everything multiplies                         |
| 2   | How many teams or parallel workstreams? | One · Several                                                                                     | One stream can work on one branch; several need either stages (B2) or a trunk they can share (B3) |
| 3   | How is the team set up?                 | Mostly developers · Balanced, cross-functional · Mostly admins / low-code                         | A team that does not use Git needs tooling to do the promoting (B5)                               |
| 4   | How mature is your DevOps practice?     | Level 1 starting out · Level 2-3 established · Level 4 advanced                                   | Trunk-based development needs a gate that blocks and feature-flag discipline - level 4 only       |
| 5   | How do you ship to production?          | Story by story · Story by story to UAT, bundled into production · Whole releases on planned dates | Decides what travels between B2's environment branches: one story, a bundle, or the whole branch  |

Maturity levels, condensed from DORA: **1** manual or lightly scripted deployments, testing late · **2** CI on every pull request, static analysis blocking · **3** delta deployments, tracked DORA metrics, deliberate environment strategy · **4** trunk-based, feature-flagged, metrics improving against the team's own baseline.

## Routing

| Answers (questions 1-5)                                 | Blueprint                          |
| ------------------------------------------------------- | ---------------------------------- |
| Several orgs · any · any · level 1-3 · any              | **B4**, per-org environment chains |
| Several orgs · any · any · level 4 · any                | **B4**, trunk with a shared core   |
| One org · one team · developers or balanced · any · any | **B1**                             |
| One org · one team · admins · any · any                 | **B5**                             |
| One org · several · any · level 1-3 · story by story    | **B2**, story promotion            |
| One org · several · any · level 1-3 · bundled           | **B2**, release bundle             |
| One org · several · any · level 1-3 · whole releases    | **B2**, release train              |
| One org · several · any · level 4 · any                 | **B3**                             |

Tailoring that does not change the blueprint:

- **B2 at level 1** starts with two stages, `uat` and `main`. Add `integration` once CI runs on every pull request, `preprod` only when a rehearsal on production-like data is genuinely required.
- **Several teams of admins** keep B2, but let tooling (DevOps Center, sfdx-hardis) do the promoting.
- **Distributing an app through AppExchange** is out of scope: that needs managed 2GP packages and a namespace, and none of the blueprints is the model.
- **Several orgs that share nothing** are not B4 - run the questions once per org.
- If two answers feel equally true, take the simpler one. Adding a long-lived branch later is far cheaper than unwinding one.

The routing is a heuristic, not a measurement - say so if the user treats it as more.

## The blueprints in brief

### B1 - Simple Org Development

- **Fits:** one team (1-6), one production org, continuous delivery, level 1-2.
- **Orgs:** one Developer sandbox as check-only validation target, production. No add-on licences.
- **Branches:** GitHub Flow - `main` plus short-lived `feature/*`. No `develop`, no release branches.
- **Switch on:** `pr-validation.yml` into `main` as required check; `deployment.yml` on push to `main` behind a `production` environment with required reviewers. Optional: `scratch-org-ci.yml`, `create-scratch-org.yml`.
- **Watch out:** nothing sits between merge and production - safety comes from the gate and the protected environment. Long-lived feature branches defeat the model.
- **Move on:** to B2 when merges are held back to protect production or a sign-off stage is needed; straight to B3 if metadata is modular and teams block each other.

### B2 - Multi-Team with Environment Branches

- **Fits:** several teams (5-25), one production org, approval gates, level 2-3.
- **Orgs:** `integration` (Developer Pro), `uat` (Partial Copy or Full), `preprod` (Full), production. The expensive blueprint - price the sandboxes first.
- **Branches:** four protected environment branches. What travels between them depends on the variant:
  - **Release train** - the whole branch moves up the chain on release dates, full deployments between stages, `feature/*` from `integration` (default branch), separate RUN stream for hotfixes entering at `preprod`, retrofit back into `integration` immediately.
  - **Story promotion** - each story reaches each stage through its own `promotion/<story>-<stage>` branch, environment branches are never merged into each other, `feature/*` from `main` (default branch), delta deployments, sync `main` back into every stage after each release.
  - **Release bundle** - story promotion up to `uat`, then `release/<date>` cut from `main` carries the signed-off stories through `preprod` into `main`.
- **Switch on:** `pr-validation.yml` on all four branches against `<branch>-validation` environments (no reviewers); `deployment.yml` per branch with one environment each (reviewers on `preprod`, `production`); `promote.yml` with a GitHub App for story promotion and bundles; a weekly full check-only validation of every branch for story promotion and bundles.
- **Watch out:** merge overhead and drift grow with every stage; never let it degrade into "branch mirrors org" without reviewed pull requests; dependent stories must be promoted together.
- **Move on:** between variants at any time; to B3 as modules and feature flags take over; back toward B1 if a stage never rejects anything.

### B3 - Modular Trunk

- **Fits:** several teams (8-40+) mature enough to share one trunk, level 4.
- **Orgs:** scratch orgs or developer sandboxes for development and CI, one staging sandbox (Partial Copy), production. Light on sandbox licences, heavy on Dev Hub capacity and modularisation effort.
- **Branches:** trunk-based - `main` always releasable, feature branches live hours to a day or two, unfinished work behind feature flags (custom permission per flag). A release is a tag or a promoted package version.
- **Artifacts:** one source tree, source modules (default) or unlocked packages - chosen per module.
- **Switch on:** `pr-validation.yml` as a gate that genuinely blocks; `scratch-org-ci.yml` on every pull request; `deployment.yml` from `main` or a release tag with `delta-from` the previous release; `sfdx-package-installation` for package versions; `create-scratch-org.yml`. Package version creation has no building block yet - a plain `sf` call in the workflow.
- **Watch out:** trunk-based without a real gate is just pushing to production; cutting the first module is the real cost; feature flags accumulate.
- **Move on:** to B4 when a second production org appears.

### B4 - Multi-Org / Regional Rollout

- **Fits:** several production orgs by region, business unit or brand, with a shared core.
- **Shapes:** **trunk with a shared core** (level 3-4, monorepo `packages/core` + `orgs/<region>`, short-lived `release/<org>` branches, core distributed as pinned package versions) or **per-org environment chains** (level 2-3, one repository per org running B2, shared metadata in its own repository).
- **Switch on:** a matrix rollout via `deployment.yml` with one environment per production org (`fail-fast: false`, `max-parallel: 1`); `pr-validation.yml` as a matrix against every affected org; `paths:` filters per region; CODEOWNERS for core and regions; per-org chains reuse the B2 callers unchanged.
- **Watch out:** everything multiplies; divergence is the default outcome; decide in advance whether a partial rollout pauses or fixes forward; set a maximum version lag per org.
- **Move on:** usually terminal; consolidate toward B3 if processes converge.

### B5 - Low-Code First

- **Fits:** admin-heavy team (2-10) where Git knowledge is the bottleneck, level 1-2.
- **Orgs:** one shared Developer sandbox with source tracking, UAT (Partial Copy if possible), production. Three is the ceiling.
- **Branches:** two org-bound branches, `uat` (default) and `main`. Work-item branches are created by tooling - DevOps Center by default, sfdx-hardis for a Git-closer route. Admins never touch Git.
- **Switch on:** `pr-validation.yml` into `uat` and `main` with `severity-threshold: '2'`; `deployment.yml` on push to `uat` and `main` **only on the Git route** - with DevOps Center, it deploys itself and a second deployment would run outside its view; `create-scratch-org.yml` as the highest-value extra.
- **Watch out:** the pipeline owner is a single point of failure - name a deputy and write the runbook; retrieves get forgotten; prefer permission sets over profiles.
- **Move on:** to B1 once admins open their own pull requests; to B2 only when a second stream and formal approvals appear together.

## Settings that differ per blueprint

| Setting               | B1                 | B2                                                                    | B3                             | B4                     | B5                  |
| --------------------- | ------------------ | --------------------------------------------------------------------- | ------------------------------ | ---------------------- | ------------------- |
| `delta` on validation | `true`             | `true`                                                                | `true`                         | `true`                 | `true`              |
| `delta` on deployment | `false`            | train `false`, story and bundle `true`                                | `true` (from the last release) | `false`                | `false`             |
| `severity-threshold`  | `3`                | `3`                                                                   | `3`                            | `3`                    | `2`                 |
| Environments          | `production`       | `integration`, `uat`, `preprod`, `production` (+ `-validation` twins) | `staging`, `production`        | one per production org | `uat`, `production` |
| Protected branches    | `main`             | all four                                                              | `main`                         | `main`                 | `uat`, `main`       |
| Default branch        | `main`             | `integration` (train), `main` (story, bundle)                         | `main`                         | `main`                 | `uat`               |
| Required checks       | validation         | validation                                                            | validation + scratch org CI    | validation per org     | validation          |
| Who merges            | anyone with review | release manager on `uat`/`preprod`/`main`                             | owning team                    | CODEOWNERS             | pipeline owner      |

Keep `RunLocalTests` for production in every blueprint. `RunRelevantTests` (beta since Spring '26) is fine to try in validation runs, not yet in production pipelines.

## Constraints that can veto a blueprint

- **Sandbox licences.** Enterprise Edition includes Developer sandboxes and one Partial Copy, but Full and Developer Pro are paid add-ons. A four-stage B2 on Enterprise Edition is a budget decision. Entitlements change - ask the user to confirm theirs.
- **Refresh intervals.** Full sandboxes refresh every 29 days, Partial Copy every 5 - a Full `preprod` drifts between refreshes.
- **Dev Hub.** Scratch org flows need one; limits depend on the edition (e.g. 40 active / 80 per day on Enterprise Edition).
- **People.** B5 needs one pipeline owner and a deputy; B2 needs a release manager; B3 needs someone who owns the module dependency graph; B4 needs a core team and regional owners.
- **What no blueprint gives you.** Backup and recovery with a stated RPO/RTO (Salesforce has no rollback), and drift detection between org and branch. Mention both in every design.
