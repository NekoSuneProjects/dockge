# Changelog

## 2026-03-14

### Added

- Role-based access control with `admin` and `user` roles.
- Permanent bootstrap `owner` account created on first setup.
- Per-stack access assignments for non-admin users.
- Multi-provider OAuth2 / OIDC login with:
  - Google preset
  - Discord preset
  - custom discovery or manual endpoint providers
- Admin UI for managing:
  - users
  - roles
  - stack assignments
  - OAuth providers
- Quick install app catalog in the dashboard.
- One-click app installs for starter templates including:
  - Ollama
  - Open WebUI
  - Uptime Kuma
  - MariaDB
- Install target selection for local or remote agent nodes.
- Cancel / kill support for stuck stack deploys, updates, and image pulls.
- Node hardware detection in the web UI:
  - OS
  - CPU
  - RAM
  - GPU detection with `GPU not detected` fallback
- Docker admin tools in the web UI:
  - image list
  - used / unused image visibility
  - image prune
  - image delete
  - container list
  - container start / stop / restart / remove
- Stack file manager in the web UI:
  - browse
  - read
  - edit
  - upload
  - download
  - delete
- Windows support improvements:
  - Docker Desktop native mode
  - WSL2 Docker execution mode with optional distro selection
- Bulk `Update All` action for managed stacks per node.
- Live compose page resource stats:
  - CPU
  - memory
  - network I/O
  - block I/O
  - PID count
- Per-service container controls on the compose page:
  - start
  - stop
  - restart
  - bash shortcut

### Changed

- Existing users are migrated to admin by default during RBAC migration.
- The first setup account is now locked as owner and cannot be:
  - demoted
  - disabled
  - reassigned
  - deleted
- Stack operations, terminals, file access, and admin features now enforce permissions.
- Compose and Docker execution paths now use a shared runtime abstraction for Linux, Windows, Docker Desktop, and WSL2.

### Notes

- File access is restricted to the selected stack directory root.
- OAuth uses generic OAuth2 / OIDC provider configuration rather than only vendor-specific login.
- The owner account can only be removed by fully wiping the installation and reinstalling Dockge.
