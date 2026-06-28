from tracking.models import HybridLog


class HybridSelector:

    @staticmethod
    def list_vehicle_logs(vehicle_id):
        return HybridLog.objects.filter(
            vehicle_id=vehicle_id
        ).order_by("-timestamp")

    @staticmethod
    def list_trip_logs(trip_id):
        return HybridLog.objects.filter(
            trip_id=trip_id
        ).order_by("-timestamp")

    @staticmethod
    def latest_vehicle_location(vehicle_id):
        return HybridLog.objects.filter(
            vehicle_id=vehicle_id
        ).first()