import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Alert from '../components/Alert';
import Card from '../components/Card';

// Google Maps API Key
const GOOGLE_MAPS_API_KEY = 'AIzaSyD5ZG9hqKY1-pqN_T4_B3X_f11MFeghLUI';

// Search categories for agricultural services
const searchCategories = [
  { id: 'markets', icon: '🛒', query: 'agricultural market farmers market produce market' },
  { id: 'fertilizers', icon: '🧪', query: 'fertilizer shop agricultural supplies pesticide shop' },
  { id: 'nurseries', icon: '🌱', query: 'plant nursery garden center' },
  { id: 'equipment', icon: '🚜', query: 'agricultural equipment tractor dealer farm machinery' },
  { id: 'cold_storage', icon: '❄️', query: 'cold storage refrigerated warehouse' },
  { id: 'veterinary', icon: '🐄', query: 'veterinary clinic animal hospital' },
  { id: 'agri_consultants', icon: '👨‍🌾', query: 'agricultural consultant farm advisor' },
  { id: 'soil_testing', icon: '🧬', query: 'soil testing laboratory' },
  { id: 'warehousing', icon: '🏬', query: 'warehouse storage facility' },
];

const MAP_CONFIG = {
  defaultZoom: 13,
  searchRadius: 10000, // 10km
  defaultLocation: { lat: 12.9716, lng: 77.5946 }, // Bangalore
};

interface PlaceResult {
  place_id: string;
  name: string;
  formatted_address?: string;
  geometry?: {
    location: google.maps.LatLng;
  };
  rating?: number;
  user_ratings_total?: number;
  opening_hours?: {
    open_now?: boolean;
  };
}

