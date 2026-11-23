from typing import Literal
from uuid import UUID
from urllib.parse import urlsplit

from pydantic import AwareDatetime, BaseModel, Field, field_validator


class WorkflowCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    recording_context: str = Field(default="", max_length=2000)

    @field_validator("recording_context")
    @classmethod
    def context_trimmed(cls, value):
        return value.strip()

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, value):
        if not value.strip():
            raise ValueError("A title is required")
        return value.strip()


class WorkflowEdit(WorkflowCreate):
    purpose: str = Field(default="", max_length=5000)
    scope: str = Field(default="", max_length=5000)
    prerequisites: str = Field(default="", max_length=5000)
    description: str = Field(default="", max_length=5000)
    version: int


class RecorderStart(WorkflowCreate):
    mode: Literal['browser', 'desktop'] = 'browser'
    url: str = Field(default="", max_length=4096)

    @field_validator("url")
    @classmethod
    def browser_url(cls, value):
        value = value.strip()
        if not value:
            return ""
        parts = urlsplit(value)
        if parts.scheme not in ("http", "https") or not parts.hostname or parts.username or parts.password:
            raise ValueError("Enter an http:// or https:// page URL without embedded credentials.")
        return value


class TargetRect(BaseModel):
    x: float = Field(allow_inf_nan=False)
    y: float = Field(allow_inf_nan=False)
    width: float = Field(ge=0, allow_inf_nan=False)
    height: float = Field(ge=0, allow_inf_nan=False)


class DesktopBounds(BaseModel):
    left: float = Field(allow_inf_nan=False)
    top: float = Field(allow_inf_nan=False)
    width: float = Field(gt=0, allow_inf_nan=False)
    height: float = Field(gt=0, allow_inf_nan=False)


class Snapshot(BaseModel):
    desktop_bounds: DesktopBounds | None = None
    data_url: str | None = Field(default=None, max_length=8_000_000)
    captured_at: AwareDatetime | None = None
    url: str = Field(default="", max_length=4096)
    note: str = Field(default="", max_length=1000)


class ClickCoordinates(BaseModel):
    """Pointer location at click time; all distances are CSS pixels."""
    x: float = Field(ge=0, allow_inf_nan=False)
    y: float = Field(ge=0, allow_inf_nan=False)
    page_x: float = Field(allow_inf_nan=False)
    page_y: float = Field(allow_inf_nan=False)
    scroll_x: float = Field(allow_inf_nan=False)
    scroll_y: float = Field(allow_inf_nan=False)
    viewport_width: float = Field(gt=0, allow_inf_nan=False)
    viewport_height: float = Field(gt=0, allow_inf_nan=False)
    device_pixel_ratio: float = Field(gt=0, allow_inf_nan=False)


class DesktopCoordinates(BaseModel):
    space: Literal['desktop']
    x: float = Field(ge=0, allow_inf_nan=False)
    y: float = Field(ge=0, allow_inf_nan=False)
    screen_x: float = Field(allow_inf_nan=False)
    screen_y: float = Field(allow_inf_nan=False)
    desktop_left: float = Field(allow_inf_nan=False)
    desktop_top: float = Field(allow_inf_nan=False)
    desktop_width: float = Field(gt=0, allow_inf_nan=False)
    desktop_height: float = Field(gt=0, allow_inf_nan=False)


class DesktopTarget(BaseModel):
    rect: TargetRect | None = None
    auto_id: str = Field(default='', max_length=300)
    name: str = Field(default='', max_length=300)
    control_type: str = Field(default='', max_length=50)


class SelectorCandidate(BaseModel):
    selector: str = Field(min_length=1, max_length=1000)
    strategy: Literal['testid', 'id', 'attribute', 'href', 'structure']


class BrowserTarget(BaseModel):
    tag: str = Field(max_length=50)
    role: str = Field(default='', max_length=50)
    name: str = Field(default='', max_length=300)
    candidates: list[SelectorCandidate] = Field(default_factory=list, max_length=8)
    rect: TargetRect
    viewport_width: float = Field(gt=0, allow_inf_nan=False)
    viewport_height: float = Field(gt=0, allow_inf_nan=False)


class CaptureHost(BaseModel):
    kind: Literal['remote_agent'] = 'remote_agent'
    agent_id: UUID
    machine: str = Field(min_length=1, max_length=200)


class StepCreate(BaseModel):
    id: UUID
    sequence: int = Field(ge=1)
    action: Literal["click", "input", "select", "navigate", "tab_switch", "submit", "window_switch", "key", "scroll"]
    source: Literal['browser', 'desktop'] = 'browser'
    app_name: str = Field(default='', max_length=200)
    mouse_button: Literal['left', 'right', 'middle'] = 'left'
    occurred_at: AwareDatetime
    tab_id: int
    url: str = Field(max_length=4096)
    page_title: str = Field(default="", max_length=500)
    selector: str = Field(default="", max_length=1000)
    label: str = Field(default="", max_length=300)
    value: str = Field(default="", max_length=2000)
    sensitive: bool = False
    capture_host: CaptureHost | None = None
    desktop_target: DesktopTarget | None = None
    browser_target: BrowserTarget | None = None
    input_group_id: UUID | None = None
    desktop_field_id: list[int] | None = Field(default=None, max_length=64)
    text_capture: Literal['captured', 'truncated', 'protected', 'unavailable'] | None = None
    coordinates: ClickCoordinates | DesktopCoordinates | None = None
    before: Snapshot = Field(default_factory=Snapshot)
    after: Snapshot = Field(default_factory=Snapshot)


class StepEdit(BaseModel):
    description: str = Field(min_length=1, max_length=5000)
    reviewed: bool = False
    version: int

    @field_validator("description")
    @classmethod
    def not_blank(cls, value):
        if not value.strip():
            raise ValueError("Instructions cannot be blank")
        return value.strip()


class Revision(BaseModel):
    version: int

class CleanRequest(Revision):
    include_edited_and_verified: bool = False



class Reorder(Revision):
    step_ids: list[str]


class CleanStep(BaseModel):
    id: str
    description: str


class CleanResult(BaseModel):
    steps: list[CleanStep]
