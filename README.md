# Apfel-Hafen

[Deutsche Version](README-DE.md)

**Apfel-Hafen** is a local web interface for managing Apple containers on
macOS 26. It displays existing containers and lets you start, stop, restart,
and check them for updated images.

The interface is available only on the Mac at `http://127.0.0.1:4173`.
Changing containers requires signing in with a local macOS administrator
account. The password is verified through PAM and is not stored.

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

### Ready-to-use release

The `Apfel-Hafen-0.2.0-macos-arm64.zip` release archive contains the required
Node.js runtime, compiled PAM helper, and built web interface. It does not
contain Apple containers, images, volumes, or application data. Extract the
archive and run `Start-Apfel-Hafen.command`.

Node.js, pnpm, and the Xcode Command Line Tools are only required when building
the release itself from source.

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

Run `pnpm release` to test and build a complete release archive under `out/`.
Variable Apple Container configuration is not included in this archive.

## Starting and stopping

Double-click `Start-Apfel-Hafen.command` in Finder. The local service
starts and opens the interface automatically in the browser. The Terminal
window must remain open while the application is running.

Alternatively, start the application from the project directory:

```console
pnpm start
```

The interface is then available at <http://127.0.0.1:4173>.

To stop the application, either close the Terminal window opened during
startup or double-click `Stop-Apfel-Hafen.command`. Do not start the
application with `sudo`, because Apple Container service belongs to the signed-in
user.

### Optional automatic start

After administrator sign-in, automatic start can be enabled or disabled under
**Administration**. When enabled, Apfel-Hafen automatically installs or
updates the LaunchAgent for the current installation directory. The display
distinguishes automatic start at the next sign-in from the currently running
service. An updated configuration for an already running service takes effect
at the next sign-in.

## Usage

The home page lists all Apple containers with their names, images, and current
status. Status information can be viewed without signing in.

For administrative actions, sign in with a local macOS administrator account.
The following functions are then available:

- start, stop, and restart containers
- check for a newer version of the image in use
- safely replace a container with the current image
- install or update the LaunchAgent and change its automatic-start status

Before replacing a container, Apfel-Hafen saves its configuration under
`backups/<Containername>/` and verifies the new configuration with a temporary
test container. Mounted host directories remain intact. Data stored only in
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
