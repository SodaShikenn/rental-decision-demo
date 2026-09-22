"""Live Maps check against public listings; prints status, never credentials.

From server/: .venv/bin/python -m commands.check_maps
Makes billed Places, Geocoding and Routes requests. No Gemini calls or disk cache.
"""

import asyncio
import json
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import httpx
from config import load_settings
from helper import AppError
from providers.google_maps import GoogleMaps
from apps.commute.models import CommuteRequest
from apps.commute.services import compare_commutes


async def main():
    key = load_settings().google_maps_api_key
    if not key:
        print(json.dumps({"configured": False}))
        return
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            places = await GoogleMaps(client, key).search("東京都 渋谷駅")
        exact = [
            p
            for p in places
            if p.get("displayName", {}).get("text") == "渋谷駅"
            and "東京都" in p.get("formattedAddress", "")
        ]
        if not exact:
            print(
                json.dumps(
                    {
                        "configured": True,
                        "destination": "ambiguous_or_missing",
                        "matches": len(exact),
                    }
                )
            )
            return
        morning = (datetime.now(ZoneInfo("Asia/Tokyo")) + timedelta(days=1)).replace(
            hour=8, minute=0, second=0, microsecond=0
        )
        while morning.weekday() >= 5:
            morning += timedelta(days=1)
        body = CommuteRequest(
            candidates=[
                {
                    "id": "louvre",
                    "name": "ルーブル渋谷松濤",
                    "address": "東京都渋谷区富ヶ谷2丁目20-18",
                },
                {
                    "id": "bresport",
                    "name": "Bresport",
                    "address": "東京都世田谷区北沢4-16-24",
                },
                {
                    "id": "gran-paseo",
                    "name": "GRAN PASEO明大前Ⅳ",
                    "address": "東京都世田谷区羽根木2-28-19",
                },
            ],
            destinationId=exact[0]["id"],
            at=morning,
            returnAt=morning.replace(hour=18),
        )
        transit = await compare_commutes(body, key)
        walk = await compare_commutes(
            body.model_copy(update={"mode": "WALK", "candidates": body.candidates[:1]}),
            key,
        )
        print(
            json.dumps(
                {
                    "checkedAt": transit["checkedAt"],
                    "destination": transit["destination"]["name"],
                    "matchingStationEntities": len(exact),
                    "schedule": {
                        "arrival": morning.isoformat(),
                        "returnDeparture": body.returnAt.isoformat(),
                    },
                    "transit": [
                        {
                            "candidate": c["name"],
                            "outbound": c["status"],
                            "return": c["returnTrip"]["status"],
                        }
                        for c in transit["candidates"]
                    ],
                    "walk": [
                        {"outbound": c["status"], "return": c["returnTrip"]["status"]}
                        for c in walk["candidates"]
                    ],
                },
                ensure_ascii=False,
                indent=2,
            )
        )
    except AppError as error:
        print(
            json.dumps(
                {
                    "configured": True,
                    "status": "provider_error",
                    "message": error.message,
                },
                ensure_ascii=False,
            )
        )


if __name__ == "__main__":
    asyncio.run(main())
