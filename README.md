# EMG-and-IMU-Data-Collection
An application to collect data EMG and IMU data using JS, HTML, and CSS.

## Downloads

1. Download [node.js](https://nodejs.org/en/download) and follow the steps given.
2. Check if node.js is downloaded properly
   ```bash
   node -v
   ```
   → v24.12.0 or higher
   ```bash
   npm -v 
   ```
   → 11.9.0 or higher
   
## BionixDB Setup

The backend uploads recorded datasets through [BionixDB](https://github.com/albertabionix/bionix-db), which is a **separate sibling repository** — `requirements.txt` installs it as `-e ../bionix-db`, so it must be cloned next to this repo (not inside it):

```bash
git clone https://github.com/albertabionix/EMG-and-IMU-Data-Collection.git
git clone https://github.com/albertabionix/bionix-db.git
# the two repos must sit side by side, e.g.:
#   AlbertaBionix/
#   |---- EMG-and-IMU-Data-Collection/
#   |---- bionix-db/
```

`pip install -r requirements.txt` (step 2 below) will fail with a "no such file or directory" error if `bionix-db` isn't present at `../bionix-db` relative to this repo.

BionixDB itself needs no separate setup or credentials file — it ships with a bundled OAuth client. Clicking **Authenticate** in the app opens a browser window for you to sign in with your **Alberta Bionix Google account** — every click opens a fresh login (it never silently reuses a cached session), so re-authenticating always reflects your current Drive access. You need to be a member of the Alberta Bionix Shared Google Drive to authenticate at all, and exporting recordings additionally requires `CONTENT_MANAGER` (organizer/file organizer) access on that Drive — being a `CONTRIBUTOR` member is not enough. The **Start** button stays disabled until `CONTENT_MANAGER` access is confirmed. See [bionix-db's README](https://github.com/albertabionix/bionix-db/blob/main/README.md) for details on access levels.

If a login is stuck (e.g. you closed the Google sign-in tab without finishing), the Authenticate button turns into a **Cancel** button you can click immediately — it doesn't otherwise time out for 90 seconds.

## Recording and Exporting

1. After clicking **Start**, recordings are made per modality. Today only **EMG** recording is implemented (via **Record**/**Stop**); IMU and CVKAS data collection are still under development.
2. Clicking **Stop** opens a popup asking whether to **Export** (upload the recording to BionixDB and delete the local copy) or **Cancel** (discard the local copy without uploading). If you navigate away, refresh, or close the tab without choosing, the local recording is automatically discarded so it doesn't pile up unexported.
3. Exporting uploads whichever modalities were actually recorded for that trial in one call, so they share a trial number in Drive.

## Getting Started (Windows)
1. Clone the repository (see [BionixDB Setup](#bionixdb-setup) above — clone `bionix-db` as a sibling repo too):
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
3. Run EMG backend:
   ```bash
   cd .\EMG-IMU\backend\
   python main.py
   ```
4. Run React frontend:
   ```bash
   cd .\EMG-IMU\frontend\
   npm install
   npm audit fix (if needed)
   npm run dev
   ```

## Getting Started (macOS)

1. Clone the repository (see [BionixDB Setup](#bionixdb-setup) above — clone `bionix-db` as a sibling repo too):
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
3. Run backend:
   ```bash
   cd ./EMG-IMU/backend/
   python3 main.py
   ```
4. Run frontend:
   ```bash
   cd ./EMG-IMU/frontend/
   npm install
   npm audit fix (if needed)
   npm run dev
   ```

Open the frontend at http://localhost:5173 (Vite default) and check the backend terminal for its bind address/port. Click **Authenticate** before **Start** — the Start button stays disabled until BionixDB grants `CONTENT_MANAGER` access.