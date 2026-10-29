# Delivery

From an accepted take to the files the user sends, posts or submits.

## Review every take

`render` returns the duration; turn it into something you can look at:

```js
await contactSheet(video.file, 'out/sheet.png', { duration: video.duration }); // one frame a second
await still(video.file, 6.2, 'out/still-result.png'); // full size, at a key moment
```

Read the images, then check:

- [ ] Every caption readable, on screen long enough, not covering the subject of its beat
- [ ] Every claim true - numbers, versions, "new" (ground rule 3)
- [ ] Nothing private in frame: real names, emails, phone numbers, the user's photo, internal URLs, org banners
- [ ] The cursor visible where something happens, and clicks land on what the caption names
- [ ] Every typed value visible while it is typed - a contact sheet samples too rarely; take `still()`s a few tenths of a second apart around each `type` step
- [ ] Every focus frame on a visible element - a contact sheet of the moment after each `focus` call shows it
- [ ] Zooms keep their subject and the next action in frame
- [ ] `smoothness(video.file)` lists no blip or stall you cannot explain (a real hover highlight is fine)
- [ ] Animated people and machines look right in motion: a frame strip at 5-10 fps (`fps=5,tile=8x2`) shows planted feet, no crossing legs, no jumps
- [ ] Generated text read and true, and nothing on screen that later scenes created too early
- [ ] Results held long enough to take in; no beat lost to a slow page
- [ ] Intro chips and outro text fully visible before the fades
- [ ] Length within the budget of the brief

Show the user the stills with your verdict, and say what you did not check - you see frames, not motion; `smoothness` and frame strips are how you check motion. Each correction goes into the storyboard script, then record again.

## Live demos

When the video is recorded in front of an audience - a workshop, a pitch - with the presenter prompting the agent and often giving it a time budget, the recording is only half of it:

- **Prepare everything but the run.** Storyboard, selectors, data and look are decided and tested before the session; a project skill or playbook says how to run it, so the live session neither asks questions nor researches. Answer a time budget in one line ("Enough - a run takes about 3 minutes") and start.
- **A distinct output name** for the live take (`--out out/<name>-live.mp4`), so it overwrites neither the rehearsal take nor an earlier file in the user's downloads.
- **Play it right away** after the review - the audience is waiting for the result, not for a path.
- **A backup take.** Keep the best rehearsal take next to the script; after two failed runs, play it, say it is the rehearsal take, and debug after the session.
- **Rehearse like the session.** A fresh agent with only the playbook, the presenter's exact prompt, a stopwatch, and - for demos that change an org - a separate org, never the one the session uses. Take screenshots or stills as evidence, and turn every hesitation of the fresh agent into a line of the playbook.
- **Side effects stay out of the live run.** A dry run that stops before the submit is the default; a real submit needs the user's yes and test data (see [salesforce.md](salesforce.md#retakes-and-side-effects)).

## Feedback rounds

Long demos go through several rounds. For each one:

- **Root cause before fix.** "It flickers" can be dropped frames, a timing bug in the encode, zoom shimmer or a real UI effect; measure first, fix the cause, measure again and report the numbers.
- **Fix without repeating side effects.** Prefer re-editing, re-rendering graphics or cutting a take over re-recording a scene that changes data (see [salesforce.md](salesforce.md#retakes-and-side-effects)).
- **Answer the question asked.** When the user asks for an opinion ("what do you think?"), give one with the trade-off, then build it.
- **Log the round** - request, changes, learnings - next to the scripts, and keep chapter marks current when lengths change.

## Files

| File                    | What for                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| `<name>.mp4`            | H.264, yuv420p, 30 fps, fast start - plays in browsers, PowerPoint, Keynote, Teams and the common feeds |
| `<name>.srt`            | Subtitles from the captions - for feeds that accept a subtitle file, for accessibility, for bid portals |
| Chapter marks           | Printed by `render` (`0:00 Intro`) - for video descriptions, the bid's cover text, an agenda slide      |
| `<name>.gif`            | `gif(video, out, { width: 960, fps: 12 })` - for READMEs and docs, where video does not autoplay        |
| Narrated version        | `addAudio(video, 'voice.m4a', '<name>-narrated.mp4')`                                                   |
| `storyboard.mjs` + data | The demo itself - re-run for the next prospect, release or language                                     |

Copy the deliverables to the place agreed in the brief, named so they sort and say what they are: `<product>-<format>-<audience or version>.mp4`, for a bid `<prospect>-<requirement or chapter>.mp4`.

## Variants

- **Another aspect ratio** - another stage size, recorded again. Never crop a 16:9 take; see the stage table in [storyboard.md](storyboard.md#formats-and-stages).
- **Another prospect or language** - new card data and captions, the same click path; record again.
- **Shorter cut** - drop beats in the script; shortening holds makes every beat worse.
- **Another brand** - `brand` in the card data and `theme` on the stages.

## Channels

- **Social feeds** autoplay without sound: captions carry the message, the first two seconds decide whether anyone stays. Many feeds accept the `.srt` on upload. Check the channel's current length and size limits when a file is large - they change.
- **Bid portals** have their own limits on size, format and naming - from the brief. Deliver the MP4 so it plays offline, and put the chapter marks in the submission text.
- **Slide decks** - insert the MP4; set it to start on click and to rewind at the end.
- **Docs and READMEs** - a GIF, or an MP4 where the platform plays video inline.

## The post or message

When the user wants the words that go with the video, write them for the channel's audience, in the language of the video.

- **Feed posts are plain text.** Markdown does not render - no `**bold**`, no headings. Emoji as bullets work.
- **First line is the hook** - it is all a feed shows before "more".
- **Highlights as one-line bullets,** up to about 48 characters each, so they stay on one line in the mobile apps too.
- **One link,** to where the viewer should go next - for a docs teaser the page the video ends on.
- **An invitation** when it fits: feedback, contributions, a demo call.
- **Three to five hashtags** at the end.
- **For a bid,** the cover message names the requirements the video answers, with the chapter marks.
