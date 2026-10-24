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
- [ ] Results held long enough to take in; no beat lost to a slow page
- [ ] Intro chips and outro text fully visible before the fades
- [ ] Length within the budget of the brief

Show the user the stills with your verdict, and say what you did not check - you see frames, not motion. Each correction goes into the storyboard script, then record again.

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
