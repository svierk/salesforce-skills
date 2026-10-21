# Start work and bring changes in

## Start work

Goal: a fresh work branch, started from the right place, named after the story.

1. **Check for leftovers.** If `git status` shows changes, find out whose they are before anything else. Changes from an earlier story belong on that story's branch - commit them there, or park them with `git stash push -m "<what>"` and say how to get them back (`git stash pop`). Never carry unrelated changes into a new story.
2. **Find the story.** Ask for the key if the user did not give one, and check it against `items.pattern`. For GitHub issues, read the title: `gh issue view <number> --json title,url`. For other trackers, ask for a short description.
3. **Name the branch** from `branches.feature`, e.g. `feature/ABC-123-discount-approval`. Show the name and let the user change it.
4. **Create it from the base**, never from whatever happens to be checked out:

   ```bash
   git fetch origin
   git switch -c feature/ABC-123-discount-approval origin/main   # origin/<base>
   ```

5. **Check the org.** Ask which org they build in and set it for this project if needed: `sf org list`, then `sf config set target-org <alias>`. In a **shared sandbox**, remind them of the team's agreement to claim it before editing - two people changing the same flow at once cannot be merged afterwards.

Pushing the new branch can wait until the first commit.

**Scratch orgs.** If the team works in scratch orgs and the repository has a caller of the kit's `create-scratch-org.yml`, a fresh org is one form in the Actions tab: `gh workflow list`, then `gh workflow run <file>` with its inputs. The run summary lists the login details.

**DevOps Center or sfdx-hardis** (`development.retrieve`): work items and branches are created by that tool. Guide the user through the tool rather than creating branches yourself, and stay available for questions about checks and pull requests.

## Bring changes in

Goal: exactly the changes that belong to this story, from the org into the branch - and nothing else.

### With source tracking

Scratch orgs and Developer / Developer Pro sandboxes with source tracking know what changed since the last retrieve:

```bash
sf project retrieve preview --target-org <alias>
```

The preview lists components by type and name. **Go through the list with the user** and pick what belongs to the story - in a shared sandbox it contains everyone's changes. Then retrieve only those:

```bash
sf project retrieve start --target-org <alias> \
  --metadata "Flow:Discount_Approval" \
  --metadata "CustomField:Opportunity.Discount_Percent__c"
```

Retrieve everything (`sf project retrieve start` without `--metadata`) only when the org is the user's own and every change in it belongs to the story.

If the retrieve reports **conflicts**, the same component changed locally and in the org. Stop and find out which version is right - do not reach for `--ignore-conflicts`.

### Without source tracking

Partial Copy and Full sandboxes, and sandboxes without tracking enabled, cannot list their changes. Find candidates by last modification:

```bash
sf org list metadata --metadata-type Flow --target-org <alias> --json
```

Filter the result for `lastModifiedByName` and a recent `lastModifiedDate`, repeat for the types the user worked on (reports, dashboards and email templates also need `--folder <folder>`), and confirm the list with the user. Setup's audit trail (Setup → View Setup Audit Trail) is the other way to remember what was changed. Then retrieve by name as above.

### After retrieving

```bash
git status --short
git diff --stat
```

Explain each changed file as a component - `force-app/main/default/flows/Discount_Approval.flow-meta.xml` is "the Discount Approval flow". Watch for noise:

- **Profiles** often come back with hundreds of unrelated lines. If the story did not change profile settings, leave them out of the commit (`git restore <file>` after confirming). Teams that use permission sets avoid most of this.
- **Components nobody mentioned** - ask before keeping them.
- **Whole-file rewrites** of a component that barely changed usually mean a different API version or formatting; mention it, keep it if the change is real.

### Developers working locally

Developers often change source first and deploy it into their own org to try it: `sf project deploy start --source-dir <path> --target-org <their alias>`. That is fine for the user's own development org - never for a shared stage or production (ground rule 5).
