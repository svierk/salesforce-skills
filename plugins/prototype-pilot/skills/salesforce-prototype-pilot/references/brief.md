# The brief

A prototype is judged in the first ten seconds of a pitch. The brief settles what those seconds show, in which brand, with which assets - before the first screen.

## Read first, then ask

Read what the user already has instead of asking for it: a concept paper or PDF, user stories, a mood board or a screen sketch, release notes, an existing demo repository. A concept usually names the personas, the journey and the capabilities - take the jobs from there and ask only for what is missing.

## Questions

Ask in one message, with a sensible default for each:

| Topic      | Question                                                                                         | Default                                                       |
| ---------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Occasion   | Pitch, bid, workshop, steering committee? Who is in the room?                                    | Pitch to the customer's business owners                       |
| Device     | Shown on a laptop (phone frame plus data panel), on a phone in hand, or both?                    | Both: laptop for the story, phone for the "wow"               |
| Jobs       | Which 3-5 things must the app show?                                                              | Taken from the concept                                        |
| Brand      | Which brand, product, model? Official assets available - photos, typeface, logo, design tokens?  | Search the press kit and the user's local client repositories |
| Rights     | Internal with the customer only, or shown to others? May licensed assets go into the repository? | Internal only; ask before committing a licensed typeface      |
| Language   | UI language                                                                                      | The customer's language                                       |
| Repository | Owner, name, private or public, settings like an existing demo repository?                       | Private, settings copied from the user's last demo repository |
| Salesforce | Which clouds or products should the panel tell the story with?                                   | The ones the concept names; otherwise core objects            |
| Deadline   | When is it shown?                                                                                | -                                                             |

## From jobs to screens

- **3-5 jobs, 4 tabs.** Each job becomes a tab or a screen reached from Home. More than four tabs makes the phone feel like a portal.
- **Home tells the story in one scroll:** who the customer is, their product, where they are in the journey, the personal contact, what is next.
- **One "wow" per job:** a hero photo, a live chat reply, a request that moves through its statuses, a countdown. Pick it deliberately.
- **Exclusive or invitation-only audiences** get an onboarding: invitation, identity check, welcome. It sets the tone and shows the access model.
- **A personal contact** (ambassador, advisor, care manager) is a strong pattern for premium audiences: profile, chat, requests, appointments - one channel instead of many.

## Scope guard

A prototype shows a direction; it does not prove an integration. Keep logic scripted (keyword replies, timed status changes), keep data static, and put the architecture into the panel and the README's "path to a real implementation" instead of into code.
