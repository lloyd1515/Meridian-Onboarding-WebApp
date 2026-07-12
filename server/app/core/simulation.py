import contextvars
import datetime
from typing import Optional

# Context variable to hold the simulated date for the duration of the request
simulated_date_ctx: contextvars.ContextVar[Optional[datetime.date]] = contextvars.ContextVar(
    "simulated_date", default=None
)

def get_today() -> datetime.date:
    """Return the simulated date if set, otherwise return the real current date."""
    sim_date = simulated_date_ctx.get()
    if sim_date is not None:
        return sim_date
    return datetime.date.today()
