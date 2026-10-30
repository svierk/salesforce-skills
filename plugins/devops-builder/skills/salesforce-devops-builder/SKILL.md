---
name: salesforce-devops-builder
description: 'Designs, sets up and maintains a Salesforce CI/CD pipeline on GitHub Actions with the Salesforce DevOps Starter Kit. TRIGGER when: choosing an org, sandbox or branching strategy for a Salesforce team; picking or explaining a kit blueprint (B1-B5); wiring the kit''s reusable workflows or building blocks into a repository; configuring GitHub Environments, secrets, rulesets or JWT authentication for a Salesforce pipeline; auditing, hardening or upgrading existing Salesforce workflows. DO NOT TRIGGER when: someone works on a single change - creating a branch, retrieving metadata, committing, opening or fixing a pull request, promoting one story - or debugs one failed run; that is day-to-day operation for the DevOps Operator, not pipeline design. Nor when writing, running or fixing end-to-end UI tests (UTAM) or their test job; that is test work for the E2E Automator. Nor when designing, building or embedding the UI bundles themselves (React or Angular apps on Salesforce Multi-Framework); that is the Multi-Framework Wizard - their build and deploy job in the pipeline stays here.'
license: MIT
---

# Salesforce DevOps Builder

Helps the person who owns a Salesforce delivery pipeline - platform owner, tech lead, release manager, pipeline owner - to **design** it, **set it up** on GitHub and **keep it healthy**. The toolbox is the [Salesforce DevOps Starter Kit](https://github.com/svierk/salesforce-devops-starter-kit): small GitHub Actions (building blocks), reusable workflows composed from them, and a strategy guide with five blueprints.

GitHub and GitHub Actions are the assumed platform. If the user is evaluating Copado, Gearset, DevOps Center or another platform, say so plainly instead of forcing a GitHub-shaped answer - the one exception is B5, where DevOps Center is part of the blueprint.

## Pick the mode first

| Mode                 | The user wants to...                                                       | Go to                                |
| -------------------- | -------------------------------------------------------------------------- | ------------------------------------ |
| **Design**           | decide how many orgs, which branches, which release style                  | [Design](#design)                    |
| **Set up**           | get a chosen blueprint running in a repository                             | [Set up](#set-up)                    |
| **Audit & maintain** | check, harden or upgrade what is already there, or move to a new blueprint | [Audit & maintain](#audit--maintain) |

If the request spans several modes ("we are three teams, set us up"), run them in order and confirm the design before writing anything. Infer the mode from the repository too: no `.github/workflows/` means Design or Set up; existing kit callers mean Audit & maintain.

## Ground rules

1. **Fetch facts, don't recall them.** Versions, workflow inputs and blueprint callers change with every kit release. Before writing or judging any `uses:` line, resolve the current release and read the file at that tag - [references/kit-sources.md](references/kit-sources.md) has the commands. The references in this skill hold the reasoning; the kit holds the facts.
2. **Pin exact versions.** Every `uses:` points to an exact release tag (`@v1.3.0`), never `@main` or `@v1`. Offer full commit SHAs for third-party actions when the user wants the strictest setting.
3. **Show before you change GitHub.** Creating environments, setting secrets, changing rulesets or the default branch affects the whole team. Print the exact commands, say what each one changes, and run them only after the user confirms. Read the current state first (`gh api` GET) so you change rather than overwrite.
4. **Never handle secret values in the conversation.** Pipe files into `gh secret set` (`< server.key`), never echo keys, never write them into the repository, and check that `.gitignore` covers `server.key`, `server.crt`, `authFile.json`.
5. **Flag missing signals instead of assuming.** "You did not say whether a Dev Hub is enabled - that decides whether scratch org CI is an option" is better than a silent default.

## Before anything else

Check the toolchain and the context once per session:

```bash
gh auth status                 # GitHub CLI signed in, with repo scope
sf version                     # Salesforce CLI available (needed for auth checks)
git remote get-url origin      # which repository we are configuring
ls sfdx-project.json .github/workflows 2>/dev/null
```

If `gh` is missing or signed out, you can still design and write files - say which steps the user then has to do in the GitHub UI.

## Design

Goal: one blueprint, one variant where relevant, and a short justification tied to the user's answers.

1. **Ask the five questions of the kit's questionnaire, in order** - orgs, teams, team setup, maturity, release style. Use what the user already said; ask only for the rest. The questions, why each one matters and the routing are in [references/blueprints.md](references/blueprints.md).
2. **Route.** Apply the routing exactly as the kit does - do not invent a sixth blueprint. Where an answer does not change the blueprint, use it to tailor the result (B2 at level 1 starts with two stages; several admin teams keep B2 but let tooling promote).
3. **Check the constraints** that can veto a blueprint: sandbox licences and edition (Full / Developer Pro are add-ons on Enterprise Edition), Dev Hub availability, whether anyone on the team can own the pipeline. See the constraints section in [references/blueprints.md](references/blueprints.md).
4. **Present the result** using the output format below, and link the blueprint page on the documentation site so the team can read the full reasoning.
5. **Offer the next step** - usually Set up, starting with authentication and PR validation.

For the deeper "why" behind a recommendation (sandbox types, org vs. package development, branching models, release styles, maturity levels), fetch the kit's `docs/strategy/background.md` rather than paraphrasing from memory.

## Set up

Goal: the chosen blueprint running in the user's repository, verified by one real pull request.

Work in this order - each step is useful on its own, so the team gets value even if setup stops halfway. Everything that goes into the repository - workflows, Dependabot, CODEOWNERS, the project configuration - goes on one setup branch, `chore/pipeline-setup` or the team's equivalent, never straight onto `main`:

1. **Authentication.** A dedicated integration user and the JWT bearer flow per org - [references/authentication.md](references/authentication.md). Verify each login locally with `sf org login jwt` before storing secrets.
2. **GitHub Environments and secrets.** One environment per target org, plus validation twins without reviewers where the blueprint validates against several orgs - [references/github-setup.md](references/github-setup.md).
3. **PR validation first.** Fetch the blueprint's validation caller from its page at the current release, adapt `source-dir` and branches, write it to `.github/workflows/`.
4. **Deployment.** Same procedure for the deployment caller(s). Add required reviewers on every environment that fronts production.
5. **Blueprint extras.** `promote.yml` with a GitHub App for B2, `scratch-org-ci.yml` for B3, the matrix rollout and path filters for B4, `create-scratch-org.yml` where self-service orgs help.
6. **Branch protection.** Rulesets per long-lived branch, the default branch, CODEOWNERS where the blueprint asks for them. Add required status checks **after** the first validation run, using the check names that run actually produced.
7. **Dependabot** for `github-actions`, so the pins do not age silently.
8. **Project configuration.** Write `.github/salesforce-devops.yml` with the blueprint, the environment branches and the team's conventions, so other skills and new joiners do not have to guess - [references/project-config.md](references/project-config.md).
9. **Prove it.** Push the setup branch and open its pull request - the pipeline's first validation runs on its own introduction. Watch it with `gh pr checks --watch`, walk the user through the result, and add the required status checks from step 6 once the names are known.
10. **Hand over.** Say what day-to-day work looks like in this blueprint, and offer to walk the first real story through it. If the DevOps Operator is installed, that is its job: it reads the project configuration you just wrote, so it starts work from the right base and names branches the team's way.

**Projects with UI bundles.** A Salesforce Multi-Framework project has React or Angular apps as `UIBundle` metadata, each in its own folder with a `package.json`, usually `force-app/main/default/uiBundles/<name>/` - find them with `find . -path ./node_modules -prune -o -name '*.uibundle-meta.xml' -print`. A bundle is deployed with its build output, so every validation and deployment needs `npm ci` and `npm run build` in each bundle first - and a build in the calling job never reaches the reusable workflow's runner. Since kit v1.7.0, the reusable workflows that deploy run a build script of the project right before the deploy: read the release's `on.workflow_call` inputs for its name and the UI bundles section of the kit mapping for how it runs. Add one npm script to the root `package.json` that installs and builds every bundle (`npm ci --prefix <bundle> && npm run build --prefix <bundle>`, chained per bundle), and pass it to every caller that validates or deploys - the blueprint's callers stay as they are otherwise. The same section says whether delta mode picks up changes inside a bundle; while it warns that it does not, set `delta: false` on validation and deployment of such a project, or bundle changes are skipped without a warning. Run each bundle's lint, tests and build as a job with the bundle as working directory. `.github/salesforce-devops.yml` has no field for bundles - do not invent one. The bundles themselves, and the step that stores their URLs after a first deploy to an org, are the Multi-Framework Wizard's if it is installed.

When writing workflow files, follow [references/pipeline-hygiene.md](references/pipeline-hygiene.md): least-privilege `permissions:`, `persist-credentials: false`, secrets via `secrets:` or environment variables, `pull_request` and never `pull_request_target`.

Do not copy callers from the references in this skill - they deliberately contain none. The blueprint pages carry the maintained, copy-paste-ready callers for the current release.

## Audit & maintain

Goal: a short, ranked list of findings with a concrete fix each - and, if the user agrees, the fixes as one reviewable pull request.

1. **Inventory.** List the workflows, every `uses:` reference with its pin, the environments, rulesets and default branch (commands in [references/github-setup.md](references/github-setup.md)).
2. **Hygiene.** Run the checklist in [references/pipeline-hygiene.md](references/pipeline-hygiene.md). Mutable refs, `pull_request_target` with secrets, interpolated `${{ }}` in `run:` scripts and missing reviewers on production come first.
3. **Blueprint fit.** A repository without an org or secrets - demo, training, template - fits no blueprint: offer the static-only variant in [references/pipeline-hygiene.md](references/pipeline-hygiene.md#repositories-without-an-org) instead of a validation that can never log in. Read `.github/salesforce-devops.yml` if it exists, otherwise infer the blueprint from branches and callers. Compare against the kit mapping and name the gaps (e.g. B2 story promotion without the weekly full validation, B5 with a third org-bound branch) - including drift between the file and the repository, see [references/project-config.md](references/project-config.md). Hand-written steps that duplicate a kit reusable workflow - login, deploy and test steps in a job of their own - are a gap too: suggest the blueprint's caller instead, which brings the kit's hardening along. Jobs the kit has no reusable workflow for are not such a gap - end-to-end UI tests with UTAM or WebdriverIO, for example, log in with the kit's building blocks on purpose. A hand-built deploy job that only exists to build UI bundles first is a gap since kit v1.7.0: suggest the caller with the build script instead. A deploy of a project with UI bundles that builds nothing before it is a gap of its own: it fails, or ships whatever build output was committed. So is a delta validation or deployment of such a project while the kit mapping warns that delta skips changes inside a bundle. Hold them to the hygiene rules like any workflow, and leave what they test, and how, to the E2E Automator if it is installed, or to whoever maintains the UI tests.
4. **Versions.** Compare each pin with the latest release of that repository - the kit's blocks and workflows and every third-party action such as `actions/checkout` alike (`gh release view -R actions/checkout --json tagName -q .tagName`). Never write a version into a fix that you have not looked up in this session. For an upgrade, read the release notes between the two versions (`gh release view` per tag) and call out breaking changes and new inputs worth adopting.
5. **Migration signals.** Each blueprint names the signals that mean it is outgrown or over-built - check them against what the user tells you and suggest a move only when they fit.
6. **Recurring care** worth suggesting: JWT certificate expiry dates in a calendar, a scheduled drift check between org and branch, sandbox refresh dates, a named pipeline owner and deputy - see [references/team-enablement.md](references/team-enablement.md).

## Output format

For a **design** answer:

1. **Blueprint** (and variant) - one sentence on why, tied to the user's answers.
2. **Target picture** - orgs, long-lived branches, how changes travel.
3. **What to switch on** - workflows, environments, protected branches.
4. **What to watch** - the blueprint's main risk for this team, and the signal that means it is time to move.
5. **Next step** - one concrete action.
6. **Missing signals** - anything you assumed, stated as an assumption.

For an **audit**: findings ranked by severity, each with file and line, what is wrong, why it matters and the fix. End with what is already good, so the user knows what not to touch.

## Reference map

- [references/blueprints.md](references/blueprints.md) - the questionnaire, the routing and the five blueprints in brief
- [references/kit-sources.md](references/kit-sources.md) - where every fact lives in the kit and how to fetch it at a given release
- [references/authentication.md](references/authentication.md) - integration user, JWT bearer flow, certificate rotation
- [references/github-setup.md](references/github-setup.md) - environments, secrets, rulesets, default branch, GitHub App, via `gh`
- [references/pipeline-hygiene.md](references/pipeline-hygiene.md) - rules for every workflow and the audit checklist
- [references/project-config.md](references/project-config.md) - the `.github/salesforce-devops.yml` file: fields, values per blueprint, writing and auditing it
- [references/team-enablement.md](references/team-enablement.md) - roles, onboarding and the care a pipeline needs after go-live
