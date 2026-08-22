from transport.models import City


class CitySelector:
    """
    Read-only City queries.
    """

    @staticmethod
    def list_cities():
        return (
            City.objects
            .all()
            .order_by("name")
        )

    @staticmethod
    def get_city(city_id):
        return (
            City.objects
            .get(id=city_id)
        )

    @staticmethod
    def search_cities(query):
        return (
            City.objects
            .filter(name__icontains=query)
            .order_by("name")
        )