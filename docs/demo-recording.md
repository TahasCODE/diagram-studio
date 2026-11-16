# Reproduce the guest demo recording

The README preview links to `/demo.html`, a native video player with captions,
download links and a text transcript. The 86-second silent recording shows actual
guest interactions on the public deployment, not mocked API responses. Timing
figures inside the cache example are illustrative.

Install the existing project dependencies, Chrome and Playwright's encoder:

```powershell
npm.cmd ci
npx.cmd playwright install ffmpeg
$env:RECORDING_COMMIT = git rev-parse HEAD
node scripts/record-demo.mjs
```

Run against a deployed **guest-mode** app. Set `APP_URL` to override the default
public demo URL. The script checks guest mode before recording. On CI it uses
Playwright Chromium instead of system Chrome; install that browser separately.
An existing FFmpeg executable can be selected through `FFMPEG_PATH`.

The script writes the WebM, poster, WebVTT captions and capture metadata to
`public/demo/`; raw recordings stay in ignored `.runtime/demo-recording/`.
Review the video and captions before committing regenerated assets. The captured
source revision and date are in `public/demo/recording.json`. There is no audio
track or narration. No new npm dependencies are needed.

The sequence covers API → Redis → timeout, PostgreSQL fallback, temporary error,
restart, a separate local remix and JSON export. It never signs in, creates an
account or sends email. The final captions distinguish the guest deployment
from the full Java/PostgreSQL implementation in the repository.

For manual review, open `/demo.html`, play and seek through both outcomes, enable
English captions, expand the transcript, and use the live walkthrough link.
Check at desktop and narrow mobile widths. All media is served from the app
itself, with no third-party video embed or tracking dependency.
