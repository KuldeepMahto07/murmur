# 06 · Infrastructure

**Status: in progress.** Back to the [overview](../README.md).

| Sub-item | Status | Summary |
|---|---|---|
| [Cloud hosting](cloud-hosting/) | Not started | Fetchline runs on the user's PC, so there is no app server to host. The only hosted pieces are: |
| [DevOps](devops/) | Not started | Windows app: a cloud signing service such as Azure Artifact Signing, or an OV/EV certificate. Without signing, SmartScreen warns every new user. |
| [CI/CD](ci-cd/) | Not started | The repo also holds other projects (Murmur, upscaler), so use path filters so they don't trigger each other. |
| [Monitoring](monitoring/) | Not started | A desktop app has no servers to monitor. What matters is release health: |
| [Security](security/) | Partial | Loopback API: binds to 127.0.0.1 only, with the `X-Fetchline` header and loopback `Host` checks, so websites cannot drive the engine (`engine/server.t… |
