# Stock App

A full-stack application for tracking stocks, displaying news, and educational resources.

## Setup Instructions

### Backend Setup
1. Create a Python virtual environment (recommended):
```bash
python -m venv venv
source venv/bin/activate  # On macOS/Linux
# or
.\venv\Scripts\activate  # On Windows
```

2. Install backend dependencies:
```bash
pip install -r backend/requirements.txt
```

3. Start the backend server:
```bash
cd backend
uvicorn main:app --reload
```

### Frontend Setup
1. Install frontend dependencies:
```bash
cd frontend
npm install
```

2. Start the frontend development server:
```bash
npm start
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000 