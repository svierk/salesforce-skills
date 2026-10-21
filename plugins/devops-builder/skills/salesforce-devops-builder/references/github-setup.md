# GitHub setup

Everything around the workflow files that makes a blueprint real: environments, secrets, rulesets, the default branch, CODEOWNERS, the promotion app and Dependabot. All of it can be done with `gh`; each section starts with the read that shows the current state.

Set these once per session:

```bash
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
```

**Plan limits.** Required reviewers on environments, rulesets and branch protection on **private** repositories need a paid GitHub plan (Pro, Team or Enterprise). On a free plan they only work on public repositories. Check before promising an approval gate: `gh api "repos/$REPO" --jq '{private, owner: .owner.type}'` and ask about the plan if the repository is private.

## Environments

Which ones a blueprint needs is listed in [blueprints.md](blueprints.md). Deployment environments carry protection rules; validation twins (`<branch>-validation`) carry the same secrets and **no** rules, or every pull request waits for an approval.

```bash
# Current state
gh api "repos/$REPO/environments" --jq '.environments[] | {name, rules: [.protection_rules[].type]}'

# A validation twin - no rules
gh api -X PUT "repos/$REPO/environments/uat-validation"

# A deployment environment with required reviewers, deployable from protected branches only
REVIEWER_ID=$(gh api users/<login> --jq .id)            # a user
# REVIEWER_ID=$(gh api orgs/<org>/teams/<slug> --jq .id) # or a team - then "type": "Team"
gh api -X PUT "repos/$REPO/environments/production" --input - <<JSON
{
  "reviewers": [{ "type": "User", "id": $REVIEWER_ID }],
  "deployment_branch_policy": { "protected_branches": true, "custom_branch_policies": false }
}
JSON
```

Add reviewers to every environment that fronts a production org, and to `preprod` in B2. That approval is the release gate - and in a segregation-of-duties context, the control an auditor will ask about.

## Secrets

```bash
gh secret list                      # repository secrets
gh secret list --env production     # environment secrets
```

Setting them is covered in [authentication.md](authentication.md). Rules of thumb:

- One org - repository secrets are fine.
- Several orgs - environment secrets per org, `secrets: inherit` in the callers, so a job can only ever see the org its environment names.
- Scratch org flows read the Dev Hub credentials from **repository** secrets.
- `promote.yml` needs `PROMOTION_APP_ID` and `PROMOTION_APP_PRIVATE_KEY` (see below).

## Default branch

```bash
gh repo view --json defaultBranchRef -q .defaultBranchRef.name
gh repo edit --default-branch uat
```

The default branch is where new pull requests and tools target by default: `integration` for the B2 release train, `uat` for B5, `main` everywhere else. Create the long-lived branches before switching: `git push origin main:uat`.

## Rulesets

Prefer rulesets over classic branch protection: one ruleset can cover several branches, and they are readable via the API.

```bash
gh api "repos/$REPO/rulesets" --jq '.[] | {id, name, enforcement}'
gh api "repos/$REPO/rulesets/<id>"            # full definition
gh api "repos/$REPO/branches/main/protection" # classic protection, if any
```

A ruleset for the long-lived branches of a blueprint - adjust the branch list, approvals and checks to [blueprints.md](blueprints.md):

```bash
gh api -X POST "repos/$REPO/rulesets" --input - <<'JSON'
{
  "name": "Long-lived branches",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/main"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 1,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false
      }
    }
  ],
  "bypass_actors": []
}
JSON
```

- **Required status checks** come second. After the first validation run, read the exact check names - for a reusable workflow they look like `<caller job> / <called job>`:

  ```bash
  gh api "repos/$REPO/commits/<sha>/check-runs" --jq '.check_runs[].name'
  ```

  Then add a `required_status_checks` rule with `"strict_required_status_checks_policy": true` (branches must be up to date) and those names as `context`. A check name that never runs blocks every merge, so never guess one.

- **Restrict who can merge** (B2 release manager, B5 pipeline owner): an `update` rule plus the team as bypass actor with `"bypass_mode": "pull_request"`. Verify the result in Settings → Rules - this is the part of rulesets that is easiest to get subtly wrong.
- **CODEOWNERS review** (B3, B4): set `"require_code_owner_review": true` and commit a `.github/CODEOWNERS`, e.g. `packages/core/ @org/core-team` and `orgs/eu/ @org/eu-team`.
- **B2 release train:** environment-to-environment pull requests are merged with a merge commit, never squashed - add `"allowed_merge_methods": ["merge"]` to the `pull_request` parameters for those branches.
- **Tools that merge** - DevOps Center in B5, the promotion app in B2 - must still be able to do their job. Check after setup that one real promotion goes through.

## Promotion app for `promote.yml`

A pull request opened with the default `GITHUB_TOKEN` does not trigger other workflows, so PR validation would never run on a promotion. `promote.yml` therefore takes a GitHub App:

1. The user creates a GitHub App (Settings → Developer settings → GitHub Apps) with repository permissions **Contents: read and write** and **Pull requests: read and write**, no webhook, and installs it on the repository. This step has no `gh` command.
2. Generate a private key for the app and store both values:

   ```bash
   gh secret set PROMOTION_APP_ID --body "<app id>"
   gh secret set PROMOTION_APP_PRIVATE_KEY < ~/Downloads/<app>.private-key.pem
   ```

3. Delete the downloaded key file afterwards.

## Dependabot

Every pin is only as good as its update path. A minimal `.github/dependabot.yml` for the pipeline:

```yaml
version: 2
updates:
  - package-ecosystem: 'github-actions'
    directory: '/'
    schedule:
      interval: 'weekly'
    cooldown:
      default-days: 3
    groups:
      actions:
        patterns: ['*']
```

Dependabot bumps building blocks and reusable workflow references (`svierk/salesforce-devops-starter-kit/.github/workflows/<name>.yml@vX.Y.Z`) alike. It only reads `.github/workflows` - snippets in READMEs or docs stay manual.
