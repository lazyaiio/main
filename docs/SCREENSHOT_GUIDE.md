# Adding screenshots to the docs

The guides at `/docs` ask for five screenshots. They appear only after you add them, so nothing looks broken in the meantime. I cannot take screenshots of your live app, so you do this once (about 20 minutes).

## The five pictures

| File name (without .png) | Where it is used | What to capture |
|---|---|---|
| `dashboard` | Getting started | The dashboard right after sign-in, with the left menu visible |
| `connect-facebook` | Connect a Facebook Page | The Pages screen with one connected Page |
| `new-post` | Write posts with AI | The new post screen with a topic and a language filled in |
| `calendar` | Schedule and publish posts | The calendar with two or three scheduled posts |
| `insights` | Page Insights | The Insights page with numbers (only after Insights is switched on) |

## How to take a good screenshot

1. Use a **test workspace** with fake but realistic content. Never show real customers, real email addresses, access tokens, or payment details.
2. Make the browser window about **1440 pixels wide** (a normal laptop screen is fine) and hide bookmarks and extensions.
3. Capture only the app (no browser frame is needed).
4. Save as **PNG**, under 400 KB if you can (squoosh.app or any image tool will shrink it).
5. Check each picture for personal data before you save it.

## How to add them

1. Put each file in `public/docs/screenshots/`, named exactly as in the table, for example `public/docs/screenshots/dashboard.png`.
2. Open `src/content/screenshots.ts` and add the file name to the list:

```
export const SCREENSHOT_NAMES: string[] = ["dashboard", "connect-facebook", "new-post", "calendar"];
```

3. Upload both changes to GitHub. The pictures then appear in the guides, with their description as the caption.
4. If a picture is not 1440 by 900 pixels, change `SCREENSHOT_SIZE` in the same file to match its shape. (It is only used to reserve space, so the picture is never stretched.)

## Adding more

In any guide or article, add a line on its own:

`[[screenshot: file-name | A short description of what the picture shows]]`

The description becomes the picture's alt text and caption, so write it for someone who cannot see the picture. Then add the file name to the list as above. A guide test checks that every screenshot line has a description.
