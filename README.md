# EMG-and-IMU-Data-Collection
An application to collect EMG, IMU, and Computer Vision Kinematic Analysis System (CVKAS) data from the Alberta Bionix ESP32 sensor and a webcam, and upload the recordings to the Alberta Bionix Shared Google Drive through [BionixDB](https://github.com/albertabionix/bionix-db).

- **[For Users](#for-users):** install the desktop app, sign in, connect the sensor, record and export.
- **[For Developers](#for-developers):** run from source, test without hardware, build the executables, and release updates.

---

# For Users

## Installing

Download the zip for your computer from the repo's **[Releases](https://github.com/albertabionix/EMG-and-IMU-Data-Collection/releases)** page. You don't need Python, Node, or this repo.

- **Windows:** `EMG-IMU-Data-Collection-windows.zip`. Unzip it and run `EMG-IMU Data Collection.exe` inside the folder. Keep the whole folder together, because the `.exe` needs the `_internal` folder next to it. If SmartScreen warns "Windows protected your PC", click **More info → Run anyway**.
- **macOS:** `EMG-IMU-Data-Collection-macos-arm64.zip` for Apple Silicon (M1 and newer), `-macos-intel.zip` for Intel Macs. Unzip it and move the app to Applications. The app isn't signed with an Apple Developer ID, so the first launch is blocked: open it once, then go to **System Settings → Privacy & Security** and click **Open Anyway**. Alternatively, run `xattr -dr com.apple.quarantine "/Applications/EMG-IMU Data Collection.app"`. Allow the **Camera** and **Bluetooth** prompts the first time they appear.

**Closing the app window quits the app**, including the sensor and camera connections.

**Updating:** download the new zip from Releases and replace the old app. Your recordings and settings in the [data folder](#where-the-app-stores-data) are kept.

## Signing in

Click **Authenticate**. A browser window opens for you to sign in with your **Alberta Bionix UAlberta Google account**. Every click opens a fresh login (it never reuses an old session), so signing in again always reflects your current Drive access.

| Your access on the Alberta Bionix Shared Drive | What you can do |
|---|---|
| `CONTENT_MANAGER` (organizer or file organizer) | Everything, including exporting recordings to the Drive. Shown as `Authenticated (CONTENT_MANAGER)`. |
| On the [developer list](#developer-accounts-no-content_manager-access) | Everything except uploading. Shown as `Authenticated (DEVELOPER)`. |
| `CONTRIBUTOR` only, or not a Drive member | Sign-in is refused. Ask a Drive organizer for access. |

The **Start** button stays disabled until you're signed in with one of the first two.

If a login gets stuck (for example, you closed the Google sign-in tab without finishing), the Authenticate button turns into **Cancel**, which you can click right away. Otherwise it times out after 90 seconds.

## Connecting the Sensor

The ESP32 streams over **Bluetooth Classic serial** (device name `ESP32_EMG_IMU_1KHZ`). Once paired, your computer shows it as a serial port, which you pick in the app.

1. **Pair the ESP32** in your Bluetooth settings: **Settings → Bluetooth & devices** on Windows, **System Settings → Bluetooth** on macOS.
2. In the app, click **Start** and choose the sensor in the **Port** dropdown:
   - **Windows:** a `COMx` port. Windows creates two COM ports per paired device; if one never connects, pick the other.
   - **macOS:** `/dev/cu.<DeviceName>`. System ports that are never the sensor (`Bluetooth-Incoming-Port`, `debug-console`) are hidden.
3. The status under the dropdown changes from **Waiting for sensor...** to **Sensor connected** within a few seconds. If you paired after opening the app, click **Refresh ports**.

The app remembers the last port you picked, so you normally choose it once.

**If it won't connect:**
- **The port appears but never connects:** make sure the ESP32 is powered on and not connected to another computer. On macOS, Bluetooth Classic serial can be unreliable; removing the device in Bluetooth settings and pairing again usually fixes it.
- **No ports listed at all:** the device isn't paired, or (on macOS) the app was denied Bluetooth access. Check **System Settings → Privacy & Security → Bluetooth**.

## Recording and Exporting

1. On the home page, click **Start**, then choose the **Experiment** and **Exercise**, enter the participant's **ID Number**, pick the **Port**, and click **Submit**.
2. **Record**/**Stop** records all three modalities at once, each to its own CSV: **EMG** and **IMU** from the sensor, and **CVKAS** (marker positions and hip/knee angles) from the camera. CVKAS rows are only written while the camera is running.
3. Clicking **Stop** opens a popup:
   - **Export** uploads the recording to the Drive, then deletes the local copy. All modalities from that recording are uploaded together and get the same trial number.
   - **Cancel** discards the local copy without uploading.

   If you leave the page, refresh, or close the window without choosing, the local recording is discarded, so unexported files don't pile up.
4. With the **Test** checkbox ticked, **Stop** saves the recording locally instead of asking, in `recordings/` in the [data folder](#where-the-app-stores-data).
5. Uploads are **disabled** when you're signed in as a [developer](#developer-accounts-no-content_manager-access) or the app was started with the [simulated sensor](#testing-without-sensors-simulated-sensor). **Export** then saves the recording locally instead, so nothing is lost and no test data reaches the Drive.

### How files are named

**On your computer**, while recording or when saved locally:
```
recording_{experiment}_{exercise}_{modality}_{ID}_{date}_{time}.csv
```
Example: `recording_stairs_stairmaster_emg_20_2026-Nov-14_10-30-05.csv`

**On the Google Drive**, after Export. BionixDB renames each file and puts it in the `Datasets/emg`, `Datasets/imu`, or `Datasets/cvkas` folder:
```
{modality}-{pid}-{action}-{exercise}-{trial}.csv
```
Example: `emg-p020-stairs-stairmaster-03.csv`

| Part | Meaning |
|---|---|
| `modality` | `emg`, `imu`, or `cvkas` |
| `pid` | The ID Number, zero-padded to three digits with a `p` in front: `20` → `p020`. Enter just the number. |
| `action` / `experiment` | The experiment: **Extend & Contract** → `seated`, **Gait Cycle** → `walking`, **Staircase** → `stairs` |
| `exercise` | The exercise, e.g. **Baseline** → `baseline`, **Stairmaster** → `stairmaster`, **Right Leg** → `r_leg`, **Inclined Walking** → `15_walking` |
| `trial` | Assigned automatically on Export: one more than the highest existing trial for that participant, experiment and exercise, across all three modality folders. The EMG, IMU and CVKAS files from one recording always share a trial number. |
| `date`, `time` | When recording started (local files only) |

Older Drive files recorded before exercises were added have no exercise part: `emg-p002-seated-01.csv`.

### What's in the CSVs

| File | Columns |
|---|---|
| EMG | `timestamp, emg1, emg2` |
| IMU | `timestamp, imu1_ax, imu1_ay, imu1_az, imu1_gx, imu1_gy, imu1_gz, imu2_ax, …, imu2_gz` |
| CVKAS | `timestamp, marker_id, pos_x, pos_y, velocity, acceleration, hip_angle, knee_angle`, one row per detected marker per camera frame. A frame with no detected markers is a row with only `timestamp` filled in. |

- `timestamp` is Unix epoch seconds from the computer's clock. It's shared by all modalities, so they can be aligned.
- EMG is the raw 12-bit ADC value (0–4095).
- IMU values are the raw ISM330DHCX counts the firmware sends, with no calibration offsets applied: accelerometer ±4 g range (8197 counts per g), gyro ±500 dps range (57.1 counts per °/s). Recordings from before the binary-packet firmware (commit `413ce33`) stored accelerometer values in m/s² instead.
- The IMUs update at 100 Hz while EMG runs at 1 kHz, so IMU values repeat over about 10 consecutive rows.

To read recordings back from the Drive in Python, use BionixDB's `get_emg` / `get_imu` / `get_cvkas` or `download_*`; see [bionix-db's README](https://github.com/albertabionix/bionix-db#reading-data).

## Where the app stores data

Everything the app writes goes to **`~/Documents/BionixDataCollection/`** (on Windows, `C:\Users\<you>\Documents\BionixDataCollection\`):

- `recordings/`: recording CSVs (removed after Export or Cancel, kept when saved locally)
- `imu_calibration.json`: saved IMU gyro offsets
- `token.json`: Google login token
- `settings.json`: remembered sensor port
- `developers.json` (optional): [developer list](#developer-accounts-no-content_manager-access) for this computer
- `app.log`: everything the app logs. **Check this first when something goes wrong.**

## Troubleshooting

- **The app opens then immediately closes, or nothing happens:** read `app.log` in the [data folder](#where-the-app-stores-data).
- **Camera shows "No preview" on macOS:** enable the app under **System Settings → Privacy & Security → Camera**. If you denied it once, run `tccutil reset Camera ca.albertabionix.emg-imu-data-collection` and relaunch.
- **"App is damaged and can't be opened" on macOS:** run the `xattr -dr com.apple.quarantine …` command from [Installing](#installing).
- **Sensor won't connect:** see [Connecting the Sensor](#connecting-the-sensor).

---

# For Developers

The app is a Python (Flask + Socket.IO) backend and a React (Vite) frontend. The packaged desktop app runs the same code: Flask serves the built frontend, and the UI opens in a native window.

## Requirements

- [Python 3.12](https://www.python.org/downloads/) (what CI builds with)
- [Node.js](https://nodejs.org/en/download) 20.19 or newer (CI uses 24). Check with `node -v`.
- `git` on your PATH, because `pip` installs BionixDB from GitHub

## Running from Source

1. Clone the repository:
   ```bash
   git clone https://github.com/albertabionix/EMG-and-IMU-Data-Collection.git
   cd EMG-and-IMU-Data-Collection
   ```
2. Create the virtual environment and install the Python packages:
   ```bash
   # macOS
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```
   ```powershell
   # Windows
   python -m venv venv
   .\venv\Scripts\activate
   pip install -r requirements.txt
   ```
3. Run the backend (venv active):
   ```bash
   cd code/backend
   python main.py
   ```
4. In a second terminal, from the repo root, run the frontend:
   ```bash
   cd code/frontend
   npm install
   npm run dev
   ```
   If `npm install` reports vulnerabilities, run `npm audit fix`.
5. Open http://localhost:5173 (Vite default). The backend listens on http://127.0.0.1:5000; override with the `HOST` and `PORT` environment variables.

Running from source, the app writes to `code/backend/` instead of the user data folder: recordings in `code/backend/tests/`, plus `imu_calibration.json`, `token.json`, `settings.json` and `developers.json`.

**Camera permission on macOS:** macOS only lets the backend use the webcam if the app you started it from (Terminal, iTerm, VS Code, …) has camera access. If the camera panel shows **No preview** and the backend logs `Camera failed to open` or `not authorized to capture video`, enable that app under **System Settings → Privacy & Security → Camera** and restart the backend.

**Choosing the sensor port without the UI:** at startup the port is chosen from, in order:
1. The `SERIAL_PORT` environment variable, e.g. `SERIAL_PORT=/dev/cu.ESP32_EMG_IMU_1KHZ python main.py` or, in PowerShell, `$env:SERIAL_PORT="COM7"; python main.py`.
2. The last port picked in the app.
3. A best guess from the available ports.

To list ports by hand, run `python -m serial.tools.list_ports` (venv active), or `ls /dev/cu.*` on macOS. The sensor firmware is in [`arduino/ESP-32.txt`](arduino/ESP-32.txt).

### BionixDB dependency

Drive uploads go through [BionixDB](https://github.com/albertabionix/bionix-db), a separate Alberta Bionix library. You don't need to clone it: `pip install -r requirements.txt` installs it from GitHub at the version pinned in `requirements.txt`:
```
bionixdb @ git+https://github.com/albertabionix/bionix-db.git@v0.2.0
```
It needs no credentials file; it ships with a bundled OAuth client. To use a newer version or test unreleased BionixDB changes, see [Updating BionixDB](#updating-bionixdb).

## Testing and Debugging

The app has no automated tests; use the [smoke-test checklist](#build-and-smoke-test-locally). BionixDB's unit tests live in the bionix-db repo and mock Google Drive, so they need no credentials.

### Testing without sensors (simulated sensor)

To develop or demo without the ESP32, start the backend with the simulated sensor. Any of these work:
```bash
python main.py --simulated-sensor
python main.py SIMULATED_SENSOR=1
SIMULATED_SENSOR=1 python main.py
```

For the packaged app:
```bash
open "dist/EMG-IMU Data Collection.app" --args --simulated-sensor   # macOS
& ".\dist\EMG-IMU Data Collection\EMG-IMU Data Collection.exe" --simulated-sensor   # Windows
```

The backend prints `SIMULATED SENSOR enabled: EMG/IMU data is fake.` In the app:
- **Simulated sensor - fake data** is selected in the Port dropdown, and the status reads **Simulated sensor - data is fake**.
- You can switch to a real port and back while the app runs. The simulator entry is never saved as the remembered port, so a normal launch always uses the real sensor.

The simulator ([`code/backend/simulatedSensor.py`](code/backend/simulatedSensor.py)) sends packets in the firmware's binary format at the firmware's rate (1000 per second). They go through the same handler as real packets, so live graphs, calibration, recording and local saving behave as they do with hardware:
- **EMG:** rests around 1500 with a 1-second muscle-activation burst every 4 seconds. Channel 2 is weaker and offset in time.
- **IMU:** raw counts with gravity on one axis, a slow sway, and noise, refreshed every 10th packet like the real IMUs.

**Uploading to Google Drive is disabled for the whole session** whenever the backend was started with this flag, even after switching to a real port, so fake data can never reach the dataset. **Export** saves the recording locally instead.

The camera (CVKAS) isn't simulated: it uses your real webcam.

### Developer accounts (no `CONTENT_MANAGER` access)

Normally the app requires `CONTENT_MANAGER` access, so developers without it can't get past **Authenticate**. To let them use the app, list their Google accounts in `developers.json`:
```json
{
  "developers": ["someone@gmail.com", "another@ualberta.ca"]
}
```
Emails are matched case-insensitively. Two files are read, and either may be missing:

| File | Scope |
|---|---|
| [`code/backend/developers.json`](code/backend/developers.json) | Committed to the repo and bundled into every build, so it applies to everyone. The repo stores these emails, so add people only with their agreement. |
| `developers.json` in the [data folder](#where-the-app-stores-data) | One computer only; not in the repo. Use this to give yourself developer access in the packaged app without changing the repo. |

Running from source, the data folder is `code/backend/`, so both rows are the same file.

A developer account:
- Must still be a **member of the Alberta Bionix Shared Drive** (any role), because sign-in goes through BionixDB.
- Gets `Authenticated (DEVELOPER)` and can use everything: sensor, simulator, camera, recording, and saving locally.
- **Can never upload to Google Drive.** **Export** saves locally instead.

This is safe to hand out. The file only unlocks the app's UI; Google Drive itself still refuses uploads from accounts without an organizer or file-organizer role, so editing `developers.json` can't grant upload rights.

### Running everything without hardware or Drive access

For pure UI work, combine both: add yourself to `developers.json`, then run `python main.py --simulated-sensor` and `npm run dev`. Click **Authenticate**, then **Start**. Graphs show simulated data, and recordings are saved locally under `code/backend/tests/`.

## The Desktop Executable

The React frontend is built into static files (`code/frontend/dist`), which Flask serves on the same port as the API. [PyInstaller](https://pyinstaller.org) bundles Python, the backend, the built frontend, `developers.json` and BionixDB's OAuth client into one app. Everything for packaging lives in [`packaging/`](packaging/):

| File | Purpose |
|---|---|
| `packaging/EMG-IMU.spec` | PyInstaller config: what gets bundled, the app name, icon, and macOS permissions |
| `packaging/build.sh` | Builds the macOS `.app` |
| `packaging/build.ps1` | Builds the Windows `.exe` |
| `packaging/requirements-build.txt` | Build-only packages (PyInstaller, pywebview for the native window, Pillow for the icon) |
| `.github/workflows/build-executables.yml` | CI that builds Windows, Apple Silicon and Intel Mac apps, and publishes a GitHub Release on version tags |

The packaged app can't write inside its own bundle, so it uses the [data folder](#where-the-app-stores-data), and it has no terminal, so all output goes to `app.log` there.

### Building it yourself

PyInstaller **can't cross-compile**: a local build only runs on the kind of machine that built it. A Mac builds only the macOS app, for its own chip (an M-series Mac builds the Apple Silicon version, not the Intel one), and a Windows PC builds only the Windows app. To get all of them without needing those machines, use [GitHub Actions](#releasing-an-update).

**Getting a Windows build without a Windows computer:** go to **Actions → Build executables → Run workflow** and pick a branch. When the run finishes (about 10–15 minutes), download `EMG-IMU-Data-Collection-windows` from the **Artifacts** section at the bottom of the run page. GitHub builds it on its own Windows machines. You still need a Windows PC to *test* it: open it with `--simulated-sensor` first, then with the real sensor (pairing, COM port, record, export). The **Run workflow** button only appears once the workflow file is on `main`.

Prerequisites: the [source setup](#running-from-source) (venv created, Node and git installed).

**macOS** (from the repo root, venv active):
```bash
./packaging/build.sh
open "dist/EMG-IMU Data Collection.app"
```

**Windows** (PowerShell, from the repo root, venv active):
```powershell
.\packaging\build.ps1
& ".\dist\EMG-IMU Data Collection\EMG-IMU Data Collection.exe"
```
If PowerShell refuses to run the script, allow local scripts for this session with `Set-ExecutionPolicy -Scope Process Bypass`.

Each script runs `npm ci` and `npm run build` for the frontend, installs the Python and build requirements, and runs PyInstaller. Output goes to `dist/` and scratch files to `build/`. Both are git-ignored and overwritten on each build.

What ends up in `dist/`:
- **macOS:** `EMG-IMU Data Collection.app` is the app to run and share. The `EMG-IMU Data Collection/` folder next to it is PyInstaller's intermediate output, which the `.app` is assembled from; ignore it.
- **Windows:** the `EMG-IMU Data Collection\` folder *is* the app. Run the `.exe` inside it and share the whole folder.

## Making Changes and Releasing

The executable is a **snapshot** of the code from the moment it was built. Changes merged to `main` **don't** reach users until you release a new version.

### Develop and test from source

Make your changes and test them with `python main.py` plus `npm run dev`. There's no need to rebuild the executable while iterating.

### Check whether your change needs a packaging update

Most changes (editing backend Python, React components, CSS, adding routes) need **nothing extra**. Update the packaging only in these cases:

| If your change… | Then also… |
|---|---|
| adds a Python package | Add it to `requirements.txt`. PyInstaller picks it up automatically on the next build. If the packaged app logs `ModuleNotFoundError` for something that works from source (the package imports modules dynamically), add the module name to `hiddenimports` in `packaging/EMG-IMU.spec`. |
| adds an npm package | Nothing: `npm ci` installs it during the build (make sure `package-lock.json` is committed). |
| **reads** a non-Python file at runtime (an image, JSON, model, etc. in `code/backend/`) | Add it to `datas` in `packaging/EMG-IMU.spec`, and locate it at runtime with `sys._MEIPASS` when frozen (see `frontend_dist_dir()` in [`code/backend/Imports/paths.py`](code/backend/Imports/paths.py) for the pattern). Plain relative paths break in the packaged app. |
| **writes** any file (new recordings, configs, caches) | Build the path from `data_dir()` or `recordings_dir()` in [`Imports/paths.py`](code/backend/Imports/paths.py). **Never** write relative to the working directory or next to `__file__`: it works from source but fails in the packaged app. |
| changes the sensor packet format (firmware) | Update `PACKET_FORMAT` in both `bluetoothHandler.py` and `simulatedSensor.py`, so the simulator keeps matching the real sensor. |
| needs a new macOS permission (microphone, etc.) | Add the matching `NS…UsageDescription` key to `info_plist` in the spec, or macOS will deny access silently. |
| calls the backend from the frontend | Use `requestFlask` / `createFlaskSocket` in `code/frontend/src/services/flask/`, never a hardcoded `http://127.0.0.1:5000`. The packaged app may use a different port if 5000 is taken. |
| needs a `bionix-db` change | Release a new BionixDB version and bump the pin in `requirements.txt` first; see [Updating BionixDB](#updating-bionixdb). Builds (local and CI) always use the pinned version. |

### Updating BionixDB

BionixDB changes reach this app only through the version pinned in `requirements.txt`. Pushing to bionix-db's `main` alone changes nothing here, so a half-finished BionixDB change can't slip into an app release.

1. **Make and release the change in bionix-db:** merge it, bump `version` in its `setup.py`, then tag and push `vX.Y.Z` (full steps are in [bionix-db's README](https://github.com/albertabionix/bionix-db#releasing-a-new-version)).
2. **Bump the pin here** in `requirements.txt`, for example `...bionix-db.git@v0.2.0` → `@v0.3.0`, and reinstall:
   ```bash
   pip install -r requirements.txt
   ```
3. Test the app from source, commit the `requirements.txt` change, and merge it.
4. [Release a new app version](#releasing-an-update) so the executables include the new BionixDB.

**Testing BionixDB changes before releasing them:** clone bionix-db anywhere (e.g. next to this repo), then from this repo's venv swap in your working copy:
```bash
pip install -e ../bionix-db      # the app now uses your local bionix-db; edits apply on restart
# ...develop and test both repos together...
pip uninstall -y bionixdb && pip install -r requirements.txt   # back to the pinned release
```
Don't build a release executable while the local copy is installed. Swap back first, or the build will bundle your unreleased code.

### Build and smoke-test locally

Before releasing, run `./packaging/build.sh` (macOS) or `.\packaging\build.ps1` (Windows), launch the app from `dist/`, and check:

- [ ] The window opens and shows the home page
- [ ] **Authenticate** opens the Google login in the browser and succeeds
- [ ] The **Port** dropdown lists the paired sensor, and the status shows **Sensor connected**
- [ ] The EMG/IMU graphs update
- [ ] Launched with `--simulated-sensor` (see [Testing without sensors](#testing-without-sensors-simulated-sensor)), graphs show simulated data and **Export** saves locally instead of uploading
- [ ] The camera preview works (CVKAS)
- [ ] A test recording can be started, stopped, and exported
- [ ] Whatever you changed works

If something fails, read `~/Documents/BionixDataCollection/app.log`.

### Releasing an update

GitHub Actions builds releases for Windows, Apple Silicon Macs, and Intel Macs. It's free because the repo is public.

1. Merge your changes into `main`.
2. Pick the next version number ([semver](https://semver.org): bug fix `v1.2.3 → v1.2.4`, new feature `→ v1.3.0`), then tag and push from an up-to-date `main`:
   ```bash
   git checkout main && git pull
   git tag v1.3.0
   git push origin v1.3.0
   ```
3. Watch the **Actions** tab. The *Build executables* workflow takes about 10–15 minutes. When it finishes, a new **Release** with the three zips appears under **Releases**, with notes generated from the merged PRs.
4. Tell users to download the new zip and replace their old app. Their data in `~/Documents/BionixDataCollection/` is kept.

Merging a PR doesn't build anything; only a version tag or **Run workflow** does. To get test builds **without** making a release, go to **Actions → Build executables → Run workflow** and pick a branch. The zips appear as downloadable artifacts at the bottom of the workflow run page.

**If a release is broken,** fix it and release the next version (e.g. `v1.3.1`). Don't delete and re-push a tag people may have already downloaded: two different builds would then share one version number.

### Troubleshooting builds

- **The packaged app opens then immediately closes:** read `app.log` in the data folder. A missing module or file there usually means you need a `hiddenimports` or `datas` entry (see [the packaging table](#check-whether-your-change-needs-a-packaging-update)).
- **Build fails with `code/frontend/dist is missing`:** you ran PyInstaller directly. Use the build script, which builds the frontend first.
- **Build fails installing `bionixdb`:** the tag pinned in `requirements.txt` doesn't exist on GitHub yet. Push the bionix-db tag first.
- **The Intel Mac job fails in GitHub Actions:** the workflow builds Intel Macs on the `macos-15-intel` runner. If GitHub reports that runner type isn't available, remove that `matrix` entry from `.github/workflows/build-executables.yml`. The Windows and Apple Silicon builds are unaffected.
- **Testing the production frontend without packaging:** run `npm run build` in `code/frontend`, start `python main.py`, and open http://127.0.0.1:5000. Flask serves the built frontend the same way the packaged app does.
