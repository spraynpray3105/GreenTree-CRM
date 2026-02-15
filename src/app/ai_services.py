import os
import json
import logging
from google.api_core.exceptions import NotFound

logger = logging.getLogger('ai_services')
logger.setLevel(logging.DEBUG)

# Read config early
GEMINI_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")
AVAILABLE_MODELS = None

# Prefer the new genai wrapper usage: `from google import genai; client = genai.Client()`
GENAI_NEW_PKG = None
GENAI_NEW_CLIENT = None
USE_GENAI_NEW = False
try:
    from google import genai as genai_new
    GENAI_NEW_PKG = genai_new
    try:
        # try to pass the API key if constructor accepts it
        if GEMINI_KEY:
            try:
                GENAI_NEW_CLIENT = genai_new.Client(api_key=GEMINI_KEY)
            except TypeError:
                # some versions may not accept api_key kwarg
                GENAI_NEW_CLIENT = genai_new.Client()
        else:
            GENAI_NEW_CLIENT = genai_new.Client()
        USE_GENAI_NEW = True
    except Exception:
        GENAI_NEW_CLIENT = None
        USE_GENAI_NEW = False
except Exception:
    GENAI_NEW_PKG = None
    GENAI_NEW_CLIENT = None
    USE_GENAI_NEW = False

# Next try: google.ai generative_v1 client (lower-level official client)
NEW_CLIENT = False
GENAI_SERVICE = None
try:
    try:
        from google.ai import generative_v1 as generative
    except Exception:
        from google.ai import generative as generative
    try:
        GENAI_SERVICE = generative.GenerativeServiceClient()
        NEW_CLIENT = True
    except Exception:
        GENAI_SERVICE = None
        NEW_CLIENT = False
except Exception:
    NEW_CLIENT = False
    GENAI_SERVICE = None

# Fallback to the older google.generativeai package
OLD_GENAI_PKG = None
OLD_MODEL = None
try:
    import google.generativeai as genai_old
    OLD_GENAI_PKG = genai_old
except Exception:
    try:
        from google import genai as genai_old  # some environments alias this way
        OLD_GENAI_PKG = genai_old
    except Exception:
        OLD_GENAI_PKG = None

# Determine which client/model indicator to use
# Options:
# - 'GENAI_NEW' -> use GENAI_NEW_CLIENT (genai.Client())
# - 'GENAI_SERVICE' -> use GENAI_SERVICE (google.ai.generative_v1)
# - object -> use OLD_MODEL (genai_old.GenerativeModel)
model = None

