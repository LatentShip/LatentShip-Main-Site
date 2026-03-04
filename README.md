# Landing/Portfolio Site (Static Multi-Page)

This project is a pure static multi-page site for GitHub Pages/GitLab Pages.

No npm/build step is required.

## Site Structure

- `index.html` (Home)
- `about/index.html`
- `work/index.html`
- `work/<project-slug>/index.html` (project detail pages)
- `get-started/index.html`
- `assets/`
- `css/styles.css`
- `js/content.js`
- `js/main.js`
- `.github/workflows/deploy-pages.yml`

## Local Development

Option 1 (recommended): run a local static server.

```bash
py -m http.server 8080
```

Then open:

`http://localhost:8080`

Option 2: open `index.html` directly in your browser.

Page URLs locally (with static server):

- `/`
- `/about/`
- `/work/`
- `/work/bilkool-ezee/` (example slug)
- `/get-started/`

## Deploy to GitHub Pages

1. Push to a GitHub repo.
2. Go to `Settings -> Pages`.
3. Set `Source` to `GitHub Actions`.
4. Push to `main`.
5. Workflow `Deploy Static Site` publishes automatically.

The site uses relative paths (`./`, `../`, `../../`) so it works from a repo subpath (project Pages URLs).

## Deploy to GitLab Pages (fallback)

If you need GitLab Pages for a private GitHub source workflow:

1. Mirror this repo to GitLab.
2. This repo already includes `.gitlab-ci.yml` with a Pages job.
3. Ensure `index.html` is at the published root.

## How To Change Content

Primary content file:

- `js/content.js`

Update these sections in `js/content.js`:

- `hero`: hero copy
- `whyUs`: six short trust bullets
- `roadmap.title`, `roadmap.subtitle`, `roadmap.steps`
- `roadmap.trustCards`: pricing/ownership/retainer cards
- `projects`: portfolio cards, slugs, tags, detail copy, and deliverables
- `faq`: FAQ question/answer entries

Tag filtering logic:

- Tags are derived from each project's `tags` array in `js/content.js`.
- No extra config needed; filter buttons update automatically.

## Adding/Editing Project Pages

Portfolio cards are data-driven from `js/content.js`, and each detail page is route-based.

When adding a new project:

1. Add the project object in `js/content.js` (include unique `slug`).
2. Create a matching route file at `work/<slug>/index.html` (copy an existing project page as template).
3. Commit and push.

## Styling / UI

- Main styles: `css/styles.css` (shared across all pages)
- UI behavior (rendering/filtering/project detail/animations): `js/main.js`

## Notes

- This is vanilla HTML/CSS/JS only.
- Navigation is true multi-page (not single-page anchors for About/Work/Get Started).
