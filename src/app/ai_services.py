"""
ai_services (Groq-only)

This module intentionally uses Groq as the sole LLM provider. It provides a
single helper `get_property_update(address)` which the application uses to
obtain property status info. If Groq is not configured the helper returns a
structured error dict with a low-confidence local fallback so the UI can
render test data.
"""

import os
import json
import logging
from typing import Any, Dict

logger = logging.getLogger('ai_services')
logger.setLevel(logging.DEBUG)

# Configuration
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

# Attempt to import Groq and requests; keep graceful fallbacks so the app
# can start even if the libs or keys are missing.
GROQ_CLIENT = None
requests = None
try:
    from groq import Groq  # type: ignore
    import requests as _requests  # type: ignore
    requests = _requests
    if GROQ_API_KEY:
        try:
            GROQ_CLIENT = Groq(api_key=GROQ_API_KEY)
        except Exception:
            GROQ_CLIENT = None
except Exception:
    GROQ_CLIENT = None
    try:
        import requests as _requests  # type: ignore
        requests = _requests
    except Exception:
        requests = None


def _try_parse_json_from_text(text: str) -> Any:
    """Attempt to extract and parse a JSON object from model text output.

    Raises ValueError when parsing fails.
    """
    if not text or not isinstance(text, str):
        raise ValueError('No text to parse')
    clean = text.replace('```json', '').replace('```', '').strip()
    # direct parse
    try:
        return json.loads(clean)
    except Exception:
        pass
    # try to find first {...} block
    try:
        start = clean.find('{')
        end = clean.rfind('}')
        if start != -1 and end != -1 and end > start:
            return json.loads(clean[start:end+1])
    except Exception:
        pass
    raise ValueError('Unable to parse JSON from model response')


def _get_live_data_via_tavily(address: str) -> str | None:
    """Call Tavily (best-effort) to obtain live search data for an address.

    Returns a stringified result or None on failure / if not configured.
    """
    if not TAVILY_API_KEY or not requests:
        return None
    try:
        url = "https://api.tavily.com"
        payload = {"api_key": TAVILY_API_KEY, "query": f"status of {address} zillow redfin"}
        resp = requests.post(url, json=payload, timeout=8)
        resp.raise_for_status()
        j = resp.json()
        if isinstance(j, dict) and 'results' in j:
            return str(j.get('results'))
        return str(j)
    except Exception:
        logger.exception('Failed to fetch live data from Tavily')
        return None


def _ai_status_check_groq(address: str) -> Dict[str, Any]:
    """Use Groq to classify the property status given optional live search data.

    Returns a parsed JSON dict on success, or an error dict with 'error' on
    failure.
    """
    if not GROQ_CLIENT:
        return {"error": "Groq client not configured"}

    live_info = _get_live_data_via_tavily(address) or ""
    try:
        # Keep the prompt minimal and ask for JSON only.
        prompt = (
            f"Based on this search data: {live_info}, what is the status of {address}? "
            "Return JSON only with keys: status (Sold|Active|Pending), sold_date (YYYY-MM-DD or null), "
            "confidence (0.0-1.0), summary (provide references and summary of the property... E.G: Sources [] A beautiful 3 bedroom estate located on a lake, for example)."
        )
        chat_completion = GROQ_CLIENT.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model=GROQ_MODEL,
        )
        # Extract content from common response shapes
        content = None
        try:
            content = chat_completion.choices[0].message.content
        except Exception:
            content = getattr(chat_completion, 'text', None) or str(chat_completion)

        parsed = _try_parse_json_from_text(content)
        if not isinstance(parsed, dict):
            return {"error": "Groq returned non-dict JSON"}
        return parsed
    except Exception as e:
        logger.exception('Groq integration failed for %s', address)
        return {"error": str(e)}


def get_property_update(address: str) -> Dict[str, Any]:
    """Public helper used by the API to produce a property status dictionary.

    On success returns a dict with keys: status, sold_date, confidence, summary.
    On failure returns a dict containing 'error' and a low-confidence 'fallback'.
    """
    if not GROQ_CLIENT:
        details = {"error": "Groq not configured (GROQ_API_KEY missing)."}
        details["suggestion"] = "Set GROQ_API_KEY in environment and restart the server."
        details["fallback"] = {
            'status': 'Unknown',
            'sold_date': None,
            'confidence': 0.0,
            'summary': f'Groq not configured. Local heuristic suggests unknown status for {address}.',
            '_local_fallback': True,
        }
        return details

    res = _ai_status_check_groq(address)
    if isinstance(res, dict) and not res.get('error'):
        out = {
            'status': (res.get('status') or 'Unknown'),
            'sold_date': res.get('sold_date'),
            'confidence': float(res.get('confidence')) if res.get('confidence') is not None else None,
            'summary': res.get('summary') or None,
        }
        return out

    # Error path: return structured error and fallback for the UI
    fallback = {
        'status': 'Unknown',
        'sold_date': None,
        'confidence': 0.0,
        'summary': f'Groq error or no result for {address}.',
        '_local_fallback': True,
    }
    err = res.get('error') if isinstance(res, dict) else str(res)
    return {"error": err, "fallback": fallback}
    