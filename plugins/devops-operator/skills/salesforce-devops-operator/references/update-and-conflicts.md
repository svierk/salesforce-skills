# Update a branch and resolve conflicts

## Update

Goal: the work branch contains everything that landed on its target since it started, so the pull request validates against today's state.

```bash
git fetch origin
git log --oneline HEAD..origin/main     # what is new on the target (origin/<target>)
git merge origin/main
git push                                 # confirm first
```

**Merge, don't rebase.** A merge adds one commit and never needs a force push; a rebase rewrites the branch, and pushing it afterwards would be blocked. That trade-off is right for everyone who is not a Git expert, and harmless for those who are - the pull request is squashed or merged anyway.

Before merging, commit or stash local changes - a merge into a dirty working copy is where people lose work.

**B2 story promotion:** do not merge `uat`, `integration` or `preprod` into a feature branch - it would carry other stories along. Feature branches only ever take in `main`. Conflicts with a stage are solved on the promotion branch - see [promote.md](promote.md).

## Push rejected

GitHub rejects a push when the branch on GitHub has commits the local branch does not - usually a teammate pushed to it, or the branch was updated through the web. Never force-push it away: those commits are someone's work, and the hook blocks it anyway. Look first, then merge:

```bash
git fetch origin
git log --oneline HEAD..origin/<branch>        # what is on GitHub but not here - and who wrote it
git merge origin/<branch>
git push
```

Merge here too, not `git pull --rebase` - the same reasoning as above. If the commits on GitHub look wrong or unexpected, ask whoever made them before going on.

## Conflicts

A conflict means the same part of a file changed on both sides. Git stops the merge and marks the files:

```bash
git status --short                   # UU = conflicted
git diff --name-only --diff-filter=U
```

Go through the files **one at a time**, explain what each side changed, and decide with the user. Never resolve everything with "ours" or "theirs" in one go - that silently drops one side's work.

How to resolve depends on the component:

| Component                                                               | What to do                                                                                                                                                                                       |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Profiles, permission sets, custom labels, picklist values, translations | Lists of independent entries - usually **keep both**: every entry from either side, each once, XML still valid                                                                                   |
| Flows                                                                   | Cannot be merged by hand reliably. Pick the version that matches what should exist, then **rebuild the other side's change in the org** and retrieve again - or ask the colleague who changed it |
| Page layouts, Lightning pages, flexipages                               | Like flows: pick one, rebuild the other change in the org                                                                                                                                        |
| Apex, LWC, Aura                                                         | Code merge - show both sides, combine them; a developer should check the result                                                                                                                  |
| `sfdx-project.json`, `package.xml`, config files                        | Combine both sides' entries; check the result is valid JSON or XML                                                                                                                               |

Some teams use a Salesforce-aware merge driver (such as sf-git-merge-driver) that merges profiles, permission sets and labels by key automatically - if `git config --get-regexp merge` shows one, fewer conflicts will reach you.

After each file is resolved:

```bash
git add <file>
```

When all files are resolved, finish the merge with `git commit` (Git suggests the message), then push. Before pushing, check that the result still makes sense - for metadata, a check-only deploy into the user's own org is a good test: `sf project deploy start --dry-run --source-dir force-app --target-org <their alias>`.

**Escape hatch:** `git merge --abort` returns to the state before the merge, nothing lost. Offer it whenever the user is unsure.
