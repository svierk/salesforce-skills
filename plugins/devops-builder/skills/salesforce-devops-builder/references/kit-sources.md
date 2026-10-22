# Kit sources

Where every fact about the Salesforce DevOps Starter Kit lives, and how to read it at a given release. Read from here instead of relying on what this skill - or your memory - says about versions, inputs or callers.

## Resolve the release first

```bash
# Latest release of the kit (reusable workflows, examples, strategy pages)
gh release view -R svierk/salesforce-devops-starter-kit --json tagName -q .tagName

# Latest release of one building block
gh release view -R svierk/sfdx-deploy --json tagName -q .tagName

# Release notes of one version - read every version between the current pin and the target
gh release view v1.3.0 -R svierk/salesforce-devops-starter-kit
gh release list -R svierk/salesforce-devops-starter-kit --limit 20
```

Without a signed-in GitHub CLI, the public REST API answers the same question - fetch `https://api.github.com/repos/<owner>/<repo>/releases/latest` and read `tag_name`. This works for third-party actions too.

Use that tag as `REF` in every read below, and in every `uses:` you write. Reading `main` instead can show inputs that are not released yet.

## Read a file at a release

```bash
REF=v1.3.0
gh api -H "Accept: application/vnd.github.raw+json" \
  "repos/svierk/salesforce-devops-starter-kit/contents/docs/strategy/b2-multi-team-environment-branches.md?ref=$REF"
```

Without the GitHub CLI, the same file is at `https://raw.githubusercontent.com/svierk/salesforce-devops-starter-kit/<REF>/<path>`.

## What lives where

**Kit repository** `svierk/salesforce-devops-starter-kit`:

| Need                                                | Path                                                                          |
| --------------------------------------------------- | ----------------------------------------------------------------------------- |
| A blueprint in full, with its copy-paste callers    | `docs/strategy/b1-simple-org-development.md` ... `b5-low-code-admin-first.md` |
| Blueprints side by side: workflows, settings, rules | `docs/strategy/mapping.md`                                                    |
| The reasoning: sandboxes, branching, release styles | `docs/strategy/background.md`                                                 |
| The questionnaire's routing as code                 | `docs/.vitepress/theme/strategy-routing.mjs`                                  |
| Inputs, secrets and outputs of a reusable workflow  | `.github/workflows/<name>.yml` (the `on.workflow_call` block)                 |
| A complete caller per reusable workflow             | `examples/<name>.yml`                                                         |
| JWT and Auth URL setup                              | `docs/authentication.md`                                                      |
| Security and pinning rules                          | `README.md`, section "Security & versioning"                                  |

Reusable workflows: `pr-validation.yml`, `deployment.yml`, `scratch-org-ci.yml`, `create-scratch-org.yml`, `promote.yml`. List the current set with:

```bash
gh api "repos/svierk/salesforce-devops-starter-kit/contents/.github/workflows?ref=$REF" --jq '.[].name'
```

Some files in that folder are the kit's own CI (`ci.yml`, `docs.yml`, `dependabot-auto-merge.yml`) - only files with `workflow_call` are meant to be called.

**Building blocks** - one repository each, inputs and outputs in `action.yml`, usage in `README.md`:

| Repository                         | Does                                                 |
| ---------------------------------- | ---------------------------------------------------- |
| `svierk/get-node-version`          | Resolve and set up Node.js from `package.json`       |
| `svierk/sfdx-cli-setup`            | Install the Salesforce CLI and plugins               |
| `svierk/sfdx-login`                | Authenticate via JWT or SFDX Auth URL                |
| `svierk/sfdx-create-scratch-org`   | Create a scratch org                                 |
| `svierk/sfdx-delete-scratch-org`   | Delete a scratch org                                 |
| `svierk/sfdx-deploy`               | Deploy, with delta and dry-run modes                 |
| `svierk/sfdx-run-tests`            | Apex, LWC (Jest) and Flow tests with coverage        |
| `svierk/sfdx-code-review`          | Code Analyzer, Prettier and ESLint as a quality gate |
| `svierk/sfdx-package-installation` | Install managed or unlocked packages                 |
| `svierk/sfdx-data-import`          | Import records via Bulk API 2.0 or sObject Tree      |
| `svierk/sfdx-assign-permissions`   | Assign permission sets, groups and licences          |
| `svierk/sfdx-apex-execute`         | Run anonymous Apex                                   |

The catalog grows. The authoritative list is the README table "Building Blocks" of the kit, or `blockCategories` in `scripts/docs/site.config.json`.

```bash
gh api -H "Accept: application/vnd.github.raw+json" "repos/svierk/sfdx-deploy/contents/action.yml?ref=v1.3.0"
```

## Documentation site

`https://svierk.github.io/salesforce-devops-starter-kit/` - link it for the team rather than pasting long passages:

- Questionnaire: `/strategy/`
- Blueprint pages: `/strategy/b1-simple-org-development`, `/strategy/b2-multi-team-environment-branches`, `/strategy/b3-modular-trunk`, `/strategy/b4-multi-org-regional`, `/strategy/b5-low-code-admin-first`
- Kit mapping and background: `/strategy/mapping`, `/strategy/background`
- Workflow pages with full input reference: `/workflows/<name>` (e.g. `/workflows/pr-validation`)
- Building block pages: `/blocks/<repository>` (e.g. `/blocks/sfdx-deploy`)

The site always shows the latest state of `main`; for a pinned release, read the repository at that tag.

The site also serves its content for agents - useful without a signed-in GitHub CLI, or to load a lot at once:

- `/llms.txt` - every page with a one-line summary; start here to find the right page
- `/llms-full.txt` - all pages in one Markdown file, including the full input reference of every workflow and building block; large, so prefer a single page when one will do
- `<page>.md` - the Markdown of any page, e.g. `/strategy/b2-multi-team-environment-branches.md`, with every link absolute

These reflect `main` as well. Use them to understand and explain; take versions and the callers you write from the repository at the release tag.

## Find the kit in a user's repository

```bash
grep -rnE 'svierk/[a-z0-9-]+(/\.github/workflows/[a-z-]+\.yml)?@' .github/workflows
```

Every hit is a pin to check: what it points at, which version, and whether that version is the latest release of that repository.
