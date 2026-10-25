# Security policy

## Reporting a vulnerability
Please don't open a public issue. Use **Report a vulnerability** on the repository's Security tab (GitHub private vulnerability reporting). You'll get a reply within 3 working days, and a fix or a plan within 30 days. Credit is given in the release notes unless you'd rather not.

## Supported versions
Only the latest release gets security fixes. Harbor checks for updates on its own (Settings → Updates).

## What Harbor guarantees
- **Nothing leaves your PC.** URLs, files and cookies are never sent anywhere. The only network calls Harbor makes on its own are your downloads and the update check (the GitHub Releases API, with no identifiers).
- **Local-only engine.** The engine listens on `127.0.0.1` and rejects requests without its header or with a non-loopback `Host`, so websites can't drive it. Optional browser pairing adds a secret token on top.
- **Credentials are short-lived.** Cookies and `Authorization` headers from the browser are kept only until a download finishes, so it can resume; after that they're removed from `state.json`.
- **Safe file names.** Names are sanitized and Windows reserved names blocked; the UI server guards against path traversal.
- **No DRM or encryption bypass.** Harbor won't download protected streams.
- **No third-party runtime dependencies.** The engine uses Node's standard library only.

## In scope
The engine, the desktop UI, the tray app, the installer and both extension builds.

## Out of scope
Sites that serve malicious files (Harbor verifies checksums you provide but doesn't scan content), and attacks that need an attacker already running code as your Windows user.
