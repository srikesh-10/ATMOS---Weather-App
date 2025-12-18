document.addEventListener('DOMContentLoaded', () => {
    const locationEl = document.getElementById('location');
    const dateEl = document.getElementById('date');
    const tempEl = document.getElementById('temperature');
    const conditionEl = document.getElementById('condition');
    const windEl = document.getElementById('wind');
    const elevationEl = document.getElementById('elevation');
    const iconEl = document.getElementById('weather-icon');
    const errorEl = document.getElementById('error-message');
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const localTimeEl = document.getElementById('local-time');
    const dayNightIconEl = document.getElementById('day-night-icon');

    let map, marker;
    let timeInterval;

    // Set Date
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateEl.textContent = new Date().toLocaleDateString('en-US', options);

    // Weather Codes Mapping (WMO)
    const weatherCodes = {
        0: { label: 'Clear Sky', day: '☀️', night: '🌙' },
        1: { label: 'Mainly Clear', day: '🌤️', night: '🌙' },
        2: { label: 'Partly Cloudy', day: '⛅', night: '☁️' },
        3: { label: 'Overcast', day: '☁️', night: '☁️' },
        45: { label: 'Fog', day: '🌫️', night: '🌫️' },
        48: { label: 'Depositing Rime Fog', day: '🌫️', night: '🌫️' },
        51: { label: 'Light Drizzle', day: '🌦️', night: '🌧️' },
        53: { label: 'Moderate Drizzle', day: '🌦️', night: '🌧️' },
        55: { label: 'Dense Drizzle', day: '🌧️', night: '🌧️' },
        61: { label: 'Slight Rain', day: '🌦️', night: '🌧️' },
        63: { label: 'Moderate Rain', day: '🌧️', night: '🌧️' },
        65: { label: 'Heavy Rain', day: '⛈️', night: '⛈️' },
        71: { label: 'Slight Snow', day: '🌨️', night: '🌨️' },
        73: { label: 'Moderate Snow', day: '🌨️', night: '🌨️' },
        75: { label: 'Heavy Snow', day: '❄️', night: '❄️' },
        80: { label: 'Slight Rain Showers', day: '🌦️', night: '🌧️' },
        81: { label: 'Moderate Rain Showers', day: '🌧️', night: '🌧️' },
        82: { label: 'Violent Rain Showers', day: '⛈️', night: '⛈️' },
        95: { label: 'Thunderstorm', day: '⚡', night: '⚡' },
        96: { label: 'Thunderstorm with Hail', day: '⛈️', night: '⛈️' },
        99: { label: 'Thunderstorm with Heavy Hail', day: '⛈️', night: '⛈️' }
    };

    function getWeather(lat, lon) {
        // Added timezone=auto to get the correct time for the location
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&elevation=nan&timezone=auto`;

        fetch(url)
            .then(response => {
                if (!response.ok) throw new Error('Weather data not available');
                return response.json();
            })
            .then(data => {
                updateUI(data);
                startClock(data.timezone);
            })
            .catch(error => {
                showError(error.message);
            });
    }

    function getCityName(lat, lon) {
        // Use Nominatim for reverse geocoding
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;

        fetch(url, {
            headers: {
                'User-Agent': 'WeatherApp/1.0' // Nominatim requires a User-Agent
            }
        })
            .then(response => response.json())
            .then(data => {
                const address = data.address;
                // Try to find the most relevant name: city, town, village, or suburb
                const city = address.city || address.town || address.village || address.suburb || address.county || "Unknown Location";
                locationEl.textContent = city;
                updateBackground(city);
            })
            .catch(err => {
                console.error("Geocoding error:", err);
                locationEl.textContent = "Unknown Location";
            });
    }

    function updateBackground(city) {
        if (!city || city === "Unknown Location") return;
        const width = window.innerWidth;
        const height = window.innerHeight;
        // Construct the image URL. Using polliniations.ai for dynamic generation
        const imageUrl = `https://image.pollinations.ai/prompt/scenic%20view%20skyline%20of%20${encodeURIComponent(city)}%20city%20landmark%20wallpaper?width=${width}&height=${height}&nologo=true`;

        // Preload image
        const img = new Image();
        img.src = imageUrl;
        img.onload = () => {
            document.body.style.backgroundImage = `url('${imageUrl}')`;
        };
    }

    function startClock(timezone) {
        if (timeInterval) clearInterval(timeInterval);

        const updateTime = () => {
            const now = new Date();
            const timeString = now.toLocaleTimeString('en-US', {
                timeZone: timezone,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });
            localTimeEl.textContent = timeString;
        };

        updateTime(); // Initial call
        timeInterval = setInterval(updateTime, 1000);
    }

    function initMap(lat, lon) {
        if (map) {
            map.setView([lat, lon], 13);
            marker.setLatLng([lat, lon]).bindPopup('Location').openPopup();
        } else {
            map = L.map('map').setView([lat, lon], 13);

            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                subdomains: 'abcd',
                maxZoom: 19
            }).addTo(map);

            marker = L.marker([lat, lon]).addTo(map)
                .bindPopup('You are here')
                .openPopup();

            // Fix for map rendering issues in some containers
            setTimeout(() => {
                map.invalidateSize();
            }, 100);
        }
    }

    function searchLocation(query) {
        if (!query.trim()) return;

        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;

        fetch(url)
            .then(res => res.json())
            .then(data => {
                if (data.results && data.results.length > 0) {
                    const result = data.results[0];
                    const { latitude, longitude, name, country } = result;

                    locationEl.textContent = `${name}${country ? ', ' + country : ''}`;

                    updateBackground(name); // Update background immediately with name
                    getWeather(latitude, longitude);
                    initMap(latitude, longitude);

                    errorEl.classList.add('hidden');
                } else {
                    alert('Location not found');
                }
            })
            .catch(err => {
                console.error('Search Error:', err);
                alert('An error occurred while searching.');
            });
    }

    searchBtn.addEventListener('click', () => searchLocation(searchInput.value));
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchLocation(searchInput.value);
    });

    function updateUI(data) {
        const current = data.current_weather;

        // Update Temp
        tempEl.textContent = `${Math.round(current.temperature)}°`;

        // Update Wind
        windEl.textContent = `${current.windspeed} km/h`;

        // Update Elevation
        // Open-Meteo returns elevation in the root object
        elevationEl.textContent = `${data.elevation} m`;

        // Update Condition & Icon
        const code = current.weathercode;
        const weatherInfo = weatherCodes[code] || { label: 'Unknown', day: '❓', night: '❓' };

        conditionEl.textContent = weatherInfo.label;

        // Determine Icon based on is_day
        const isDay = current.is_day === 1;
        const mainIcon = isDay ? weatherInfo.day : weatherInfo.night;
        iconEl.innerHTML = mainIcon;

        // Update Day/Night Icon
        // isDay is already defined above
        dayNightIconEl.textContent = isDay ? '☀️' : '🌙';
        dayNightIconEl.title = isDay ? 'Day' : 'Night';
    }

    function showError(message) {
        locationEl.textContent = "Error";
        conditionEl.textContent = "Offline";
        iconEl.innerHTML = "⚠️";
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
    }

    // Get Location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                getWeather(latitude, longitude);
                getCityName(latitude, longitude);
                initMap(latitude, longitude);
            },
            (error) => {
                showError("Location access denied. Please enable permissions.");
            }
        );
    } else {
        showError("Geolocation is not supported by this browser.");
    }
});
