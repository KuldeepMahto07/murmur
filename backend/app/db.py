import json
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, Session, SQLModel, create_engine, select

from .config import DB_PATH, JOBS_DIR

engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Job(SQLModel, table=True):
    id: str = Field(primary_key=True)
    title: str
    source_type: str = "file"  # file | url
    source_url: Optional[str] = None
    original_filename: Optional[str] = None
    media_file: Optional[str] = None  # file name inside the job folder

    status: str = "queued"  # queued | running | done | failed
    stage: str = "Waiting in queue"
    progress: float = 0.0
    error: Optional[str] = None

    language: Optional[str] = None  # None = detect
    detected_language: Optional[str] = None
    mode: str = "steady"
    diarize: bool = False
    num_speakers: int = -1  # -1 = detect
    translate_to_english: bool = False
    clean_audio: bool = False
    diarization_method: Optional[str] = None

    duration: Optional[float] = None
    speakers_json: str = "{}"  # {"SPEAKER_00": "Alice"}
    created_at: datetime = Field(default_factory=utcnow)
    finished_at: Optional[datetime] = None

    @property
    def folder(self):
        return JOBS_DIR / self.id

    @property
    def speakers(self) -> dict:
        return json.loads(self.speakers_json or "{}")

    def public(self) -> dict:
        d = self.model_dump()
        d.pop("speakers_json", None)
        d["speakers"] = self.speakers
        d["has_media"] = bool(self.media_file)
        d["translations"] = sorted(p.stem.split(".")[-1] for p in self.folder.glob("transcript.*.json"))
        return d


def init_db():
    SQLModel.metadata.create_all(engine)
    # Jobs interrupted by a restart go back to the queue.
    with Session(engine) as s:
        for job in s.exec(select(Job).where(Job.status == "running")):
            job.status, job.stage, job.progress = "queued", "Waiting in queue", 0.0
            s.add(job)
        s.commit()
