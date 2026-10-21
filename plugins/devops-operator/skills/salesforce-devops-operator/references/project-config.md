# Project configuration

`.github/salesforce-devops.yml` tells you how this team works. The pipeline owner (or the DevOps Builder) writes it; this skill only reads it. Never change it as a side effect of a flow - if it looks wrong, say so and point to the pipeline owner.

The canonical format is the JSON Schema at `https://raw.githubusercontent.com/svierk/salesforce-skills/main/schemas/salesforce-devops.schema.json`. A `version` other than `1` is a newer format than this skill knows: read what you recognise, and tell the user to update the plugin.

## What each field decides

| Field                  | Use it for                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| `blueprint`, `variant` | What happens after a merge, and how promotion works - see the tables in SKILL.md and [promote.md](promote.md) |
| `environments`         | Branches nobody commits to directly. The last one fronts production                                           |
| `base`                 | Where new work starts: `git switch -c <branch> origin/<base>`                                                 |
| `branches.feature`     | The name of a new work branch                                                                                 |
| `branches.promotion`   | The name of a promotion branch (B2 story promotion, release bundle)                                           |
| `items.tracker`        | Where to look up the story - `gh issue view` for `github`, otherwise ask the user                             |
| `items.pattern`        | Check a key the user gives you; find the key in a branch name                                                 |
| `items.url`            | Link the story in the pull request description                                                                |
| `commits.style`        | `conventional` - `type: subject` · `plain` - a short imperative sentence                                      |
| `commits.item`         | Where the story key goes - subject, `Refs:` footer, or nowhere                                                |
| `development.org`      | Shared sandbox (claim it, retrieve only your own changes), own sandbox, or scratch org                        |
| `development.retrieve` | `cli` - this skill retrieves · `devops-center` or `sfdx-hardis` - guide the user through that tool instead    |
| `promotion.tool`       | How promotion works - see [promote.md](promote.md)                                                            |

Branch patterns use `{item}` (story key), `{slug}` (a short kebab-case description, at most about 40 characters, ASCII only), `{stage}` (target environment branch) and `{name}` (release name).

## Without the file

Work out the conventions from the repository, tell the user what you assumed, and suggest adding the file:

- **Environment branches:** `main`, `master` and the default branch (`git symbolic-ref --short refs/remotes/origin/HEAD`), plus long-lived branches named like stages - `integration`, `develop`, `uat`, `qa`, `staging`, `preprod` - if they exist on the remote (`git ls-remote --heads origin`).
- **Base:** the default branch.
- **Branch names:** follow what recent branches look like (`git branch -r --sort=-committerdate | head -20`); otherwise `feature/<key>-<slug>`.
- **Commit style:** follow the last commits (`git log --format=%s -30`); otherwise Conventional Commits with the key as `Refs:` footer.
- **Promotion:** look for a workflow that calls the kit's `promote.yml` (`grep -l 'promote.yml' .github/workflows/*`). If there is none, promotion is a pull request someone with merge rights opens.

The hooks use the same fallback for environment branches, so they protect `main` even without the file.
