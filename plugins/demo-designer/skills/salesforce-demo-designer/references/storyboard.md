# Storyboard

A demo is decided on paper. This file covers what to ask, how long things take on screen, how to write captions, and how each format is built.

## The brief

Ask only what you cannot read yourself. Release notes, documentation, the stories of a sprint and the requirements of a bid are written down - read them.

| Question                          | Why it matters                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------ |
| Purpose and audience              | Picks the format - teaser, pitch walkthrough, sprint review, training clip, GIF            |
| Channel                           | Sets aspect ratio, sound and length (feed, bid portal, slide deck, README, intranet)       |
| Length                            | The budget every scene is cut against                                                      |
| Language                          | Captions, cards and subtitles - one language per video; variants are re-runs               |
| Brand                             | Colours and logo for cards and captions - the user's, the customer's, or the site's tokens |
| What to show                      | Features, stories, requirements - and the one message the viewer must take away            |
| Where it runs                     | Org alias and page, or URL - and whether the click path may change data                    |
| What must not appear              | Customer names, real records, internal URLs, unreleased features                           |
| Delivery                          | Folder, file names, which variants, whether a post or cover message is wanted              |
| For bids: the requirements and ID | Chapters follow the requirement IDs the evaluators score                                   |

Take brand colours from the source when there is one: the CSS custom properties of a documentation site, the customer's design tokens, the org's theme. Cards in a dark tone next to the light Lightning UI give a clear break between "story" and "product".

## Formats and stages

Record each aspect ratio as its own pass with its own stage - cropping a 16:9 take to a square cuts the interface apart. The stage's viewport times its scale is the video size; a smaller viewport scaled up makes the interface larger, which is what keeps it legible on a phone.

| Aspect | Use                                     | Product stage (viewport x scale) | Card stage      | Video     |
| ------ | --------------------------------------- | -------------------------------- | --------------- | --------- |
| 16:9   | Pitches, decks, desktop feeds, YouTube  | 1280x720 x 1.5                   | 1600x900 x 1.2  | 1920x1080 |
| 1:1    | Social feeds                            | 900x900 x 1.2                    | 900x900 x 1.2   | 1080x1080 |
| 4:5    | Mobile-first feeds                      | 864x1080 x 1.25                  | 864x1080 x 1.25 | 1080x1350 |
| 9:16   | Stories, shorts - responsive sites only | 720x1280 x 1.5                   | 720x1280 x 1.5  | 1080x1920 |

Lightning Experience is built for wide screens; below about 1024 CSS pixels it gets cramped. Prefer 16:9 for Lightning and check a square stage with a probe screenshot before promising it.

## Timing

| Beat              | Time                                                  |
| ----------------- | ----------------------------------------------------- |
| Intro card        | 2.5-3 s - long enough for the last chip to land       |
| Outro card        | 3 s; 4-5 s when it carries a link or contact to read  |
| Caption on screen | At least 2 s, or words / 3 + 1 s, whichever is longer |
| Cursor move       | 0.5-0.8 s; 1-1.5 s for a slow opening glide           |
| Typing            | 35-70 ms a character; shorten long values             |
| Hold on a result  | 1.5 s or more - the result is the point of the beat   |
| Scroll            | 1-2.5 s for a page, eased                             |
| Cross-fade        | 0.4-0.5 s                                             |
| Narration         | About 2.5 words a second                              |

The video is the sum of the scenes minus one fade per join. Add up the storyboard table before recording; if it runs long, cut beats, not holds - a rushed result is a lost result. Pages that load slowly are loaded before a scene starts, not during it.

## Caption copy

- **One line.** Up to about 55 characters on 16:9, about 35 on square and portrait.
- **The benefit, not the button.** "One click - a scannable QR code", not "Click Generate".
- **Badges for context:** `NEW`, a version (`v1.3`), a step (`1/4`), a requirement ID (`REQ 4.2`). Short, upper case.
- **Keep it off the subject.** The caption band covers the bottom 100 pixels of the stage. Scroll so the result sits above it, or use `theme: { captionPosition: 'top' }` for a scene where the action is at the bottom.
- **Hide it before a change of subject** with `caption(null)`, so an old caption does not hang over a new page.
- **Sentence case, the language of the post,** and nothing that is not true (ground rule 3).

## Structures

**Teaser.** Intro card with what is new (eyebrow with the version range, title, up to three chips) - two to four highlights, one caption each - outro with a strong line, the numbers that hold, and the link. 15-30 s. The post that goes with it repeats the highlights as text.

**Pitch walkthrough.** Intro card for the prospect ("Prepared for ...", their logo if the bid allows it) - an agenda is the chapter list - one chapter per requirement or process: a chapter card with the requirement ID and the prospect's own words, the click path, the result held, a caption with the value - outro with the next step and the contact. Keep the base storyboard generic and pass prospect data in, so the next bid is a re-run.

**Sprint review / story.** Story card with ID and title - the click path along the acceptance criteria, one caption each - result. One story per clip; a review is several clips, not one long take.

**Training clip.** Task card ("Create a quote") - one numbered caption per step (`badge: '1/4'`) - the result - a tip on the outro. Subtitles always; training clips are watched without sound.

**README GIF.** No cards, no captions or one short one, a single interaction that loops cleanly: end where it started, or hold the result.

## Bids and RFPs

- **Score-friendly.** Evaluators look for their requirement. Name chapters after requirement IDs, keep the order of the requirement list, and put the chapter marks into the submission text.
- **Their language.** Use the prospect's terms for their processes in cards and captions, and demo data that fits their industry - fictitious, but plausible.
- **Their rules.** Ask for length and file size limits, accepted formats and naming rules of the bid portal before recording.
- **Nothing that does not belong.** No pricing, no other customers' names or logos, no features that are not generally available unless the bid asks for the roadmap.
- **One base, many prospects.** Prospect name, logo and colours go in as data; the click path stays the same. Keep each personalised render private (ground rule 8).

## Narration

Write the narration as a script per scene in the storyboard table, at about 2.5 words a second, and time the holds to it. Two ways to combine:

- **Video first** - record, then the user narrates to the finished video (QuickTime, a phone, a studio) and `addAudio` lays the track under it.
- **Voice first** - the user records the script, you measure each part, and set the holds of each scene to fit.

A text-to-speech tool of the user's choice can produce the voice; macOS `say -o draft.aiff "..."` is good enough to check timing, not to publish. Always deliver subtitles too - many viewers watch without sound.
