# EMG-and-IMU-Data-Collection
An application to collect EMG, IMU, and camera-based (CVKAS) data, with a Python (Flask + Socket.IO) backend and a React (Vite) frontend.

Lab users can run it as a standalone desktop app for Windows or macOS; see [Desktop Executable](#desktop-executable-windows--macos). Developers: see [Updating the Executable After Making Changes](#updating-the-executable-after-making-changes) whenever you change the code.

## Downloads

1. Install [Python 3](https://www.python.org/downloads/).
2. Download [node.js](https://nodejs.org/en/download) and follow the steps given.
3. Check if node.js is downloaded properly
   ```bash
   node -v
   ```
   → v24.12.0 or higher
   ```bash
   npm -v 
   ```
   → 11.9.0 or higher
   
## BionixDB Setup

The backend uploads recorded datasets through [BionixDB](https://github.com/albertabionix/bionix-db), a separate Alberta Bionix library. You don't need to clone it: `pip install -r requirements.txt` installs it straight from GitHub, at the version pinned in `requirements.txt`:

```
bionixdb @ git+https://github.com/albertabionix/bionix-db.git@v0.2.0
```

Installing it needs `git` on your PATH. To use a newer BionixDB, or to test unreleased BionixDB changes, see [Updating BionixDB](#updating-bionixdb).

BionixDB itself needs no separate setup or credentials file — it ships with a bundled OAuth client. Clicking **Authenticate** in the app opens a browser window for you to sign in with your **Alberta Bionix Google account** — every click opens a fresh login (it never silently reuses a cached session), so re-authenticating always reflects your current Drive access. You need to be a member of the Alberta Bionix Shared Google Drive to authenticate at all, and exporting recordings additionally requires `CONTENT_MANAGER` (organizer/file organizer) access on that Drive — being a `CONTRIBUTOR` member is not enough. The **Start** button stays disabled until `CONTENT_MANAGER` access is confirmed. See [bionix-db's README](https://github.com/albertabionix/bionix-db/blob/main/README.md) for details on access levels.

If a login is stuck (e.g. you closed the Google sign-in tab without finishing), the Authenticate button turns into a **Cancel** button you can click immediately — it doesn't otherwise time out for 90 seconds.

## Recording and Exporting

1. After clicking **Start**, recordings are made per modality. Today only **EMG** recording is implemented (via **Record**/**Stop**); IMU and CVKAS data collection are still under development.
2. Clicking **Stop** opens a popup asking whether to **Export** (upload the recording to BionixDB and delete the local copy) or **Cancel** (discard the local copy without uploading). If you navigate away, refresh, or close the tab without choosing, the local recording is automatically discarded so it doesn't pile up unexported.
3. Exporting uploads whichever modalities were actually recorded for that trial in one call, so they share a trial number in Drive.

## Getting Started (Windows)
1. Clone the repository:
   ```bash
   git clone https://github.com/albertabionix/EMG-and-IMU-Data-Collection.git
   cd EMG-and-IMU-Data-Collection
   ```
2. Run the virtual environment:
   ```bash
   python -m venv venv
   .\venv\Scripts\activate
   pip install -r requirements.txt
   ```
3. Run the backend (with the venv still active):
   ```bash
   cd .\code\backend\
   python main.py
   ```
4. In a second terminal, from the repo root, run the React frontend:
   ```bash
   cd .\code\frontend\
   npm install
   npm run dev
   ```
   If `npm install` reports vulnerabilities, run `npm audit fix`.

## Getting Started (macOS)

1. Clone the repository:
   ```bash
   git clone https://github.com/albertabionix/EMG-and-IMU-Data-Collection.git
   cd EMG-and-IMU-Data-Collection
   ```
2. Run the virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```
3. Run the backend (with the venv still active):
   ```bash
   cd ./code/backend/
   python3 main.py
   ```
4. In a second terminal, from the repo root, run the frontend:
   ```bash
   cd ./code/frontend/
   npm install
   npm run dev
   ```
   If `npm install` reports vulnerabilities, run `npm audit fix`.
5. **Camera permission (CVKAS):** macOS only lets the backend use the webcam if the app you launched it from (Terminal, iTerm, VS Code, …) has camera access. If the camera panel shows **No preview** and the backend logs `Camera failed to open` or `not authorized to capture video`, enable that app under **System Settings → Privacy & Security → Camera** and restart the backend.

Open the frontend at http://localhost:5173 (Vite default). The backend listens on http://127.0.0.1:5000 by default; override with the `HOST` and `PORT` environment variables. Click **Authenticate** before **Start** — the Start button stays disabled until BionixDB grants `CONTENT_MANAGER` access.
## Desktop Executable (Windows & macOS)

The app can also be packaged as a standalone desktop app, so lab users don't need Python, Node, or this repo. Double-clicking it starts the backend and opens the UI in its own window. **Closing the window quits the app**, including the Bluetooth, serial, and camera threads.

How it works: the React frontend is built into static files (`code/frontend/dist`), which Flask serves on the same port as the API. [PyInstaller](https://pyinstaller.org) then bundles Python, the backend, the built frontend, and BionixDB's OAuth client into one app. Everything for packaging lives in [`packaging/`](packaging/):

| File | Purpose |
|---|---|
| `packaging/EMG-IMU.spec` | PyInstaller config: what gets bundled, the app name, icon, and macOS permissions |
| `packaging/build.sh` | Builds the macOS `.app` |
| `packaging/build.ps1` | Builds the Windows `.exe` |
| `packaging/requirements-build.txt` | Build-only packages (PyInstaller, pywebview for the native window, Pillow for the icon) |
| `.github/workflows/build-executables.yml` | CI that builds both platforms and publishes a GitHub Release |

### Where the packaged app stores data

The app bundle is read-only, so everything it writes goes to **`~/Documents/BionixDataCollection/`** (on Windows, `C:\Users\<you>\Documents\BionixDataCollection\`):

- `recordings/`: recording CSVs (removed after Export or Cancel, kept when saved locally)
- `imu_calibration.json`: saved IMU gyro offsets
- `token.json`: Google login token
- `app.log`: all backend output (the packaged app has no terminal). **Check this first when something goes wrong.**

When you run from source, nothing changes: files still go to `code/backend/` (`tests/`, `imu_calibration.json`) as before.

### Installing / running the packaged app

Download the zip for your platform from the repo's **Releases** page:

- **Windows:** `EMG-IMU-Data-Collection-windows.zip`. Unzip it and run `EMG-IMU Data Collection.exe` inside the folder. Keep the whole folder together, because the `.exe` needs the `_internal` folder next to it. If SmartScreen warns "Windows protected your PC", click **More info → Run anyway**.
- **macOS:** `EMG-IMU-Data-Collection-macos-arm64.zip` for Apple Silicon (M1 and newer), `-macos-intel.zip` for Intel Macs. Unzip it and move the app to Applications. The app isn't signed with an Apple Developer ID, so the first launch is blocked: open it once, then go to **System Settings → Privacy & Security** and click **Open Anyway**. Alternatively, run `xattr -dr com.apple.quarantine "/Applications/EMG-IMU Data Collection.app"`. Allow the **Camera** and **Bluetooth** prompts the first time they appear.

### Building the executable yourself

PyInstaller **can't cross-compile**: you build the Windows app on Windows and the macOS app on a Mac. To get both without needing both machines, use the [GitHub Actions release](#4-releasing-an-update-recommended) instead.

Prerequisites: the normal source setup above (venv created, Node and git installed).

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

Each script runs `npm ci` and `npm run build` for the frontend, installs the Python and build requirements, and runs PyInstaller. Output goes to `dist/` and the scratch files to `build/`. Both are git-ignored and get overwritten on each build.

## Updating the Executable After Making Changes

The executable is a **snapshot**: it contains a copy of the code from the moment it was built. Changes you push to `main` **do not** reach users until you build and distribute a new version. Follow these steps every time.

### 1. Develop and test from source as usual

Make your changes and test them with the normal dev setup (`python main.py` plus `npm run dev`). There's no need to rebuild the executable while iterating.

### 2. Check whether your change needs a packaging update

Most changes (editing backend Python, React components, CSS, adding routes) need **nothing extra**: just rebuild. Update the packaging only in these cases:

| If your change… | Then also… |
|---|---|
| adds a Python package | Add it to `requirements.txt`. PyInstaller picks it up automatically on the next build. If the packaged app logs `ModuleNotFoundError` for something that works from source (the package imports modules dynamically), add the module name to `hiddenimports` in `packaging/EMG-IMU.spec`. |
| adds an npm package | Nothing: `npm ci` installs it during the build (make sure `package-lock.json` is committed). |
| **reads** a non-Python file at runtime (an image, JSON, model, etc. in `code/backend/`) | Add it to `datas` in `packaging/EMG-IMU.spec`, and locate it at runtime with `sys._MEIPASS` when frozen (see `frontend_dist_dir()` in [`code/backend/Imports/paths.py`](code/backend/Imports/paths.py) for the pattern). Plain relative paths break in the packaged app. |
| **writes** any file (new recordings, configs, caches) | Build the path from `data_dir()` or `recordings_dir()` in [`Imports/paths.py`](code/backend/Imports/paths.py). **Never** write relative to the working directory or next to `__file__`: it works from source but fails in the packaged app. |
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
4. Cut a new app release ([step 4](#4-releasing-an-update-recommended)) so the executables include the new BionixDB.

**Testing BionixDB changes before releasing them:** clone bionix-db anywhere (e.g. next to this repo), then from this repo's venv swap in your working copy:
```bash
pip install -e ../bionix-db      # the app now uses your local bionix-db; edits apply on restart
# ...develop and test both repos together...
pip uninstall -y bionixdb && pip install -r requirements.txt   # back to the pinned release
```
Don't build a release executable while the local copy is installed. Swap back first, or the build will bundle your unreleased code.

### 3. Build and smoke-test locally (recommended before releasing)

Run `./packaging/build.sh` (macOS) or `.\packaging\build.ps1` (Windows), launch the app from `dist/`, and check:

- [ ] The window opens and shows the home page
- [ ] **Authenticate** opens the Google login in the browser and succeeds
- [ ] Bluetooth/serial connects and the EMG/IMU graphs update
- [ ] The camera preview works (CVKAS)
- [ ] A test recording can be started, stopped, and exported
- [ ] Whatever you changed works

If something fails, read `~/Documents/BionixDataCollection/app.log`.

### 4. Releasing an update (recommended)

Releases are built automatically by GitHub Actions for Windows, Apple Silicon Macs, and Intel Macs:

1. Merge your changes into `main`.
2. Pick the next version number ([semver](https://semver.org): bug fix `v1.2.3 → v1.2.4`, new feature `→ v1.3.0`), then tag and push from an up-to-date `main`:
   ```bash
   git checkout main && git pull
   git tag v1.3.0
   git push origin v1.3.0
   ```
3. Watch the **Actions** tab. The *Build executables* workflow takes several minutes. When it finishes, a new **Release** with the three zips appears under **Releases**, with notes generated from the merged PRs.
4. Tell users to download the new zip and replace their old app. Their data in `~/Documents/BionixDataCollection/` is kept.

To get test builds **without** making a release, go to **Actions → Build executables → Run workflow** and pick a branch. The zips appear as downloadable artifacts at the bottom of the workflow run page.

If a release build is broken, delete the release and tag on GitHub (`git push --delete origin v1.3.0`), fix the problem, and tag again.

### Troubleshooting the packaged app

- **App opens then immediately closes / nothing happens:** read `app.log` in the data folder. A missing module or file there usually means you need a `hiddenimports` or `datas` entry (see step 2).
- **Camera shows "No preview" on macOS:** enable the app under **System Settings → Privacy & Security → Camera**. If you denied it once, run `tccutil reset Camera ca.albertabionix.emg-imu-data-collection` and relaunch.
- **"App is damaged and can't be opened" on macOS:** run the `xattr -dr com.apple.quarantine …` command from [Installing](#installing--running-the-packaged-app).
- **Build fails with `code/frontend/dist is missing`:** you ran PyInstaller directly. Use the build script, which builds the frontend first.
- **Testing the production frontend without packaging:** run `npm run build` in `code/frontend`, start `python main.py`, and open http://127.0.0.1:5000. Flask serves the built frontend the same way the packaged app does.