if GEMINI_KEY:
    if USE_GENAI_NEW and GENAI_NEW_CLIENT is not None:
        # try to probe available models via the new client if possible
        try:
            if hasattr(GENAI_NEW_CLIENT, 'models') and hasattr(GENAI_NEW_CLIENT.models, 'list'):
                raw = GENAI_NEW_CLIENT.models.list()
                models = []
                try:
                    for m in raw:
                        name = getattr(m, 'name', None) or (m.get('name') if isinstance(m, dict) else None) or str(m)
                        models.append(name)
                except Exception:
                    try:
                        name = getattr(raw, 'name', None) or (raw.get('name') if isinstance(raw, dict) else str(raw))
                        models = [name]
                    except Exception:
                        models = [str(raw)]
                AVAILABLE_MODELS = models
        except Exception:
            logger.exception('Could not list models using genai.Client()')
        model = 'GENAI_NEW'
    elif NEW_CLIENT and GENAI_SERVICE is not None:
        # try to list models from the service client
        try:
            if hasattr(GENAI_SERVICE, 'list_models'):
                raw = GENAI_SERVICE.list_models()
                models = []
                try:
                    for m in raw:
                        name = getattr(m, 'name', None) or (m.get('name') if isinstance(m, dict) else None) or str(m)
                        models.append(name)
                except Exception:
                    try:
                        name = getattr(raw, 'name', None) or (raw.get('name') if isinstance(raw, dict) else str(raw))
                        models = [name]
                    except Exception:
                        models = [str(raw)]
                AVAILABLE_MODELS = models
        except Exception:
            logger.exception('Could not list models using GenerativeServiceClient')
        model = 'GENAI_SERVICE'
    elif OLD_GENAI_PKG is not None:
        try:
            try:
                OLD_GENAI_PKG.configure(api_key=GEMINI_KEY)
            except Exception:
                pass
            try:
                OLD_MODEL = OLD_GENAI_PKG.GenerativeModel(GEMINI_MODEL)
                model = OLD_MODEL
            except Exception:
                # try to list models via the old package for diagnostics
                try:
                    if hasattr(OLD_GENAI_PKG, 'list_models'):
                        raw = OLD_GENAI_PKG.list_models()
                        models = []
                        try:
                            for m in raw:
                                name = getattr(m, 'name', None) or (m.get('name') if isinstance(m, dict) else None) or str(m)
                                models.append(name)
                        except Exception:
                            try:
                                name = getattr(raw, 'name', None) or (raw.get('name') if isinstance(raw, dict) else str(raw))
                                models = [name]
                            except Exception:
                                models = [str(raw)]
                        AVAILABLE_MODELS = models
                except Exception:
                    logger.exception('Failed to list models using old client')
                model = None
        except Exception:
            logger.exception('Failed to configure old google.generativeai client')
            model = None
    else:
        logger.warning('No Google generative client libraries installed; AI calls will fail')
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
        # Provide a helpful error including available models if we discovered them
        msg = 'AI model not configured (GEMINI_API_KEY missing or client init failed)'
        details = {'error': msg}
        if AVAILABLE_MODELS:
            details['available_models'] = AVAILABLE_MODELS
            details['suggestion'] = 'Set GEMINI_MODEL to one of the available model names and restart the server.'
        else:
            details['suggestion'] = 'Call ListModels (if supported) or check the provider docs to find a compatible model name.'
        # Also include a low-confidence local fallback so UI can render something for testing
        details['fallback'] = {
            'status': 'Unknown',
            'sold_date': None,
            'confidence': 0.0,
            'summary': f'AI model unavailable. Local heuristic suggests unknown status for {address}.',
            '_local_fallback': True
        }
        return details

    prompt = f"""
Find the current real estate status for: {address}.
Check if it is 'Active', 'Pending', or 'Sold'.
If sold, provide the date in YYYY-MM-DD.
Return ONLY a JSON object, for example:
{{"status": "Sold", "sold_date": "2024-05-20", "confidence": 0.9}}
"""
    try:
        # Flexible invocation: support genai.Client(), google.ai service, and the older google.generativeai
        text = None
        # New genai.Client() path
        if model == 'GENAI_NEW':
            last_exc = None
            try:
                # Preferred usage per docs: client.models.generate_content(model=..., contents=...)
                if hasattr(GENAI_NEW_CLIENT, 'models') and hasattr(GENAI_NEW_CLIENT.models, 'generate_content'):
                    try:
                        resp = GENAI_NEW_CLIENT.models.generate_content(model=GEMINI_MODEL, contents=prompt)
                        # try to extract textual output
                        text = getattr(resp, 'output', None) or getattr(resp, 'text', None) or str(resp)
                    except Exception:
                        # try alternate contents shape
                        try:
                            resp = GENAI_NEW_CLIENT.models.generate_content(model=GEMINI_MODEL, contents=[{"type": "input_text", "text": prompt}])
                            text = getattr(resp, 'output', None) or getattr(resp, 'text', None) or str(resp)
                        except Exception as e:
                            last_exc = e
                else:
                    last_exc = RuntimeError('genai.Client() does not expose models.generate_content')
            except Exception as e:
                last_exc = e

            if not text:
                raise RuntimeError(f'Could not call generate_content on genai.Client(); last error: {last_exc}')

        # google.ai GenerativeServiceClient path
        elif model == 'GENAI_SERVICE':
            last_exc = None
            # try several plausible method names on the service client
            try:
                # preferred: generate_text
                if hasattr(GENAI_SERVICE, 'generate_text'):
                    try:
                        resp = GENAI_SERVICE.generate_text(request={"model": GEMINI_MODEL, "prompt": {"text": prompt}})
                        text = str(resp)
                    except Exception:
                        resp = GENAI_SERVICE.generate_text(model=GEMINI_MODEL, prompt=prompt)
                        text = str(resp)
            except Exception as e:
                last_exc = e

            if not text:
                for fn in ('generate', 'generate_text', 'generate_message', 'chat'):
                    if hasattr(GENAI_SERVICE, fn):
                        try:
                            fnc = getattr(GENAI_SERVICE, fn)
                            try:
                                resp = fnc(model=GEMINI_MODEL, prompt=prompt)
                            except TypeError:
                                resp = fnc(request={"model": GEMINI_MODEL, "input": prompt})
                            text = str(resp)
                            break
                        except Exception as e:
                            last_exc = e

            if not text:
                raise RuntimeError(f'Could not call generate on GenerativeServiceClient; last error: {last_exc}')

        else:
            # Old client path (google.generativeai.GenerativeModel instance stored in model)
            response = model.generate_content(prompt)
            # response may not expose .text in some client versions; coerce to string safely
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
    except NotFound as e:
        # Specific helpful message when the configured model is not available
        logger.exception('Model not found for address %s: %s', address, str(e))
        # return an error dict and also provide a low-confidence local heuristic fallback
        fallback = {
            'status': 'Unknown',
            'sold_date': None,
            'confidence': 0.0,
            'summary': f'Could not contact configured LLM model. Local heuristic suggests unknown status for {address}.',
            '_local_fallback': True
        }
        return {"error": f"Model not found: {str(e)}", "fallback": fallback}
    except Exception as e:
        logger.exception('Failed to get property update for %s', address)
        # include a short snippet of the model output in logs but avoid returning secrets
        return {"error": str(e)}