let currentMap = null;
let currentUserMarker = null;
let currentDirectionsRenderer = null;
let currentWatchId = null;
let currentIndex = 0;

window.initializeMapWithLiveLocatio = function (points, dotnetInstance) {

    var directionsService = new google.maps.DirectionsService();
    var directionsRenderer = new google.maps.DirectionsRenderer();
    var map, userMarker;
    let visitedPoints = new Set();

    // do odswieżania przy zmianie mapy
    if (currentMap) {
        currentDirectionsRenderer.setMap(null);
        currentUserMarker.setMap(null);
        currentDirectionsRenderer = null;
        currentUserMarker = null;
        currentMap = null;
        if (currentWatchId !== null) {
            navigator.geolocation.clearWatch(currentWatchId);
            currentWatchId = null;
        }
    }

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function (position)
        {
            var userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };

            // nowa mapa
            var mapOptions = {
                center: userLocation,
                zoom: 14
            };

            currentMap = new google.maps.Map(document.getElementById('map'), mapOptions);
            currentDirectionsRenderer = new google.maps.DirectionsRenderer();
            currentDirectionsRenderer.setMap(currentMap);

            currentUserMarker = new google.maps.Marker(
                {
                position: userLocation,
                map: currentMap,
                title: "JA",
                icon: {
                    url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png"
                }
            });
            points.forEach(point => {
                new google.maps.Marker({
                    position: { lat: point.latitude, lng: point.longitude },
                    map: currentMap,
                    title: point.name
                });
            });

            function getDistance(lat1, lon1, lat2, lon2) {
                const R = 6371000; // promień Ziemi w metrach
                const fi1 = lat1 * Math.PI / 180;
                const fi2 = lat2 * Math.PI / 180;
                const Δφ = (lat2 - lat1) * Math.PI / 180;
                const Δλ = (lon2 - lon1) * Math.PI / 180;

                const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                    Math.cos(fi1) * Math.cos(fi2) *
                    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

                return R * c;
            }

            function checkVisitedPoints(userLat, userLng)
            {
                if (currentIndex < points.length)
                {
                    const point = points[currentIndex];
                    const distance = getDistance(userLat, userLng, point.latitude, point.longitude);
                    if (distance <= 30)
                    {
                        visitedPoints.add(currentIndex);
                        console.log(`Zaliczony: ${point.name}`);
                        dotnetInstance.invokeMethodAsync("MarkPointAsVisited", currentIndex);
                        currentIndex++;
                    }
                }
            }

            // wyznaczacz trase
            function updateRoute(currentLocation) {
                var waypoints = points.map(point => ({
                    location: new google.maps.LatLng(point.latitude, point.longitude),
                    stopover: true
                }));

                var request = {
                    origin: currentLocation,
                    destination: waypoints[waypoints.length - 1].location,
                    waypoints: waypoints.slice(0, waypoints.length - 1),
                    travelMode: google.maps.TravelMode.WALKING
                };

                directionsService.route(request, function (result, status) {
                    if (status === google.maps.DirectionsStatus.OK) {
                        currentDirectionsRenderer.setDirections(result);
                    } else {
                        console.error("Nie udało się wyznaczyć trasy: " + status);
                    }
                });
            }

            updateRoute(userLocation);
            currentWatchId = navigator.geolocation.watchPosition(function (position) {
                var newLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                currentUserMarker.setPosition(newLocation);
                currentMap.setCenter(newLocation);
                updateRoute(newLocation);

                checkVisitedPoints(newLocation.lat, newLocation.lng);
            });
        }
        );
    } else {
        alert("Błąd geolokalizacji.");
    }
};
