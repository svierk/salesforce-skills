# ☁️ Salesforce Skills

Agent skills for Salesforce teams. Each skill packages the know-how for one kind of work - the questions to ask, the steps to take, the tools to use and the mistakes to avoid - so an AI coding agent can do that work the way an experienced practitioner would.

Skills are plain Markdown in the open [Agent Skills](https://agentskills.io) format (`SKILL.md`). This repository publishes them as a plugin marketplace, one plugin per skill, so a team installs only what it needs.

## 🧩 Skills

### DevOps

Built around the [Salesforce DevOps Starter Kit](https://github.com/svierk/salesforce-devops-starter-kit) - GitHub-native CI/CD from small, composable GitHub Actions, with a strategy guide that maps teams to one of five blueprints.

| Plugin                                        | For                         | Does                                                                                        | Status  |
| --------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------- | ------- |
| [🏗️ devops-builder](plugins/devops-builder)   | Pipeline owners, tech leads | Choose a blueprint, set up the pipeline and GitHub around it, audit and upgrade it          | Preview |
| [🧭 devops-operator](plugins/devops-operator) | Everyone who ships changes  | Guided branches, retrieves, commits, pull requests, checks and promotions in plain language | Planned |

## 🚀 Install

In Claude Code:

```text
/plugin marketplace add svierk/salesforce-skills
/plugin install devops-builder@salesforce-skills
```

To give a whole team the skills, add the marketplace and the plugins to the **project's** settings file in your Salesforce repository - everyone who opens the repository is offered them:

```json
{
  "extraKnownMarketplaces": {
    "salesforce-skills": {
      "source": { "source": "github", "repo": "svierk/salesforce-skills" }
    }
  },
  "enabledPlugins": {
    "devops-builder@salesforce-skills": true
  }
}
```

Other agents that read `SKILL.md` can use the skill folders under `plugins/*/skills/` directly.

Each plugin is versioned and [released](https://github.com/svierk/salesforce-skills/releases) on its own, tagged `<plugin>--v<version>`. `/plugin marketplace update salesforce-skills` picks up new releases.

## 🧱 Principles

- **Facts come from the source.** Skills read versions, inputs and configuration from the tools and repositories they work with at run time, instead of carrying copies that go stale.
- **Show before changing.** Anything that affects the team - repository settings, secrets, protected branches, orgs - is shown as exact commands and run only after confirmation.
- **CLI first.** Skills work through the official command line tools - `sf`, `gh`, `git` - so every step is transparent and reproducible by hand.
- **Plain language for the people doing the work.** Skills explain what they do in the terms of their audience, not in the terms of the tool.

## 🤝 Contributing

Ideas, bug reports and new skills are welcome - see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Released under the [MIT License](LICENSE).