const FarmerConnectPage: React.FC = () => {
  const { translate, language } = useLanguage();
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState(MAP_CONFIG.defaultLocation);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [customSearch, setCustomSearch] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Load Google Maps Script
  const loadGoogleMapsScript = useCallback(() => {
    return new Promise<void>((resolve, reject) => {
      if (window.google && window.google.maps) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&language=${language === 'kn' ? 'kn' : 'en'}`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        setMapLoaded(true);
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load Google Maps'));
      document.head.appendChild(script);
    });
  }, [language]);

  // Initialize map
  const initializeMap = useCallback(async (location: { lat: number; lng: number }) => {
    if (!mapRef.current || !window.google?.maps) return;

    try {
      const map = new google.maps.Map(mapRef.current, {
        center: location,
        zoom: MAP_CONFIG.defaultZoom,
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true,
        zoomControl: true,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }],
          },
        ],
      });

      googleMapRef.current = map;

      // Create user marker
      const userMarker = new google.maps.Marker({
        position: location,
        map: map,
        title: translate('yourLocation'),
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: '#4285F4',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 3,
          scale: 10,
        },
        animation: google.maps.Animation.DROP,
      });

      userMarkerRef.current = userMarker;

      // Initialize directions renderer
      directionsRendererRef.current = new google.maps.DirectionsRenderer({
        map: map,
        suppressMarkers: false,
        polylineOptions: {
          strokeColor: '#10B981',
          strokeWeight: 6,
          strokeOpacity: 0.8,
        },
      });

      // Initialize info window
      infoWindowRef.current = new google.maps.InfoWindow();

      setIsLoading(false);
    } catch (err) {
      console.error('Map initialization error:', err);
      setError(translate('fcErrorNoGoogleMaps'));
      setIsLoading(false);
    }
  }, [translate]);

  // Get user location and initialize
  useEffect(() => {
    const initMap = async () => {
      try {
        await loadGoogleMapsScript();

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const userLoc = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              };
              setCurrentLocation(userLoc);
              initializeMap(userLoc);
            },
            (error) => {
              console.warn('Geolocation error:', error);
              setError(translate('fcErrorLocation'));
              initializeMap(MAP_CONFIG.defaultLocation);
            }
          );
        } else {
          initializeMap(MAP_CONFIG.defaultLocation);
        }
      } catch (err) {
        console.error('Failed to load map:', err);
        setError(translate('fcErrorNoGoogleMaps'));
        setIsLoading(false);
      }
    };

    initMap();
  }, [loadGoogleMapsScript, initializeMap, translate]);

  // Search for places
  const searchPlaces = useCallback((query: string, categoryId?: string) => {
    if (!googleMapRef.current || !window.google?.maps) {
      setError(translate('fcErrorNoGoogleMaps'));
      return;
    }

    setIsSearching(true);
    setError(null);
    setResults([]);
    clearMarkers();
    clearRoute();

    const service = new google.maps.places.PlacesService(googleMapRef.current);

    const request: google.maps.places.TextSearchRequest = {
      query: query,
      location: currentLocation,
      radius: MAP_CONFIG.searchRadius,
      language: language === 'kn' ? 'kn' : 'en',
      region: 'IN',
    };

    service.textSearch(request, (results, status) => {
      setIsSearching(false);

      if (status === google.maps.places.PlacesServiceStatus.OK && results) {
        setResults(results as PlaceResult[]);
        displayMarkers(results as PlaceResult[], categoryId);
      } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
        const categoryName = categoryId ? translate(`fcCategory${categoryId.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}`) : query;
        setError(translate('fcNoResults', { serviceName: categoryName }));
      } else {
        setError(`${translate('error')}: ${status}`);
      }
    });
  }, [googleMapRef, currentLocation, language, translate]);

  // Display markers
  const displayMarkers = (places: PlaceResult[], categoryId?: string) => {
    if (!googleMapRef.current) return;

    const bounds = new google.maps.LatLngBounds();
    bounds.extend(currentLocation);

    const category = searchCategories.find(c => c.id === categoryId);
    const icon = category?.icon || '📍';

    places.forEach((place) => {
      if (!place.geometry?.location) return;

      const marker = new google.maps.Marker({
        position: place.geometry.location,
        map: googleMapRef.current,
        title: place.name,
        animation: google.maps.Animation.DROP,
        label: {
          text: icon,
          fontSize: '18px',
        },
      });

      marker.addListener('click', () => {
        showPlaceInfo(place, marker);
      });

      markersRef.current.push(marker);
      bounds.extend(place.geometry.location);
    });

    if (places.length > 0) {
      googleMapRef.current.fitBounds(bounds);
    }
  };

  // Show place info
  const showPlaceInfo = (place: PlaceResult, marker: google.maps.Marker) => {
    if (!infoWindowRef.current) return;

    const rating = place.rating
      ? `⭐ ${place.rating.toFixed(1)} (${place.user_ratings_total || 0} ${translate('reviews')})`
      : `${translate('rating')}: ${translate('notAvailable')}`;

    const openStatus = place.opening_hours?.open_now !== undefined
      ? place.opening_hours.open_now
        ? '🟢 Open Now'
        : '🔴 Closed'
      : '';

    const content = `
      <div style="padding: 12px; max-width: 300px; font-family: system-ui;">
        <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: bold; color: #059669;">${place.name}</h3>
        <p style="margin: 4px 0; font-size: 13px; color: #666;">${place.formatted_address || translate('addressNotAvailable')}</p>
        <p style="margin: 8px 0 4px 0; font-size: 13px;">${rating}</p>
        ${openStatus ? `<p style="margin: 4px 0; font-size: 13px;">${openStatus}</p>` : ''}
        <button 
          onclick="window.getDirectionsToPlace('${place.place_id}')"
          style="
            margin-top: 12px;
            padding: 8px 16px;
            background: #10B981;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            font-size: 13px;
            width: 100%;
          "
          onmouseover="this.style.background='#059669'"
          onmouseout="this.style.background='#10B981'"
        >
          🗺️ ${translate('fcGetDirections')}
        </button>
      </div>
    `;

    infoWindowRef.current.setContent(content);
    infoWindowRef.current.open(googleMapRef.current, marker);
  };

  // Get directions
  const getDirections = useCallback((placeId: string) => {
    const place = results.find(p => p.place_id === placeId);
    if (!place?.geometry?.location || !directionsRendererRef.current) return;

    const directionsService = new google.maps.DirectionsService();

    directionsService.route(
      {
        origin: currentLocation,
        destination: place.geometry.location,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          directionsRendererRef.current?.setDirections(result);

          const route = result.routes[0];
          if (route?.legs[0]) {
            setRouteInfo({
              distance: route.legs[0].distance?.text || 'N/A',
              duration: route.legs[0].duration?.text || 'N/A',
            });
          }
        } else {
          setError(translate('fcErrorRouteNotFound'));
        }
      }
    );
  }, [results, currentLocation, translate]);

  // Expose getDirections to window for info window button
  useEffect(() => {
    (window as any).getDirectionsToPlace = getDirections;
    return () => {
      delete (window as any).getDirectionsToPlace;
    };
  }, [getDirections]);

  // Clear markers
  const clearMarkers = () => {
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];
    infoWindowRef.current?.close();
  };

  // Clear route
  const clearRoute = () => {
    directionsRendererRef.current?.setDirections({ routes: [] } as any);
    setRouteInfo(null);
  };

  // Handle category click
  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategory(categoryId);
    const category = searchCategories.find(c => c.id === categoryId);
    if (category) {
      searchPlaces(category.query, categoryId);
    }
  };

  // Handle custom search
  const handleCustomSearch = () => {
    if (!customSearch.trim()) {
      setError(translate('fcErrorCustomSearchEmpty'));
      return;
    }
    setSelectedCategory(null);
    searchPlaces(customSearch);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-green-700 mb-2">
          {translate('farmerConnectTitle')}
        </h2>
        <p className="text-gray-600">
          {translate('farmerConnectDescription')}
        </p>
      </div>

      {error && (
        <Alert type="error" message={error} onClose={() => setError(null)} />
      )}

      {/* Custom Search */}
      <Card className="mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={customSearch}
            onChange={(e) => setCustomSearch(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCustomSearch()}
            placeholder={translate('fcCustomSearchPlaceholder')}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            onClick={handleCustomSearch}
            disabled={isSearching || !mapLoaded}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors"
          >
            {isSearching ? translate('loading') : translate('search')}
          </button>
        </div>
      </Card>

      {/* Category Buttons */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-9 gap-2 mb-4">
        {searchCategories.map((category) => (
          <button
            key={category.id}
            onClick={() => handleCategoryClick(category.id)}
            disabled={isSearching || !mapLoaded}
            className={`p-3 rounded-lg border-2 transition-all duration-200 ${
              selectedCategory === category.id
                ? 'bg-green-600 border-green-600 text-white shadow-lg scale-105'
                : 'bg-white border-gray-300 hover:border-green-500 hover:shadow-md'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <div className="text-2xl mb-1">{category.icon}</div>
            <div className="text-xs font-medium">
              {translate(`fcCategory${category.id.split('_').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1)
              ).join('')}`)}
            </div>
          </button>
        ))}
      </div>

      {/* Route Info */}
      {routeInfo && (
        <Card className="mb-4 bg-green-50 border-green-300">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex flex-wrap gap-4">
              <span className="font-semibold text-green-800">
                🚗 {translate('fcDistance')}: {routeInfo.distance}
              </span>
              <span className="font-semibold text-green-800">
                ⏱️ {translate('fcDuration')}: {routeInfo.duration}
              </span>
            </div>
            <button
              onClick={clearRoute}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-semibold text-sm transition-colors"
            >
              {translate('fcClearRoute')}
            </button>
          </div>
        </Card>
      )}

      {/* Map */}
      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-10 rounded-lg">
            <LoadingSpinner text={translate('fcMapInitializing')} />
          </div>
        )}
        <div
          ref={mapRef}
          className="w-full h-[600px] rounded-lg shadow-xl border-4 border-green-200"
        />
      </div>

      {/* Results Count */}
      {results.length > 0 && (
        <div className="mt-4 text-center">
          <span className="text-gray-600">
            {translate('fcShowingResultsFor', { 
              serviceName: selectedCategory 
                ? translate(`fcCategory${selectedCategory.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}`)
                : customSearch 
            })}
          </span>
          <span className="font-bold text-green-700 ml-2">
            {results.length} {language === 'kn' ? 'ಫಲಿತಾಂಶಗಳು' : 'results'}
          </span>
        </div>
      )}

      {isSearching && (
        <div className="mt-4 flex justify-center">
          <LoadingSpinner text={translate('fcSearchingServices', { serviceName: '' })} />
        </div>
      )}
    </div>
  );
};

export default FarmerConnectPage;
