# 06 · Infrastructure

**Status: in progress.** The app runs locally (start.bat), and the static demo is on Vercel (deployed by CLI, **not** from git pushes). There's no reachable backend, CI/CD, dependency lockfile or monitoring.

| Sub-item | Built | Missing |
|---|---|---|
| [Cloud hosting](cloud-hosting/) | Vercel static demo at murmur-alpha-three.vercel.app; backend on the user's PC | Git-connected deploys; a hosted backend only if strategy needs it |
| [DevOps](devops/) | start.bat, requirements with torch pins, .env.example | Lockfile, installer pipeline, Docker image, release process |
| [CI/CD](ci-cd/) | — | Frontend build, backend pytest (CPU), release workflow |
| [Monitoring](monitoring/) | stdout logging, per-job error field | `/api/health`, diagnostics panel, opt-in crash reports |
| [Security](security/) | localhost bind, CORS off by default, upload cap, secrets in .env | Auth before exposure, SSRF guard for links, static path check, at-rest encryption |

**Next action:** add a `requirements.lock` and a GitHub Actions workflow that builds the frontend and runs the backend tests.
