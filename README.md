# 🧠 Salesforce Skills

Agent skills for Salesforce teams. Each skill packages the know-how for one kind of work - the questions to ask, the steps to take, the tools to use and the mistakes to avoid - so an AI coding agent can do that work the way an experienced practitioner would.

Skills are plain Markdown in the open [Agent Skills](https://agentskills.io) format (`SKILL.md`). This repository publishes them as a plugin marketplace, one plugin per skill, so a team installs only what it needs.

## 🧩 Skills

### DevOps

Built around the [Salesforce DevOps Starter Kit](https://github.com/svierk/salesforce-devops-starter-kit) - GitHub-native CI/CD from small, composable GitHub Actions, with a strategy guide that maps teams to one of five blueprints.

| Plugin                                        | For                         | Does                                                                                        | Status  |
| --------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------- | ------- |
| [🏗️ devops-builder](plugins/devops-builder)   | Pipeline owners, tech leads | Choose a blueprint, set up the pipeline and GitHub around it, audit and upgrade it          | Preview |
| [🧭 devops-operator](plugins/devops-operator) | Everyone who ships changes  | Guided branches, retrieves, commits, pull requests, checks and promotions in plain language | Preview |

### Testing

Built around the [Salesforce UTAM E2E Testing](https://github.com/svierk/salesforce-utam-e2e-testing) template - end-to-end UI tests for Lightning Experience with [UTAM](https://developer.salesforce.com/docs/platform/utam) page objects, WebdriverIO and the page objects Salesforce publishes for every release.

| Plugin                                    | For                                  | Does                                                                                                 | Status  |
| ----------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------- | ------- |
| [🧪 e2e-automator](plugins/e2e-automator) | Developers, testers, test automation | Turn stories into UTAM UI tests, write page objects for custom components, fix and upgrade the suite | Preview |

### Development

Built around the [Awesome LWC Collection](https://github.com/svierk/awesome-lwc-collection) - ready-to-use Lightning Web Components with Jest tests, accessibility checks and documentation, and the project setup around them.

| Plugin                                | For                   | Does                                                                                                                 | Status  |
| ------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------- | ------- |
| [⚡ lwc-crafter](plugins/lwc-crafter) | Salesforce developers | Build, fix and review Lightning Web Components - reuse first, secure, tested and accessible - and set up the tooling | Preview |

### Showcase

Built on Playwright, Google Chrome and ffmpeg - demo videos of Salesforce orgs, apps and sites, recorded from a real browser along a scripted click path and finished like a hand-edited screencast.

| Plugin                                    | For                                               | Does                                                                                                                                              | Status  |
| ----------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| [🎬 demo-designer](plugins/demo-designer) | Consultants, presales, developers, product owners | Storyboard, record and render demo videos with cursor, captions, cards and subtitles - for bids and pitches, sprint reviews, teasers and training | Planned |

## 🚀 Install

In Claude Code:

```text
/plugin marketplace add svierk/salesforce-skills
/plugin install devops-builder@salesforce-skills
/plugin install devops-operator@salesforce-skills
/plugin install e2e-automator@salesforce-skills
/plugin install lwc-crafter@salesforce-skills
```

In editors without the `/plugin` command, the CLI does the same: `claude plugin marketplace add svierk/salesforce-skills`, then `claude plugin install <plugin>@salesforce-skills`.

To give a whole team the skills, add the marketplace and the plugins to the **project's** settings file in your Salesforce repository - everyone who opens the repository is offered them:

```json
{
  "extraKnownMarketplaces": {
    "salesforce-skills": {
      "source": { "source": "github", "repo": "svierk/salesforce-skills" }
    }
  },
  "enabledPlugins": {
    "devops-builder@salesforce-skills": true,
    "devops-operator@salesforce-skills": true,
    "e2e-automator@salesforce-skills": true,
    "lwc-crafter@salesforce-skills": true
  }
}
```

Other agents that read `SKILL.md` can use the skill folders under `plugins/*/skills/` directly.

Each plugin is versioned and [released](https://github.com/svierk/salesforce-skills/releases) on its own, tagged `<plugin>--v<version>`. `/plugin marketplace update salesforce-skills` picks up new releases.

## 📄 Project configuration

The DevOps skills share one small file in your Salesforce repository, `.github/salesforce-devops.yml`. It records how the team works - blueprint, environment branches, where new work starts, branch naming, work items, commit style, how changes are promoted - so no skill has to guess, and a new joiner has the short answer to "how do we work here?". The DevOps Builder writes it during setup; you can also write it by hand:

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/svierk/salesforce-skills/main/schemas/salesforce-devops.schema.json
version: 1
blueprint: B1
environments: [main]
base: main
branches:
  feature: feature/{item}-{slug}
items:
  tracker: github
  pattern: '\d+'
commits:
  style: conventional
  item: footer
promotion:
  tool: none
```

The [JSON Schema](schemas/salesforce-devops.schema.json) gives editors validation and autocompletion through the first line; [schemas/examples](schemas/examples) has a file for every blueprint.

## 🧱 Principles

- **Facts come from the source.** Skills read versions, inputs and configuration from the tools and repositories they work with at run time, instead of carrying copies that go stale.
- **Show before changing.** Anything that affects the team - repository settings, secrets, protected branches, orgs - is shown as exact commands and run only after confirmation.
- **CLI first.** Skills work through the official command line tools - `sf`, `gh`, `git` - so every step is transparent and reproducible by hand.
- **Plain language for the people doing the work.** Skills explain what they do in the terms of their audience, not in the terms of the tool.

## 🤝 Contributing

Ideas, bug reports and new skills are welcome - see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Released under the [MIT License](LICENSE).
