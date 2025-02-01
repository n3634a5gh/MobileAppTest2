let currentMap = null;
let currentUserMarker = null;
let currentDirectionsRenderer = null;
let currentWatchId = null;
let currentIndex = 0;
let zoomLevel = 18;
let followUser = false;
let navigationMode = false;
let lastKnownLocation = null;

window.initializeMapWithLiveLocation = function (points, dotnetInstance) {
    var directionsService = new google.maps.DirectionsService();
    let visitedPoints = new Set();

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
        navigator.geolocation.getCurrentPosition(function (position) {
            lastKnownLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };

            var mapOptions = {
                mapTypeId: google.maps.MapTypeId.TERRAIN
            };

            currentMap = new google.maps.Map(document.getElementById('map'), mapOptions);
            currentDirectionsRenderer = new google.maps.DirectionsRenderer();
            currentDirectionsRenderer.setMap(currentMap);

            // Marker gracza
            currentUserMarker = new google.maps.Marker({
                position: lastKnownLocation,
                map: currentMap,
                title: "JA",
                icon: {
                    url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png"
                }
            });

            // Markery punktów trasy
            points.forEach(point => {
                new google.maps.Marker({
                    position: { lat: point.latitude, lng: point.longitude },
                    map: currentMap,
                    title: point.name
                });
            });

            // Funkcja do wyznaczania trasy
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

            updateRoute(lastKnownLocation);

            // Funkcja sprawdzająca, czy użytkownik znajduje się w pobliżu punktu i zaliczająca go
            function checkVisitedPoints(userLat, userLng) {
                if (currentIndex < points.length) {
                    const point = points[currentIndex];
                    const distance = getDistance(userLat, userLng, point.latitude, point.longitude);

                    if (distance <= 30) { // Jeśli użytkownik jest w promieniu 30m od punktu
                        if (!visitedPoints.has(currentIndex)) {
                            visitedPoints.add(currentIndex);
                            console.log(`Zaliczony: ${point.name}`);
                            dotnetInstance.invokeMethodAsync("MarkPointAsVisited", currentIndex);

                            if (navigator.onLine) {
                                /*getPlacePhoto(point.latitude, point.longitude)
                                    .then(photoUrl => {
                                        
                                    })
                                    .catch(err => {
                                        console.warn("Nie udało się pobrać zdjęcia:", err);
                                    });
                            } else {*/
                            }

                            currentIndex++;
                        }
                    }
                }
            }

            // Funkcja do obliczania odległości między dwoma punktami (Haversine formula)
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

            // Aktualizacja pozycji użytkownika w czasie rzeczywistym
            currentWatchId = navigator.geolocation.watchPosition(function (position) {
                lastKnownLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };

                // Przesunięcie markera użytkownika na nową pozycję
                currentUserMarker.setPosition(lastKnownLocation);

                updateRoute(lastKnownLocation);
                checkVisitedPoints(lastKnownLocation.lat, lastKnownLocation.lng);

                // Jeśli tryb nawigacji jest aktywny, przybliż mapę i śledź użytkownika
                if (navigationMode) {
                    if (currentUserMarker && currentUserMarker.getPosition()) {
                        currentMap.setCenter(currentUserMarker.getPosition());
                    }
                    currentMap.setZoom(18); // Duże przybliżenie na trasę
                    currentMap.setCenter(currentUserMarker.getPosition());
                }
            });

            // Obsługa ręcznego przesuwania mapy - zatrzymuje automatyczne śledzenie
            google.maps.event.addListener(currentMap, 'dragstart', function () {
                navigationMode = false;
            });

            // Przycisk "Tryb Nawigacji" - duże przybliżenie + śledzenie pozycji
            const navigationButton = document.createElement("button");
            navigationButton.textContent = "Tryb Nawigacji";
            navigationButton.classList.add("custom-map-control-button");
            navigationButton.onclick = function () {
                navigationMode = true;
                currentMap.setZoom(18); // Ustawienie dużego zoomu
                currentMap.setCenter(currentUserMarker.getPosition());
            };
            currentMap.controls[google.maps.ControlPosition.TOP_CENTER].push(navigationButton);
        });
    } else {
        alert("Błąd geolokalizacji.");
    }
};

function getPlacePhoto(lat, lng) {
    return new Promise((resolve, reject) => {
        const service = new google.maps.places.PlacesService(currentMap);
        const request = {
            location: new google.maps.LatLng(lat, lng),
            radius: 50,
            type: ['point_of_interest']
        };

        service.nearbySearch(request, function (results, status) {
            if (status === google.maps.places.PlacesServiceStatus.OK && results.length > 0) {
                const placeId = results[0].place_id;
                service.getDetails({ placeId: placeId }, function (place, status) {
                    if (status === google.maps.places.PlacesServiceStatus.OK && place.photos) {
                        resolve(place.photos[0].getUrl({ maxWidth: 400 }));
                    } else {
                        reject("Brak zdjęcia dla tego miejsca.");
                    }
                });
            } else {
                reject("Brak miejsc do znalezienia.");
            }
        });
    });
}
