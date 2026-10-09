# Enclosed

A digital archive companion to *Enclosed*, an accordion book by Chloe Chow documenting stripes found throughout Manhattan.

- **Collection**: a zoomable map of Chelsea, Flatiron and Greenwich Village with every photograph pinned where it was taken.
- **Unfolded**: the photographs as one endless, looping strip.
- **About**: the project and photographs of the publication.

## Publish on GitHub Pages

1. Create a new repository on GitHub and drag in every file from this folder.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, then **Save**.
4. After a minute the site is live at `https://<your-username>.github.io/<repo-name>/`.

## Editing

- `collection.js`: titles, dates, neighborhoods, coordinates and image paths for each pin.
- `steps.js`: the order of photographs in Unfolded.
- All files sit at the top level so the site works however it's uploaded:
  `thumb-*.jpg` pin thumbnails, `full-*.jpg` side-panel photos, `unfolded-*.jpg` Unfolded strip, `about-*.jpg` publication photos.

## Fonts

Headings and body text use GT Planar (Grilli Type). The included file is a **trial** license; replace it with a licensed copy before publishing publicly. The top bar uses DM Mono from Google Fonts.
