from django.db import transaction

from tracking.models import HybridLog
from tracking.services.geo_service import GeoService


class GPSService:

    @staticmethod
    @transaction.atomic
    def ingest(
        user,
        vehicle,
        trip,
        lat,
        lng,
        speed=0,
        heading=0,
        cell_towers=None,
        wifi_aps=None,
    ):
        from tracking.tasks import process_location_update

        point = GeoService.create_point(lat, lng)

        log = HybridLog.objects.create(
            user=user,
            vehicle=vehicle,
            trip=trip,
            location=point,
            speed=speed,
            heading=heading,
            cell_towers=cell_towers or [],
            wifi_aps=wifi_aps or [],
        )

        process_location_update.delay(
            {
                "vehicle_id": str(vehicle.id) if vehicle else None,
                "trip_id": str(trip.id) if trip else None,
                "lat": lat,
                "lng": lng,
                "speed": speed,
            }
        )

        return log