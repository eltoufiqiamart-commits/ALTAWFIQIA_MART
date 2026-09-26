# QA scripts (development only)

Headless-Chromium mobile/desktop layout checks used during hardening.

Setup once (requires a locally running production server, `npx next start -p 3909`):

```bash
npm ci
npx playwright-core install chromium   # downloads headless shell (~115 MB)
# on a minimal Linux container also install the chromium system libraries
node qa/mobile-qa.mjs
```

The script walks the public pages at 320/360/375/390/414/1280 px and reports:
- horizontal overflow (`scrollWidth - innerWidth > 1`),
- interactive elements smaller than 36x36 CSS px,
- client/console errors,
- and saves screenshots to `/home/user/qa/shots` (edit the path for your machine).

These scripts are not part of the production bundle and playwright-core is a
devDependency only.
