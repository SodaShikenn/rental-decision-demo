"""Normalize provider route fields without inventing missing values."""
import math


def minutes(duration):
    if not isinstance(duration, str) or not duration.endswith('s'):
        return None
    try:
        value = float(duration[:-1])
        return math.ceil(value / 60) if math.isfinite(value) and value >= 0 else None
    except ValueError:
        return None


def route_view(route, mode):
    duration = minutes(route.get('duration'))
    if duration is None:
        return None
    steps = [s for leg in route.get('legs', []) for s in leg.get('steps', [])]
    transit = [s.get('transitDetails') for s in steps if s.get('travelMode') == 'TRANSIT']
    walking = [minutes(s.get('staticDuration')) for s in steps if s.get('travelMode') == 'WALK']
    complete_steps = bool(steps) and all(s.get('travelMode') for s in steps)
    walk = sum(walking) if complete_steps and all(m is not None for m in walking) else None
    lines = []
    for detail in transit:
        if not detail:
            continue
        line = detail.get('transitLine', {})
        stops = detail.get('stopDetails', {})
        lines.append({'name': line.get('nameShort') or line.get('name', '路線名未取得'),
                      'from': stops.get('departureStop', {}).get('name', ''), 'to': stops.get('arrivalStop', {}).get('name', ''),
                      'departure': stops.get('departureTime'), 'arrival': stops.get('arrivalTime'),
                      'agencies': line.get('agencies', [])})
    return {'minutes': duration, 'meters': route.get('distanceMeters'),
            'walkingMinutes': duration if mode == 'WALK' else walk,
            'transfers': 0 if mode == 'WALK' else max(0, len(transit) - 1) if complete_steps else None,
            'lines': lines, 'fare': route.get('travelAdvisory', {}).get('transitFare'),
            'warnings': route.get('warnings', [])}


