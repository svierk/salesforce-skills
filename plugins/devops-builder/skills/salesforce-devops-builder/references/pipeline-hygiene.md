# Pipeline hygiene

Rules for every workflow file in a Salesforce pipeline, whatever the blueprint. The kit's own workflows follow them, and its README section "Security & versioning" is the user-facing version. Use the first half when writing files, the checklist at the end when auditing.

## Supply chain

- **Exact versions only.** `svierk/sfdx-deploy@v1.3.0`, never `@main` or `@v1`. A mutable ref runs whatever sits on it at run time, with access to org credentials.
- **Strictest option:** a full commit SHA with the version as a comment (`@a1b2c3d... # v1.3.0`), recommended for third-party actions whose publisher you do not control.
- **Dependabot** for `github-actions`, so pins are bumped through reviewed pull requests instead of ageing - see [github-setup.md](github-setup.md).

## Token and credentials

- **Least-privilege `GITHUB_TOKEN`.** A `permissions:` block in every workflow - `contents: read` in most cases. A reusable workflow never gets more than the caller grants: the `pr-validation.yml` caller needs `security-events: write` for its SARIF upload, the `promote.yml` caller `contents: write` and `pull-requests: write` as a fallback.
- **`persist-credentials: false`** on every `actions/checkout` the user writes, so later steps cannot reuse the token.
- **Secrets travel as secrets.** Through `secrets:` of a reusable workflow, `secrets: inherit`, or an action input. In `run:` scripts, read them from environment variables (`"$TARGET_ORG"`), never by interpolating `${{ ... }}` into the script - that allows command injection and can leak values into the log. The same applies to any `github.event.*` value an outsider can control (branch names, PR titles).
- **`pull_request`, never `pull_request_target`,** for validation. The latter runs fork code with the base repository's secrets.
- **Mask what you generate.** Values created at run time (a scratch org password) get `::add-mask::` before anything can print them.

## Gates

- **Production behind a GitHub Environment** with required reviewers - the `environment` input of `deployment.yml`.
- **Validation is a required status check**, not a suggestion. A gate people can merge past is not a gate.
- **Test level explicit** in every deploy and validation caller. `RunLocalTests` for production. `RunRelevantTests` is a beta (Spring '26) - acceptable in validation runs, not yet for production. `NoTestRun` only for check-only runs where tests are not the point, never for a real deployment.

## Deployment mode

- **Delta on validation** - a pull request only needs to prove what it changed.
- **Full on stage-to-stage promotion** in most blueprints - a delta between long-lived branches would skip whatever an earlier hop missed.
- **Exception:** B2 story promotion and release bundle deploy the delta of each merge (`delta-from: ${{ github.event.before }}`), and B3 deploys the delta since the last release. Both need a regular full check-only validation of every long-lived branch to catch what deltas hide.
- **Destructive changes** are a deliberate, reviewed step. Removing a field or object is far harder to undo than adding one.

## Beyond the pipeline

Name these in every setup, because no workflow solves them:

- **Backup and recovery** with a stated RPO/RTO - Salesforce has no rollback.
- **Drift detection** - a scheduled comparison between each org and its branch, so changes made directly in an org show up before they break a deployment.
- **Integration user** per org, dedicated and least-privilege - see [authentication.md](authentication.md).

## Audit checklist

Run from the root of the user's repository:

```bash
# Mutable refs - any hit is a finding
grep -rnE 'uses: *[^ ]+@(main|master|v[0-9]+)\s*$' .github/workflows

# All pins, to compare with the latest releases (see kit-sources.md)
grep -rnoE 'uses: *[^ ]+@[^ ]+' .github/workflows

# Workflows without a top-level permissions block
for f in .github/workflows/*.y*ml; do grep -qE '^permissions:' "$f" || echo "no permissions: $f"; done

# pull_request_target anywhere
grep -rn 'pull_request_target' .github/workflows

# Secrets and event values in expressions - review whether each hit sits inside a run: script
grep -rnE '\$\{\{ *(secrets|github\.event)\.' .github/workflows

# Checkouts - each one should set persist-credentials: false
grep -rn -A6 'uses: *actions/checkout' .github/workflows
```

Then, per finding class:

| Severity | Check                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------- |
| High     | `pull_request_target` combined with checkout of the PR head or with secrets                       |
| High     | `${{ secrets.* }}` or attacker-controlled `${{ github.event.* }}` inside a `run:` script          |
| High     | Production deployment without an environment, or an environment without required reviewers        |
| High     | Mutable refs (`@main`, `@v1`) on any action that sees org credentials                             |
| Medium   | No `permissions:` block, or broader permissions than the workflow needs                           |
| Medium   | Validation not a required status check; force pushes or deletions allowed on long-lived branches  |
| Medium   | One repository-wide secret set used for several orgs                                              |
| Medium   | Pins more than one minor version behind the latest release, or no Dependabot for `github-actions` |
| Low      | `persist-credentials` not set to `false`; test level left implicit                                |
| Low      | Delta-only deployments without a periodic full validation                                         |

End the audit with what is already in good shape, so the user knows what not to touch.
