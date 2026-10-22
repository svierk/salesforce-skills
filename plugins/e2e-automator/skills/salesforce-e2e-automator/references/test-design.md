# Test design

From a story, ticket or manual test case to a test plan the user agrees with - before a single line of test code. The plan is the contract: the spec implements it, and a failing assertion is judged against it.

## Read the input

Users bring requirements in many shapes. Take what is there:

| Input                                           | What to take from it                                                               |
| ----------------------------------------------- | ---------------------------------------------------------------------------------- |
| User story with acceptance criteria             | One test per criterion that a user can observe in the UI                           |
| Manual test case (steps, expected results)      | The steps as the flow, the expected results as assertions                          |
| Xray, Zephyr or other test management export    | Steps, expected results, preconditions, and the ticket key for traceability        |
| A sentence ("test that reps can convert leads") | The flow - and a list of questions, because the expected outcome is not stated yet |

If a tracker is connected (an MCP server for Jira, Azure DevOps or GitHub), read the ticket there. Otherwise ask the user to paste it - never invent acceptance criteria.

## Write the plan

Short, in the user's language, in this shape:

```text
Test: <ticket key> - <behaviour in one line>
Persona: <who does it - profile, permission sets, app>
Starts at: <URL or page>
Needs: <records and settings that must exist before>
Steps:
  1. <action>  →  <what the user sees>
  2. ...
Outcome: <what must be true afterwards, in the UI and in the data>
Out of scope: <what this test deliberately does not check>
Open questions: <anything you would otherwise have to guess>
```

Ask about every open question before writing code. The usual gaps: which record type, which profile, what happens on a validation error, whether a field is required, which values are valid, what "successfully" means.

## What belongs in a UI test

UI tests are the most expensive tests to run and to keep alive. Use them for what only they can show:

- **Yes:** a business process a user clicks through end to end - create a lead, convert it, see the opportunity; the custom Lightning web components on the way; navigation, actions, modals, record pages as the persona sees them.
- **No - faster elsewhere:** picklist values, field-level security, validation rule logic, sharing, Apex behaviour. Query them with SOQL, test them in Apex, or check them with a small script without a browser. Suggest that split when a ticket mixes both, as in "the status picklist has these five values".
- **No - not testable this way:** non-deterministic flows (AI-generated text, timing-dependent assignments) beyond checking that the result appears; exploratory testing; visual design.

One behaviour per `it`. A long story becomes several specs or several `it`s that share setup - not one test that fails somewhere in step 14.

## Test data

- **Own your data.** Create what the test needs in `beforeAll` - through the CLI or Apex, not through the UI unless creating it is the behaviour under test - and delete it in `afterAll`.
- **Unique names.** Add a run marker, for example `E2E ${Date.now()}`, so parallel or repeated runs do not collide and leftovers are easy to find.
- **No hard-coded ids.** Record ids differ between orgs and sandbox refreshes. Query or create the record and use the id it returns.
- **Persona matters.** A test that runs as an admin proves nothing about a sales rep. If the persona's permissions matter to the story, the test user needs exactly those.

## Verify the outcome

The DOM drives the interaction; the database is the source of truth for the outcome. A success toast proves that a save was attempted, not what was saved. Where the story is about data - a converted lead, a calculated field, a created task - check it with a SOQL query after the UI step, in addition to what the user sees.

## Traceability

Put the ticket key into the `describe` or `it` title (`'ABC-123 converts a qualified lead'`), so a failure in CI points to the requirement it protects, and a requirement can be found in the suite.
