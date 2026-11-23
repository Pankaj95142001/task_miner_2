"""Render recorded target locations without changing original screenshot evidence."""
from io import BytesIO
import math
from PIL import Image, ImageDraw

GREEN = (22, 180, 70)


def highlight_box(step, phase, image_size):
    # A post-action page can be entirely different; event bounds do not describe it.
    if phase != 'before' or step.get('sensitive') or step.get('action') not in ('click', 'input'):
        return None
    point = step.get('coordinates') or {}
    if step.get('source') == 'desktop':
        bounds = (step.get(phase) or {}).get('desktop_bounds')
        if not bounds and point.get('space') == 'desktop':
            bounds = {key: point.get('desktop_'+key) for key in ('left','top','width','height')}
        if not bounds: return None
        left, top, width, height = (bounds.get(k) for k in ('left','top','width','height'))
        rect = (step.get('desktop_target') or {}).get('rect')
        if rect:
            x, y, w, h = rect['x']-left, rect['y']-top, rect['width'], rect['height']
        elif step['action'] == 'click' and point.get('space') == 'desktop':
            x, y, w, h = point['screen_x']-left-12, point['screen_y']-top-12, 24, 24
        else: return None
    else:
        shot_url = (step.get(phase) or {}).get('url')
        if shot_url and step.get('url') and shot_url != step['url']: return None
        target = step.get('browser_target') or {}
        rect = target.get('rect')
        width = target.get('viewport_width') if rect else point.get('viewport_width')
        height = target.get('viewport_height') if rect else point.get('viewport_height')
        if rect:
            x, y, w, h = (rect[k] for k in ('x','y','width','height'))
        elif step['action'] == 'click' and 'x' in point and 'y' in point:
            x, y, w, h = point['x']-12, point['y']-12, 24, 24
        else: return None
    numbers = (x,y,w,h,width,height)
    if any(not isinstance(v,(int,float)) or not math.isfinite(v) for v in numbers): return None
    if width <= 0 or height <= 0 or w <= 0 or h <= 0: return None
    iw, ih = image_size
    # Browser/desktop screenshots are scaled, not cropped. Reject conflicting geometry.
    if abs((iw/ih)/(width/height)-1) > .03: return None
    x1, y1 = max(0,x), max(0,y)
    x2, y2 = min(width,x+w), min(height,y+h)
    if x2<=x1 or y2<=y1: return None
    box = (min(iw-1,round(x1*iw/width)),min(ih-1,round(y1*ih/height)),min(iw-1,round(x2*iw/width)),min(ih-1,round(y2*ih/height)))
    return box if box[2] > box[0] and box[3] > box[1] else None


def annotated_screenshot(path, step, phase):
    with Image.open(path) as original:
        box = highlight_box(step, phase, original.size)
        if not box: return None
        picture = original.convert('RGB')
        draw = ImageDraw.Draw(picture)
        line_width = max(3, round(min(picture.size)/240))
        draw.rectangle(box, outline=GREEN, width=line_width)
        result = BytesIO(); picture.save(result, 'PNG'); result.seek(0)
        return result
