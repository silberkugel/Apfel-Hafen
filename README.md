# Apfel-Hafen

[Deutsche Version](README-DE.md)

**Apfel-Hafen** is a local web interface for managing Apple containers and
per-user LaunchD services on macOS 26. It displays containers and services in a
compact layout, manages their lifecycle, and checks containers for updated
images.

The interface is served exclusively over HTTPS and is available in the default
local configuration at `https://127.0.0.1:4173`.
Changing containers requires signing in with a local macOS administrator
account. The password is verified through PAM and is not stored.

![Apfel-Hafen web interface in English](docs/images/apfel-hafen-ui_EN.png)

## Languages

The interface supports German and English. On first launch, it uses the
browser language. The DE/EN selection in the header is stored locally in the
browser.

## Prerequisites

- macOS 26 on an Apple Silicon Mac
- Apple's `container` CLI at `/usr/local/bin/container`
- Node.js 20 or newer
- `pnpm`
- Xcode Command Line Tools for compiling the PAM authentication helper

First, check whether Apple Container service is running:

```console
container system status
```

If the service is not running yet:

```console
container system start
```

## Installation

Starting with version 0.2.5, the native `Apfel-Hafen.app` handles initial setup,
LaunchAgent registration, and service management while the web interface
continues to open in the regular browser. See [docs/native-app.md](docs/native-app.md)
for technical details.

### Ready-to-use release

Every release contains the `Apfel-Hafen-0.3.0-macos-arm64.zip` server archive
and the native macOS app as `Apfel-Hafen-0.3.0-macos-arm64.dmg`. The archive
contains the required Node.js runtime, compiled PAM helper, and built web
interface. Apple containers, images, volumes, and application data are not
included. Extract the archive and run `Start-Apfel-Hafen.command`.

### From source

1. Clone the repository and change to the project directory:

   ```console
   git clone git@github.com:silberkugel/Apfel-Hafen.git
   cd Apfel-Hafen
   ```

2. Install the JavaScript dependencies:

   ```console
   pnpm install
   ```

3. Compile the local PAM authentication helper:

   ```console
   cc auth/pam-auth.c -o auth/pam-auth -lpam
   ```

4. Build the web interface:

   ```console
   pnpm build
   ```

The compiled PAM helper, installed dependencies, and generated web files stay
local and are not committed to Git.

Run `pnpm release` to test and build the complete release archive and native
macOS app DMG under `out/`.

## Starting and stopping

Double-click `Start-Apfel-Hafen.command` in Finder. The local service
installs or updates the LaunchAgent for the current user account, starts it in
the background, and opens the interface automatically in the browser. The
briefly opened Terminal window can then be closed. The service starts
automatically on subsequent sign-ins.

Alternatively, start the application from the project directory:

```console
pnpm start
```

The interface is then available at <https://127.0.0.1:4173>.

On first launch, Apfel-Hafen automatically generates a self-signed server
certificate. The browser therefore initially displays a certificate warning.
The connection is still encrypted; to avoid the warning, trust the certificate
on the client device or replace it with one issued by a trusted certificate
authority.

To stop the application for the current session, double-click
`Stop-Apfel-Hafen.command`. If automatic start is enabled, the service starts
again at the next sign-in. Do not start the application with `sudo`, because
Apple Container service belongs to the signed-in user.

### Background service and automatic start

The start command installs a per-user LaunchAgent at
`~/Library/LaunchAgents/de.apfel-hafen.service.plist`. It runs without a user
interface, Dock icon, or permanently open Terminal. After administrator
sign-in, automatic start can be enabled or disabled under **Administration**.
The display distinguishes automatic start from the currently loaded service.

The network mode is independent of the service lifecycle: `127.0.0.1` exposes
Apfel-Hafen only on the Mac, while `0.0.0.0` also exposes it on the Mac's
network addresses. Network access should be combined with a trusted
certificate and a restrictive macOS firewall configuration.

## Usage

The service center lists Apple containers as well as user and system LaunchD
services with their current status. Status information can be viewed without
signing in; system LaunchD services remain read-only.

For administrative actions, sign in with a local macOS administrator account.
The following functions are then available:

