# Promote

Goal: a story moves to the next stage the way this team does it - and the user knows who decides what.

Promotion is often a role, not a right: in B2, only the release manager merges into `uat`, `preprod` and `main`. The user may be able to **prepare** a promotion (open the pull request) but not to **complete** it. Say so up front, and say who completes it.

## By `promotion.tool`

### `promote-workflow` - the kit's promotion workflow

The repository has a caller of the kit's `promote.yml` (named in `promotion.workflow`). It cuts a promotion branch from the target stage, merges the story into it and opens the pull request - so the user does not have to do any of that by hand.

1. **Read the caller's form.** The inputs are defined in the caller, not here - read `on.workflow_dispatch.inputs` in `.github/workflows/<promotion.workflow>`. The kit's example caller has `target`, `sources`, `base` and `branch`.
2. **Fill it in with the user** - for a story into a stage: `target` = the stage, `sources` = the work branch. Confirm, then start it:

   ```bash
   gh workflow run promote.yml -f target=uat -f sources=feature/ABC-123-discount-approval
   gh run list --workflow promote.yml --limit 1      # find the run
   gh run watch <run-id>
   ```

3. **Success:** the run opened a pull request from `promotion/<story>-<stage>` into the stage - find it with `gh pr list --base uat`. Its checks validate the story merged with that stage's state, in that stage's org. Hand over the link and say who reviews and merges.
4. **Conflict:** the run stops, and its summary lists the conflicting files and the commands to finish locally (`gh run view <run-id>`). Walk through them: the conflict is solved **on the promotion branch**, never on the work branch, so the story stays clean for the next stage - then follow [update-and-conflicts.md](update-and-conflicts.md#conflicts) per file, push the promotion branch and open the pull request.

The same workflow serves the release manager for **release bundles** (sources = the signed-off stories, base `main`, branch `release/<name>`) and the **sync after a release** (sources `main` into each stage). If the user has that role, explain the step; otherwise point them to the release manager.

### `pull-request` - promotion is a pull request between stages

Release train (B2) and the Git route of B5: the release manager opens a pull request from one environment branch into the next, e.g. `integration` into `uat`. If the user has that role:

```bash
gh pr create --base uat --head integration --title "Promote integration to uat"
```

Merge environment-to-environment pull requests with a **merge commit**, never squashed - the next promotion's scope is computed from that history. Otherwise: tell the user their story is in `integration` and travels up with the next release.

### `devops-center`

Promotion happens in DevOps Center's pipeline view, not in Git. Guide the user through it there. Changes merged outside DevOps Center confuse it - do not promote by hand alongside it.

### `none`

There is no promotion: merging the pull request into the base branch is the release (B1, B3, B4). Explain what merging will trigger before anyone merges.

## Into production

The last step always has a human gate - required reviewers on the production environment. When a deployment waits for approval, that is the gate working, not a failure. The user can see it with `gh run list --branch main --limit 3`.

## After a release (B2 story promotion and release bundle)

Each stage holds different stories, so the stages drift apart by design. After a production release, `main` is merged back into every stage through pull requests - usually by the release manager or an automation. If a user's promotion keeps conflicting on files they never touched, a missing sync is the likely cause - mention it to the release manager.
