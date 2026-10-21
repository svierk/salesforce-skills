# Project configuration

`.github/salesforce-devops.yml` records how a team works in a repository - the decisions from Design and Set up that nothing else in the repository states. Other skills read it instead of guessing; the DevOps Operator, for example, needs it to know which branch new work starts from and how branches are named. People read it too: it is the shortest answer to "how do we work here?".

The file holds **only what cannot be read elsewhere.** Package directories come from `sfdx-project.json`, workflow inputs from the workflow files, protection rules from GitHub. Do not add fields for them.

The JSON Schema is published at `https://raw.githubusercontent.com/svierk/salesforce-skills/main/schemas/salesforce-devops.schema.json`. The first line of the file points to it, so editors with YAML language support validate and autocomplete it.

## Example

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/svierk/salesforce-skills/main/schemas/salesforce-devops.schema.json
version: 1
blueprint: B2
variant: story-promotion
environments: [integration, uat, preprod, main]
base: main
branches:
  feature: feature/{item}-{slug}
  promotion: promotion/{item}-{stage}
items:
  tracker: jira
  pattern: '[A-Z][A-Z0-9]+-\d+'
  url: https://acme.atlassian.net/browse/{item}
commits:
  style: conventional
  item: subject
development:
  org: own-sandbox
  retrieve: cli
promotion:
  tool: promote-workflow
  workflow: promote.yml
```

## Fields

| Field                  | Required                | Values                                                                                         | Meaning                                                                       |
| ---------------------- | ----------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `version`              | yes                     | `1`                                                                                            | Format version of this file                                                   |
| `blueprint`            | yes                     | `B1` ... `B5`                                                                                  | The kit blueprint the repository follows                                      |
| `variant`              | B2, B4                  | B2: `release-train`, `story-promotion`, `release-bundle` · B4: `shared-core`, `per-org-chains` | What travels between stages, or the repository shape                          |
| `environments`         | yes                     | branch names                                                                                   | Org-bound long-lived branches, lowest stage first; the last fronts production |
| `base`                 | yes                     | branch name                                                                                    | Where new work starts                                                         |
| `branches.feature`     | -                       | pattern, default `feature/{item}-{slug}`                                                       | Name of a work branch                                                         |
| `branches.hotfix`      | -                       | pattern                                                                                        | B2 release train: urgent fixes entering at `preprod`                          |
| `branches.promotion`   | -                       | pattern with `{stage}`                                                                         | B2 story promotion and release bundle: one story into one stage               |
| `branches.release`     | -                       | pattern with `{name}`                                                                          | B2 release bundle, B3 stabilisation, B4 rollout per org                       |
| `items.tracker`        | -                       | `github`, `jira`, `azure-boards`, `devops-center`, `other`, `none`                             | Where work items live                                                         |
| `items.pattern`        | -                       | regular expression                                                                             | What a work item key looks like                                               |
| `items.url`            | -                       | URL with `{item}`                                                                              | Link to one work item, for pull request descriptions                          |
| `commits.style`        | -                       | `conventional` (default), `plain`                                                              | Commit message convention                                                     |
| `commits.item`         | -                       | `subject`, `footer` (default), `none`                                                          | Where the work item key goes                                                  |
| `development.org`      | -                       | `shared-sandbox`, `own-sandbox`, `scratch-org`                                                 | Where people build                                                            |
| `development.retrieve` | -                       | `cli` (default), `devops-center`, `sfdx-hardis`                                                | How changes get from that org into Git                                        |
| `promotion.tool`       | -                       | `promote-workflow`, `pull-request`, `devops-center`, `none`                                    | How a change moves between environment branches                               |
| `promotion.workflow`   | with `promote-workflow` | file name in `.github/workflows`                                                               | The caller of the kit's `promote.yml`                                         |

Placeholders in branch patterns: `{item}` work item key, `{slug}` short kebab-case description, `{stage}` target environment branch, `{name}` release name. Literal text is allowed around them.

## Values per blueprint

Start from these and change only what the team decided differently:

| Blueprint          | `environments`                        | `base`        | `branches` beyond `feature`          | `promotion.tool`                                            | `development.org` |
| ------------------ | ------------------------------------- | ------------- | ------------------------------------ | ----------------------------------------------------------- | ----------------- |
| B1                 | `[main]`                              | `main`        | -                                    | `none`                                                      | `own-sandbox`     |
| B2 release train   | `[integration, uat, preprod, main]`   | `integration` | `hotfix`                             | `pull-request`                                              | `own-sandbox`     |
| B2 story promotion | `[integration, uat, preprod, main]`   | `main`        | `promotion`                          | `promote-workflow`                                          | `own-sandbox`     |
| B2 release bundle  | `[integration, uat, preprod, main]`   | `main`        | `promotion`, `release`               | `promote-workflow`                                          | `own-sandbox`     |
| B3                 | `[main]`                              | `main`        | `release` if releases are stabilised | `none`                                                      | `scratch-org`     |
| B4 shared core     | `[main]`                              | `main`        | `release`                            | `none`                                                      | `scratch-org`     |
| B4 per-org chains  | per org repository, as its B2 variant | as B2         | as B2                                | as B2                                                       | as B2             |
| B5                 | `[uat, main]`                         | `uat`         | -                                    | `devops-center`, or `pull-request` on the sfdx-hardis route | `shared-sandbox`  |

B2 at maturity level 1 starts with `environments: [uat, main]`. In B5 with DevOps Center, set `items.tracker` and `development.retrieve` to `devops-center` as well - work items and branches belong to the tool there.

## Writing it

During Set up, once the branches and workflows exist:

1. Fill the file from the design decisions and the table above. Ask for what you do not know - the tracker, the key format, the commit convention the team already uses (`git log --format=%s -30` shows it).
2. Check it against the repository: every `environments` entry and `base` exists as a remote branch (`git ls-remote --heads origin`), and `promotion.workflow` exists in `.github/workflows`.
3. Validate it against the schema if a validator is at hand - for example `npx --yes ajv-cli@5 validate --spec=draft2020 -s <schema file> -d .github/salesforce-devops.yml` after downloading the schema.
4. Commit it with the workflows, so the team reviews the conventions together with the pipeline.

## Auditing it

- **Missing file** - suggest writing it, and say what it gives the team.
- **Drift** - environment branches that no longer exist, a `base` that is not the GitHub default branch where the blueprint says it should be, a `promotion.workflow` that was renamed, a blueprint that no longer matches the callers.
- **Inconsistency with the blueprint** - e.g. B5 with three environments, or B2 story promotion with `base` other than `main`. Either the file or the setup is wrong. Ask which.
- **Unknown `version`** - a newer format than this skill knows. Do not rewrite it; tell the user to update the plugin.
