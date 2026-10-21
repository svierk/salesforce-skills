# 🧭 DevOps Operator

Guided day-to-day work on a Salesforce project in Git and GitHub - from the org into a branch, through review, on to the next stage. Written for the people who ship changes but do not live in a terminal: admins, low-code builders, consultants. Developers get the same flows, with less explanation.

The pipeline itself is the job of the [DevOps Builder](../devops-builder).

## What it does

| Flow                 | Example requests                                                                   |
| -------------------- | ---------------------------------------------------------------------------------- |
| **Start work**       | "I'm starting on ABC-123" · "Create a branch for the discount approval story"      |
| **Bring changes in** | "Get my flow changes from the sandbox" · "What did I change in the org this week?" |
| **Commit**           | "Save my work" · "Commit the new field and the flow, but not the profile"          |
| **Pull request**     | "Send it for review" · "Open a draft pull request"                                 |
| **Read the checks**  | "Why is my pull request red?" · "What does this validation error mean?"            |
| **Update & resolve** | "Update my branch" · "It says there is a conflict in the permission set"           |
| **Promote**          | "Move ABC-123 to UAT" · "The story is signed off - what now?"                      |
| **Undo**             | "I committed on main" · "I retrieved too much" · "Undo my last commit"             |

Every step is explained before it runs, in the user's language. Anything that leaves the machine or throws work away - pushing, opening or merging a pull request, starting a workflow, discarding changes - is confirmed first.

## Guardrails

The plugin ships a hook that checks every `git` and `gh` command the agent runs in a Salesforce project:

- **Blocked:** force pushes, pushes to an environment branch, and commits, merges, rebases or cherry-picks on an environment branch. The agent gets the reason and the safe alternative.
- **Confirmed first:** commands that throw work away (`reset --hard`, `clean`, `restore`, `checkout -- <files>`, `branch -D`, `stash drop`, deleting a remote branch) and merging a pull request.

Environment branches come from the project configuration (below); without it, `main`, `master` and the default branch are protected. Outside Salesforce projects - no `sfdx-project.json` and no configuration file - the hook does nothing. It applies to every session in which the plugin is enabled, not only when the skill is in use.

## Project configuration

The operator reads [`.github/salesforce-devops.yml`](../../README.md#-project-configuration) in the project repository - blueprint, environment branches, where new work starts, branch naming, work items and commit style - so it follows the team's conventions instead of guessing. The DevOps Builder writes that file when it sets the pipeline up. Without it, the operator infers the conventions from the repository and says what it assumed.

## Requirements

- `git` and `bash` (on Windows, Git Bash - which Claude Code uses anyway)
- [GitHub CLI](https://cli.github.com/) (`gh`), signed in
- [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli) (`sf`), with the user's development org authorised

## Install

```text
/plugin marketplace add svierk/salesforce-skills
/plugin install devops-operator@salesforce-skills
```

In editors without the `/plugin` command, use the CLI: `claude plugin marketplace add svierk/salesforce-skills`, then `claude plugin install devops-operator@salesforce-skills`.
