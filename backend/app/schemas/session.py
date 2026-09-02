from datetime import date, datetime, time, timedelta, timezone
# Aliased for the one annotation that cannot use the plain name: a field
# called "datetime" with a default binds that name in its own class body,
# and the annotation next to it would then resolve to the default instead
# of the type.
from datetime import datetime as datetime_type
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

# A series is created in one transaction and shown in one list; past a couple of
# hundred both stop being reasonable, and a slip in the rule (every day for five
# years) should be refused rather than obeyed.
MAX_RECURRING_SESSIONS = 200


class SeatPriceIn(BaseModel):
    category: str
    price: float = Field(ge=0)


class SeatPriceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    category: str
    price: float


class RecurringRule(BaseModel):
    """How a series of showings repeats."""

    # 0 = Monday ... 6 = Sunday, matching date.weekday().
    days_of_week: list[int] = Field(min_length=1)
    # Wall clock, "ЧЧ:ММ". Several per day is the normal case for a cinema.
    times: list[str] = Field(min_length=1)
    start_date: date
    end_type: Literal["date", "count"] = "date"
    end_date: date | None = None
    end_count: int | None = Field(default=None, ge=1, le=MAX_RECURRING_SESSIONS)
    # Minutes east of UTC for the person filling in the form. The times above
    # are wall clock, and without this the server would read them as UTC and
    # file every showing at the wrong hour. One offset for the whole range
    # ignores a daylight-saving change inside it; the zones this runs in keep
    # a fixed offset all year.
    tz_offset_minutes: int = Field(default=0, ge=-840, le=840)

    @field_validator("days_of_week")
    @classmethod
    def _check_days(cls, value: list[int]) -> list[int]:
        days = sorted({int(day) for day in value})
        if days[0] < 0 or days[-1] > 6:
            raise ValueError("День недели задаётся числом от 0 (понедельник) до 6")
        return days

    @field_validator("times")
    @classmethod
    def _check_times(cls, value: list[str]) -> list[str]:
        moments: set[time] = set()
        for item in value:
            try:
                hour, minute = str(item).strip().split(":")
                moments.add(time(int(hour), int(minute)))
            except (TypeError, ValueError):
                raise ValueError(f"Время «{item}» должно быть в формате ЧЧ:ММ") from None
        # Sorted and deduplicated here, so the preview the admin saw and the
        # sessions that get created are in the same order.
        return [moment.strftime("%H:%M") for moment in sorted(moments)]

    @model_validator(mode="after")
    def _check_end(self) -> "RecurringRule":
        if self.end_type == "date":
            if self.end_date is None:
                raise ValueError("Укажите дату окончания серии")
            if self.end_date < self.start_date:
                raise ValueError("Дата окончания раньше даты начала")
        elif self.end_count is None:
            raise ValueError("Укажите количество сеансов в серии")
        return self

    def expand(self) -> list[datetime]:
        """Every moment the rule describes, in chronological order."""
        zone = timezone(timedelta(minutes=self.tz_offset_minutes))
        days = set(self.days_of_week)
        clock = [time(int(item[:2]), int(item[3:])) for item in self.times]

        moments: list[datetime] = []
        cursor = self.start_date
        # An end date bounds the walk by itself. A count has to bound it too:
        # a rule whose weekdays never come round would otherwise walk forever.
        last = (
            self.end_date
            if self.end_type == "date"
            else cursor + timedelta(days=730)
        )

        while cursor <= last:
            if cursor.weekday() in days:
                for moment in clock:
                    moments.append(datetime.combine(cursor, moment, tzinfo=zone))
                    if self.end_type == "count" and len(moments) >= self.end_count:
                        return moments
            cursor += timedelta(days=1)
        return moments


class SessionCreate(BaseModel):
    event_id: int
    hall_id: int
    # Mirrors the column name on the model. Carries the one showing when this
    # is a single session, and is ignored for a series, where every moment
    # comes out of the rule instead.
    datetime: datetime_type | None = None
    is_recurring: bool = False
    recurring: RecurringRule | None = None
    prices: list[SeatPriceIn] = []

    @model_validator(mode="after")
    def _check_shape(self) -> "SessionCreate":
        if self.is_recurring:
            if self.recurring is None:
                raise ValueError("Не заданы правила повторения")
        elif self.datetime is None:
            raise ValueError("Укажите дату и время сеанса")
        return self


class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_id: int
    hall_id: int | None
    datetime: datetime
    status: str
    # Set when the showing came from a recurrence rule; the id is shared with
    # every other showing of the same series.
    recurring_group_id: str | None = None

    # Flattened for the UI so one request is enough to render a session card.
    event_title: str | None = None
    hall_name: str | None = None
    venue_name: str | None = None
    seats_total: int = 0
    seats_taken: int = 0
    seats_free: int = 0
    prices: list[SeatPriceOut] = []


class SessionGroupOut(BaseModel):
    """What creating a whole series reports back."""

    group_id: str
    created: int
    # Moments the rule produced that the hall was already booked for.
    skipped: int = 0
    # The first few only: a series can run to MAX_RECURRING_SESSIONS, and the
    # confirmation needs a sample, not the lot.
    sessions: list[SessionOut] = []


class SeatMapSeat(BaseModel):
    """One cell of the seat grid, including whether it is already sold."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    row: int
    col: int
    label: str | None
    category: str
    is_aisle: bool
    is_taken: bool = False
    # Public id of the ticket holding the seat, when there is one.
    ticket_id: str | None = None
    price: float = 0.0


class SeatMapOut(BaseModel):
    session_id: int
    hall_id: int | None
    hall_name: str | None = None
    rows: int = 0
    cols: int = 0
    seats: list[SeatMapSeat] = []
    prices: list[SeatPriceOut] = []
