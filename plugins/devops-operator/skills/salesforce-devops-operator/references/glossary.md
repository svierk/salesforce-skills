# Glossary

Wording for the terms this skill uses, for people who build by clicking. Use the plain version first, the term second - and only as much of either as the user needs.

| Term                 | In plain words                                                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Repository           | The project's shared folder on GitHub, with the full history of every change                                           |
| Branch               | Your own copy of the project for one story, where you can work without affecting anyone else                           |
| Environment branch   | A branch that stands for an org - `uat` for the UAT sandbox, `main` for production. Changes reach it only after review |
| Base                 | The branch your story starts from, so it begins with the current state                                                 |
| Retrieve             | Copy your changes from the org into the project files                                                                  |
| Deploy               | Copy project files into an org                                                                                         |
| Source tracking      | The org remembers what changed since the last retrieve, so you can see a list instead of searching                     |
| Metadata / component | Anything you configure in Setup - a field, a flow, a layout, a permission set - stored as a file                       |
| Working copy         | The project files on your computer right now, including changes not yet saved to history                               |
| Stage (git add)      | Mark which changed files go into the next save                                                                         |
| Commit               | A saved step in the project history, with a short message saying what changed                                          |
| Push                 | Upload your saved steps to GitHub, so others can see them                                                              |
| Fetch / pull         | Download what others uploaded                                                                                          |
| Pull request (PR)    | A request to bring your branch into another one - where colleagues review it and the automatic checks run              |
| Check / validation   | An automatic test of your change: does it deploy, do the tests pass, does it meet the quality rules                    |
| Merge                | Combine one branch into another                                                                                        |
| Conflict             | You and someone else changed the same part of the same component - a person has to decide what the result is           |
| Promotion            | Moving a story to the next org, e.g. from integration to UAT                                                           |
| Release              | What reaches production together                                                                                       |
| Revert               | A new step that undoes an earlier one, without erasing it from history                                                 |
| Stash                | Put unfinished changes aside for a moment, to get them back later                                                      |
| Pipeline             | The automation that checks and deploys changes, set up by the pipeline owner                                           |
| Pipeline owner       | The person who looks after the pipeline - the one to ask when a check seems wrong                                      |
| Release manager      | The person who decides what moves to the next stage or into production                                                 |
| Scratch org          | A fresh, short-lived org created just for one piece of work                                                            |
| Force push           | Overwriting history on GitHub - blocked here, because it can erase others' work                                        |
