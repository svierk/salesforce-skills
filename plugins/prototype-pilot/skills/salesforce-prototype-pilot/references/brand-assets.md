# Brand assets

What makes a prototype look like the customer's product: official photography of the real thing, the corporate typeface and the exact logo. A self-drawn product illustration looks silly next to the real brand and is rejected - do not draw the product, ever.

## Photography

**Where to look, in this order:**

1. **The user's material** - a concept paper with renderings, a shared drive, the customer's design system.
2. **The brand's press kit or media centre.** Car makers, manufacturers and consumer brands publish press kits per product with high-resolution photos: studio shots (3/4 front, front, side, rear, top), details (wheel, light, badge), interior and cockpit, dynamic and lifestyle shots. Search for "<brand> <product> press kit" or "<brand> media centre <product>".
3. **Reference works** for facts, not photos.

**On the press site:**

- Image detail pages carry the **rights line** - typically "use for editorial purposes free of charge", the copyright holder and an image number. Read it for at least one image and note it.
- File URLs often follow a pattern with size variants (for example a `_web_2880` suffix). Take the largest web variant; originals are rarely needed.
- Captions name the view and often the colour or trim. Use them to match the prototype's configuration to the photos: the customer's configuration in the prototype should be the one on the photos.
- Collect photos, rights and headline figures (power, range, units, launch dates) in **one pass**.

**Blocked sites.** Brand websites often refuse automated fetches (HTTP 403). Do not work around it - no spoofed user agents, no headless tricks. Press kits, media centres and reference works are the right sources anyway.

**Configuration-specific images.** Photos cannot be recoloured. A real implementation would request renderings for the customer's configuration code from the brand's configurator or render service; say so in the README and keep a field for the code on the asset record. In the prototype, match the configuration to the photos instead.

## Preparing images

- Download into a new folder, look at each image before using it.
- **Crop to the subject** when the car or product is small in a wide landscape shot - a side view where the subject fills a third of the frame reads as "a landscape".
- **Resize** to at most 1600 px on the long side, JPEG quality around 72-80. macOS: `sips -Z 1600 -s format jpeg -s formatOptions 75 in.jpg --out out.jpg`; elsewhere ImageMagick (`magick in.jpg -resize 1600x1600\> -quality 75 out.jpg`). A full set should stay around 3 MB.
- Pick by role: a **dark studio shot** in portrait for the invitation background; a **3/4 front** for the Home hero; front, side, rear for the asset stage; detail, interior and cockpit for the gallery and the guides.
- **Text over photos** goes on the calm part - sky, studio wall - with a gradient; never over the product's face. Check contrast of accent colours (gold on a bright sky fails).
- Credit the holder in the gallery ("Photos: <Brand> AG") and list sources in the README.

## Typeface

- **Look locally first.** Consultants often have the customer's web fonts in a client project: Salesforce static resources (`force-app/**/staticresources/*Font*`), a design-system package, an Experience Cloud theme. Search by brand and "font"/"type" file names (`*.woff2`), excluding `node_modules`.
- Prefer a **variable font** with a Latin subset: one file, all weights; a width axis gives "extended" headline cuts via `font-stretch` (the starter's `--display-stretch` token).
- **Licence.** Corporate typefaces are licensed to the brand. Copying one from a client repository into a repository outside the client's organisation - for example the user's personal GitHub - needs the user's explicit yes. Until then keep the file local and out of Git (`.gitignore`), and say so.

## Logo

- Use the official SVG from the design system or press kit when there is one.
- Otherwise build it to the brand's real geometry - for interlocking-ring marks the ring spacing and overlap decide whether it reads as the brand or as a row of circles. Compare against a photo of the badge.
- Use the current flat (2D) version most brands use digitally; place it where a native app would: app header, onboarding, app icon, desktop header.

## Record the decisions

Add a **Brand assets** table to the README: asset, source, rights or licence note. It answers "may we use this?" for whoever opens the repository next.
