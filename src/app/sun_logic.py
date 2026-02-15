from suncalc import get_position, get_times
from datetime import datetime
import pandas as pd
import math

def get_optimal_times(lat, lng, date_str=None):
    if date_str:
        date = datetime.strptime(date_str, '%Y-%m-%d')
    else:
        date = datetime.now()

    # Get sunrise, sunset, and "Golden Hour"
    times = get_times(date, lat, lng)
    
    # Logic: Real estate photography is best when the sun is at a 45-degree angle 
    # to the front of the house to avoid "flat" lighting or "heavy" shadows.
    # compute sun position at golden hour (if available) to estimate azimuth
    azimuth_deg = None
    front_facing = None
    try:
        gh = times.get('golden_hour') or times.get('sunrise')
        pos = get_position(gh, lat, lng)
        # suncalc returns azimuth in radians; convert to degrees
        az = pos.get('azimuth')
        if az is not None:
            azimuth_deg = (math.degrees(az) + 360) % 360
            # convert to simple 8-point compass
            directions = ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West']
            idx = int((azimuth_deg + 22.5) // 45) % 8
            front_facing = directions[idx]
    except Exception:
        azimuth_deg = None
        front_facing = None

    sunrise_str = times['sunrise'].strftime('%I:%M %p') if times.get('sunrise') else None
    golden_str = times['golden_hour'].strftime('%I:%M %p') if times.get('golden_hour') else None
    sunset_str = times['sunset'].strftime('%I:%M %p') if times.get('sunset') else None
    best_window = f"{times['sunrise'].strftime('%H:%M')} - {times['golden_hour'].strftime('%H:%M')}" if times.get('sunrise') and times.get('golden_hour') else None

    # simple warning: after sunset the exterior will be in shadow; present a human-friendly message
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