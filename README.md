# EMG-and-IMU-Data-Collection
An application to collect data EMG and IMU data using JS, HTML, and CSS.

## Getting Started (Windows)

1. Clone the repository:
   ```bash
   git clone https://github.com/albertabionix/EMG-and-IMU-Data-Collection.git
   cd EMG-IMU
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
   cd .\health-navigator\frontend\
   npm install
   npm audit fix (if needed)
   npm run dev
   ```

## Getting Started (macOS)

1. Clone the repository:
   ```bash
   git clone https://github.com/albertabionix/EMG-and-IMU-Data-Collection.git
   cd EMG-IMU
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

Open the frontend at http://localhost:5173 (Vite default) and check the backend terminal for its bind address/port.