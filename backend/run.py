"""Run from the repository root: .venv/Scripts/python.exe -m backend.run"""
import uvicorn

if __name__ == "__main__":
    uvicorn.run("backend.app.main:create_app", factory=True, host="127.0.0.1", port=8000)
