import os
import secrets
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

PROJECT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT / ".env")


@dataclass
class Settings:
    data_dir: Path
    token: str
    api_key: str = ""
    model: str = "gpt-4o-mini"
    browser_channel: str = "chromium"
    vision_model: str = ""

    def __post_init__(self):
        if self.browser_channel not in ("chromium", "msedge"):
            raise RuntimeError("SOP_BROWSER_CHANNEL must be chromium or msedge.")

    @classmethod
    def from_env(cls):
        directory = Path(os.getenv("SOP_DATA_DIR", "data"))
        if not directory.is_absolute():
            directory = PROJECT / directory
        directory.mkdir(parents=True, exist_ok=True)
        token_file = directory / "session-token.txt"
        token = os.getenv("SOP_TOKEN", "").strip()
        if not token:
            if not token_file.exists():
                token_file.write_text(secrets.token_urlsafe(32), encoding="utf-8")
            token = token_file.read_text(encoding="utf-8").strip()
        if len(token) < 16:
            raise RuntimeError("SOP_TOKEN must have at least 16 characters.")
        return cls(directory, token, os.getenv("OPENAI_API_KEY", ""), os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
                   browser_channel=os.getenv("SOP_BROWSER_CHANNEL", "chromium").strip().lower(),
                   vision_model=os.getenv("OPENAI_VISION_MODEL", "").strip())