- start, stop, and restart containers
- view startup and container logs directly in the interface
- open an interactive terminal console for running containers
- create containers with image search, port mappings, volumes, and environment variables
- safely delete containers after confirming their names; optionally delete
  volume data managed by Apfel-Hafen as well
- check for a newer version of the image in use
- safely replace a container with the current image
- create, start, stop, and restart per-user LaunchAgents and clean up orphaned
  configurations; automatic launch options include `RunAtLoad`, `KeepAlive`,
  `StartInterval`, and multiple `StartCalendarInterval` times
- configure the global base path for volumes managed by Apfel-Hafen
- switch between local-only access (`127.0.0.1`) and network access (`0.0.0.0`)
- activate a custom PEM server certificate with its matching private key or
  switch back to the automatically generated certificate
- install or update the LaunchAgent and change its automatic-start status

Certificates and private keys are stored outside the web interface under
`~/Library/Application Support/Apfel-Hafen/tls/`. The private key is readable
only by the account running the service. Plain HTTP connections are not
accepted.

## Hermes Agent via remote MCP

Apfel-Hafen optionally provides a stateless Streamable HTTP MCP endpoint at
`https://<address>:4173/mcp`. It is disabled by default. To enable it, provide a
dedicated bearer token of at least 32 characters in `APFEL_HAFEN_MCP_TOKEN` at
startup. For LaunchAgent operation, the token can instead be stored at
`~/Library/Application Support/Apfel-Hafen/mcp-token`. The file must only be
readable by the current user, for example:

```console
mkdir -p "$HOME/Library/Application Support/Apfel-Hafen"
openssl rand -hex 32 > "$HOME/Library/Application Support/Apfel-Hafen/mcp-token"
chmod 600 "$HOME/Library/Application Support/Apfel-Hafen/mcp-token"
```

Restart Apfel-Hafen after creating or replacing the token. The endpoint exposes
only these tools:

- `list_containers`
- `get_container_status`
- `get_container_logs`
- `start_container`
- `stop_container`
- `restart_container`
- `check_image_update`

Shell access, deletion, creation, and changes to the host, LaunchD, or
Apfel-Hafen settings are not available through MCP. Every MCP request requires
`Authorization: Bearer <token>`. For access from another device, also enable
network access in Apfel-Hafen and configure that device to trust the server
certificate.

Example `~/.hermes/config.yaml`:

```yaml
mcp_servers:
  apfel_hafen:
    url: "https://apfel-hafen.example:4173/mcp"
    headers:
      Authorization: "Bearer ${APFEL_HAFEN_MCP_TOKEN}"
    tools:
      include:
        - list_containers
        - get_container_status
        - get_container_logs
        - start_container
        - stop_container
        - restart_container
        - check_image_update
      resources: false
      prompts: false
```

Protect the token like a password on the Hermes side and never commit it to the
repository. MCP tool calls are written to the service log as structured audit
entries without the token.

Before replacing a container, Apfel-Hafen saves its configuration under
`~/Library/Application Support/Apfel-Hafen/backups/<Containername>/` and
verifies the new configuration with a temporary test container. Mounted host
directories remain intact. Data stored only in
the container's writable root filesystem may be lost during replacement.

## Uninstallation

1. Stop Apfel-Hafen with `Stop-Apfel-Hafen.command`.
2. If automatic start was configured, unload the LaunchAgent:

   ```console
   launchctl bootout "gui/$(id -u)" "$HOME/Library/LaunchAgents/de.apfel-hafen.service.plist"
   ```

3. Remove `de.apfel-hafen.service.plist` from
   `~/Library/LaunchAgents`.
4. Copy any required configuration backups from the `backups` directory to a
   safe location.
5. Move the project directory to the Trash in Finder.
6. Optionally remove the log directory
   `~/Library/Logs/Apfel-Hafen`.

Uninstalling Apfel-Hafen does **not** remove Apple containers, images,
volumes, or mounted host data. Manage them separately with Apple's `container`
CLI if needed.

## Sources

- [apple/container](https://github.com/apple/container)

## License

This project is licensed under the [GNU General Public License Version 3](LICENSE).
