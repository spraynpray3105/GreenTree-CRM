from suncalc import get_position, get_times
from datetime import datetime, timedelta, timezone
import math

# Optional timezone lookup (best-effort). If timezonefinder is available we'll use
# it to convert times to the location's local timezone. If not available we fall
# back to the server local timezone.
try:
    from timezonefinder import TimezoneFinder
    TF = TimezoneFinder()
except Exception:
    TF = None
try:
    from zoneinfo import ZoneInfo
except Exception:
    ZoneInfo = None


def get_optimal_times(lat, lng, date_str=None):
    """Return sunrise/sunset and a practical golden-hour window (evening preferred).

    The suncalc library can return multiple named times. To avoid mismatches
    (for example golden-hour keys differing between implementations), we
    compute a conservative evening golden hour as the 60-minute window ending
    at sunset when sunset is available. We then compute the sun azimuth at the
    midpoint of that window.

    Returns a dict with formatted times (strings) and numeric azimuth in degrees.
    """
    if date_str:
        date = datetime.strptime(date_str, '%Y-%m-%d')
    else:
        date = datetime.now()

    times = get_times(date, lat, lng) or {}

    # Determine target timezone for formatting. Try timezonefinder first.
    tzinfo = None
    if TF:
        try:
            tzname = TF.timezone_at(lat=lat, lng=lng)
            if tzname and ZoneInfo:
                tzinfo = ZoneInfo(tzname)
        except Exception:
            tzinfo = None
    # fallback to server local tz
    if tzinfo is None:
        try:
            tzinfo = datetime.now().astimezone().tzinfo
        except Exception:
            tzinfo = timezone.utc

    # Normalize commonly used keys; fallback to None when not found
    sunrise = times.get('sunrise') or times.get('sunriseBegin') or times.get('sunriseEnd')
    sunset = times.get('sunset') or times.get('sunsetEnd') or times.get('sunsetStart')

    # Ensure datetimes are timezone-aware: treat naive datetimes from suncalc as UTC
    def ensure_tz(dt):
        if not dt:
            return None
        try:
            if dt.tzinfo is None:
                # many suncalc implementations return naive datetimes in UTC
                dt = dt.replace(tzinfo=timezone.utc)
            # convert to target tz
            return dt.astimezone(tzinfo)
        except Exception:
            return dt

    sunrise = ensure_tz(sunrise)
    sunset = ensure_tz(sunset)

    # Determine an evening golden-hour window: prefer 60 minutes ending at sunset
    golden_start = None
    golden_end = None
    if sunset:
        try:
            golden_end = sunset
            golden_start = sunset - timedelta(minutes=60)
            # ensure golden_start is after sunrise (if sunrise exists)
            if sunrise and golden_start < sunrise:
                # if that happens (very short day), clamp to sunrise -> sunset window
                golden_start = sunrise
        except Exception:
            golden_start = None
            golden_end = None
    else:
        # As a fallback try to use any 'goldenHour' keys provided by suncalc
        gh = times.get('goldenHour') or times.get('goldenHourEnd') or times.get('golden_hour')
        if gh:
            # treat this as the golden_end and set start to 60 minutes earlier
            try:
                golden_end = gh
                golden_start = gh - timedelta(minutes=60)
            except Exception:
                golden_start = None
                golden_end = None

    # Compute azimuth at midpoint of golden window when possible
    azimuth_deg = None
    front_facing = None
    if golden_start and golden_end:
        try:
            midpoint = golden_start + (golden_end - golden_start) / 2
            pos = get_position(midpoint, lat, lng)
            az = pos.get('azimuth') if isinstance(pos, dict) else getattr(pos, 'azimuth', None)
            if az is not None:
                # suncalc returns azimuth in radians; convert to degrees 0..360
                azimuth_deg = (math.degrees(az) + 360) % 360
                directions = ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West']
                idx = int((azimuth_deg + 22.5) // 45) % 8
                front_facing = directions[idx]
        except Exception:
            azimuth_deg = None
            front_facing = None

    # Formatting: use consistent 12-hour and 24-hour display where appropriate
    def fmt(dt, fmt_str='%I:%M %p'):
        try:
            return dt.strftime(fmt_str)
        except Exception:
            return None

    sunrise_str = fmt(sunrise) if sunrise else None
    sunset_str = fmt(sunset) if sunset else None
    golden_str = fmt(golden_start) if golden_start else None
    best_window = None
    if golden_start and golden_end:
        best_window = f"{golden_start.strftime('%I:%M %p')} - {golden_end.strftime('%I:%M %p')}"

    warning = None
    if sunset_str:
        warning = f"House may be in shadow after {sunset_str}."

    return {
        "sunrise": sunrise_str,
        "golden_hour": golden_str,
        "sunset": sunset_str,
        "best_window": best_window,
        "azimuth_deg": azimuth_deg,
        "front_facing": front_facing,
        "shadow_warning": warning
    }