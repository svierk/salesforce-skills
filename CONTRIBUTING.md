# Contributing

Thanks for your interest in improving Salesforce Skills! 🙌

## How this repository is organized

```
.claude-plugin/marketplace.json       # lists every published plugin
plugins/
  <plugin>/
    .claude-plugin/plugin.json        # name, version, description
    README.md                         # what it does, requirements, install
    skills/<skill>/
      SKILL.md                        # when to use the skill, and the procedure
      references/                     # detail loaded only when a step needs it
      scripts/                        # deterministic checks and helpers (optional)
    hooks/hooks.json                  # guardrails that must not depend on instructions (optional)
schemas/                              # formats of files that skills write into user repositories
  examples/                           # one valid example per case, checked in CI
scripts/                              # checks for this repository
tests/<plugin>/                       # tests for hooks and scripts, run with npm test
tests/schemas/                        # checks that every plugin's reference covers its schema
```

One plugin per skill, so teams can install exactly what they need. Plugins of the same area share a name prefix (`devops-*`).

A plugin is installed on its own, so a skill can only read files inside its plugin folder. Knowledge that several plugins need - such as the project configuration format - lives in a reference file in each of them; the schema under `schemas/` is the canonical definition they follow.

## Changing a file format

Files that skills write into user repositories, such as `.github/salesforce-devops.yml`, are a contract with every repository that already has one.

- **Adding an optional field** is a minor change. Update the schema, an example, and the reference file of every plugin that reads or writes the format - `npm test` fails until each reference names the new field.
- **Renaming, removing or redefining a field** needs a new `version` of the format, and a major release of every plugin that writes it. Skills must keep reading the previous version, or say clearly that the file needs a migration.

## Writing a skill

- **The description decides when the skill is used.** State what it does, then `TRIGGER when:` and `DO NOT TRIGGER when:` with concrete requests. Make the boundary to neighbouring skills explicit - two skills that trigger on the same request help nobody.
- **Keep `SKILL.md` short** - well under 500 lines. It holds the procedure; detail goes into `references/`, linked from the step that needs it.
- **Do not copy facts that change.** Versions, inputs, option lists and examples belong to the tool or repository they describe. Tell the agent where to read them at run time.
- **Prefer scripts for checks that have one right answer.** A script is faster, cheaper and more reliable than prose that asks for the same check.
- **Use hooks for guardrails.** An instruction can be overlooked; a hook that blocks a force push cannot. Hooks run on every user's machine - write them in portable bash (3.2, BSD tools, no `jq`), keep them silent outside their scope, and test them under `tests/` against real repositories. Run the tests with macOS's bash too: `BASH_BIN=/bin/bash npm test`.
- **Write for the audience of the skill,** and in English - the agent answers in the user's language either way.

## Proposing changes

1. Open an issue describing the problem or idea first, so we can align on the approach.
2. Fork the repository and create a feature branch.
3. Run `npm run verify` - it checks formatting and validates the marketplace and every plugin manifest.
4. Try the skill on a real Salesforce repository: `claude --plugin-dir plugins/<plugin>` loads it from your working copy. Note the prompts you tested in the pull request.
5. Open a pull request and link the related issue. Pull requests are squash-merged, so the title becomes the commit message - write it as one.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/), scoped to the plugin a change belongs to:

```text
feat(devops-builder): add audit check for unpinned reusable workflows
fix(devops-builder): read required check names from the first run
docs(readme): explain team-wide installation
chore(ci): validate every plugin manifest
chore(release): bump devops-builder to 0.2.0
```

Changes that span the repository use `readme`, `ci`, `deps` or `setup` as scope.

## Versioning and releases

Each plugin is versioned on its own with [semantic versioning](https://semver.org/); the repository has no version of its own.

- **Major** - a plugin drops or changes something users rely on: a mode, a guardrail, the format of a file it writes.
- **Minor** - new capability: a mode, a flow, a reference, a hook.
- **Patch** - corrections: wrong facts, unclear steps, a skill that triggers when it should not.

Versions stay below `1.0.0` while a plugin is in preview.

The version in `plugin.json` is what Claude Code compares to offer an update, so it changes only in a release - never in a feature pull request. To release a plugin:

1. Bump `version` in `plugins/<plugin>/.claude-plugin/plugin.json` **and** in its entry in `.claude-plugin/marketplace.json`, and commit it as `chore(release): bump <plugin> to <version>`.
2. Tag the release - this validates that both versions agree and creates `<plugin>--v<version>`:

   ```bash
   claude plugin tag plugins/<plugin> --push
   ```

3. Publish a GitHub release for that tag: a one-line summary, the user-visible changes as a short list, and the full changelog link to the plugin's previous tag.

   ```bash
   gh release create devops-builder--v0.2.0 --title "devops-builder v0.2.0" --notes-file notes.md
   ```

## Code of conduct

Be respectful and constructive. This is a community project for the Trailblazer Community - let's keep it welcoming.
