# 🏗️ DevOps Builder

Design, set up and maintain a Salesforce CI/CD pipeline on GitHub Actions with the [Salesforce DevOps Starter Kit](https://github.com/svierk/salesforce-devops-starter-kit).

For whoever owns the pipeline - platform owner, tech lead, release manager. Day-to-day work on a single change is the job of the [DevOps Operator](../devops-operator); end-to-end UI tests and their test job are the job of the [E2E Automator](../e2e-automator); React and Angular UI bundles themselves are the job of the [Multi-Framework Wizard](../multi-framework-wizard) - their build before every deploy is set up here.

## What it does

| Mode                 | Example requests                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Design**           | "We are three teams on one org with a UAT sign-off - which setup fits?" · "Explain B2 vs. B3 for us"       |
| **Set up**           | "Set up B1 in this repository" · "Configure JWT auth and the GitHub Environments for UAT and production"   |
| **Audit & maintain** | "Review our Salesforce workflows" · "Upgrade us to the latest kit release" · "Are we ready to move to B3?" |

- **Design** runs the kit's five-question routing and lands on one of its five [blueprints](https://svierk.github.io/salesforce-devops-starter-kit/strategy/), with the reasoning, the risks and the next step.
- **Set up** goes from integration user and JWT auth through validation, deployment, environments and rulesets to a first test pull request. Every change to GitHub settings is shown and confirmed before it runs.
- **Audit & maintain** checks pins, permissions, secrets handling and gates against the kit's security rules, compares the setup with its blueprint, and plans upgrades from the release notes.

The skill reads versions, workflow inputs and blueprint callers from the kit at the current release rather than from its own text, so it does not go stale when the kit moves on.

## Requirements

- [GitHub CLI](https://cli.github.com/) (`gh`), signed in - for reading the kit and configuring the repository
- [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli) (`sf`) - for verifying org authentication
- `git` and `openssl`

Without `gh`, design and file changes still work; the GitHub settings then have to be made in the UI.

## Install

```text
/plugin marketplace add svierk/salesforce-skills
/plugin install devops-builder@salesforce-skills
```
