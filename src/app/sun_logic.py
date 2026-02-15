from suncalc import get_position, get_times
from datetime import datetime
import pandas as pd

def get_optimal_times(lat, lng, date_str=None):
    if date_str:
        date = datetime.strptime(date_str, '%Y-%m-%d')
    else:
        date = datetime.now()

    # Get sunrise, sunset, and "Golden Hour"
    times = get_times(date, lat, lng)
    
    # Logic: Real estate photography is best when the sun is at a 45-degree angle 
    # to the front of the house to avoid "flat" lighting or "heavy" shadows.
    return {
        "sunrise": times['sunrise'].strftime('%I:%M %p'),
        "golden_hour": times['golden_hour'].strftime('%I:%M %p'),
        "sunset": times['sunset'].strftime('%I:%M %p'),
        "best_window": f"{times['sunrise'].strftime('%H:%M')} - {times['golden_hour'].strftime('%H:%M')}"
    }