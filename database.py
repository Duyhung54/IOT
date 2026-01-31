from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel, create_engine, Session

class Telemetry(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    device_id: str
    unit: str
    ts: int
    temp_inside: float
    temp_outside: float
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ACSettings(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    mode: str = Field(default="manual")  # "manual" or "auto"
    is_on: bool = Field(default=False)
    target_temp: float = Field(default=22.0)
    threshold_temp: float = Field(default=25.0)
    automation_enabled: bool = Field(default=False)
    last_updated: datetime = Field(default_factory=datetime.utcnow)

sqlite_file_name = "iot.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"

engine = create_engine(sqlite_url)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
