# 🧭 DevOps Operator

> **Status: planned.** This plugin is not listed in the marketplace yet and ships no skill.

Guided day-to-day work on a Salesforce project in Git and GitHub, aimed at team members who do not live in a terminal - admins, low-code builders, consultants. The skill explains every step in plain language before it runs it.

## Planned scope

- **Start a story** - create a branch from the right base, named after the work item.
- **Bring changes in from a sandbox** - preview and retrieve with the Salesforce CLI, and explain what changed.
- **Commit with intent** - stage only what belongs to the story, keep noise out, write a clear message.
- **Open a pull request** - with the repository's template and a readable summary.
- **Read the checks** - turn a failed validation, test or code review run into an explanation and a next step.
- **Keep the branch current** - update from its base and walk through metadata conflicts.
- **Promote** - start the kit's promotion workflow for a story, a bundle or the sync after a release.
- **Undo safely** - recover from the usual mistakes without losing work.

## Planned guardrails

Hooks, not only instructions: the plugin will block force pushes, direct commits to protected branches and destructive resets, so a mistake is stopped before it happens rather than explained afterwards.

## Project configuration

The operator reads [`.github/salesforce-devops.yml`](../../README.md#-project-configuration) in the project repository - blueprint, environment branches, where new work starts, branch naming, work items and commit style - so it never has to guess how a team works. The [DevOps Builder](../devops-builder) writes that file when it sets the pipeline up.
