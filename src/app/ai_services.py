import google.generativeai as genai
import os
import json
import logging

logger = logging.getLogger('ai_services')
logger.setLevel(logging.DEBUG)

GEMINI_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_KEY:
    try:
        genai.configure(api_key=GEMINI_KEY)
        model = genai.GenerativeModel('gemini-1.5-flash')
    except Exception as e:
        logger.exception('Failed to configure Gemini client')
        model = None
else:
    logger.warning('GEMINI_API_KEY not set; AI calls will fail')
    model = None


def _try_parse_json_from_text(text: str):
    """Try to extract JSON object from arbitrary text. Return parsed object or raise."""
    if not text or not isinstance(text, str):
        raise ValueError('No text to parse')
    # remove common code fence wrappers
    clean = text.replace('```json', '').replace('```', '').strip()
    # attempt direct parse first
    try:
        return json.loads(clean)
    except Exception:
        pass
    # fallback: find the first { and the last } and parse substring
    try:
        start = clean.find('{')
        end = clean.rfind('}')
        if start != -1 and end != -1 and end > start:
            sub = clean[start:end+1]
            return json.loads(sub)
    except Exception:
        pass
    # As a last resort, try to evaluate simple key: value patterns (very best-effort)
    raise ValueError('Unable to parse JSON from model response')


def get_property_update(address: str):
    """Call the LLM to obtain a property status update for the given address.
    Returns a dict with keys like 'status', 'sold_date', 'confidence' or
    a dict containing 'error' on failure.
    """
    if not model:
        return {"error": "AI model not configured (GEMINI_API_KEY missing or client init failed)"}

    prompt = f"""
Find the current real estate status for: {address}.
Check if it is 'Active', 'Pending', or 'Sold'.
If sold, provide the date in YYYY-MM-DD.
Return ONLY a JSON object, for example:
{{"status": "Sold", "sold_date": "2024-05-20", "confidence": 0.9}}
"""
    try:
        # Keep call usage similar to existing code; wrap for safety
        response = model.generate_content(prompt)
        # response may not expose .text in some client versions; coerce to string safely
        text = None
        try:
            text = getattr(response, 'text', None) or str(response)
        except Exception:
            text = str(response)

        logger.debug('AI raw response for %s: %s', address, (text or '')[:2000])

        parsed = _try_parse_json_from_text(text)
        # sanity-check keys
        if not isinstance(parsed, dict):
            raise ValueError('Parsed response is not a JSON object')
        return parsed
    except Exception as e:
        logger.exception('Failed to get property update for %s', address)
        # include a short snippet of the model output in logs but avoid returning secrets
        return {"error": str(e)}