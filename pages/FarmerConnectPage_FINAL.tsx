import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Alert from '../components/Alert';
import Card from '../components/Card';

// Using OpenStreetMap with Leaflet as backup (free, no API key needed)
// But we'll keep Google-like interface for better UX

const searchCategories = [
  { id: 'markets', icon: '🛒', query: 'market' },
  { id: 'fertilizers', icon: '🧪', query: 'fertilizer' },
  { id: 'nurseries', icon: '🌱', query: 'nursery' },
  { id: 'equipment', icon: '🚜', query: 'tractor' },
  { id: 'cold_storage', icon: '❄️', query: 'cold storage' },
  { id: 'veterinary', icon: '🐄', query: 'veterinary' },
  { id: 'agri_consultants', icon: '👨‍🌾', query: 'agricultural consultant' },
  { id: 'soil_testing', icon: '🧬', query: 'soil testing' },
  { id: 'warehousing', icon: '🏬', query: 'warehouse' },
];

const MAP_CONFIG = {
  defaultZoom: 13,
  searchRadius: 10, // 10km
  defaultLocation: { lat: 12.9716, lng: 77.5946 }, // Bangalore
};

interface Place {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  distance?: string;
  category?: string;
}

const FarmerConnectPage: React.FC = () => {
  const { translate, language } = useLanguage();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState(MAP_CONFIG.defaultLocation);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [customSearch, setCustomSearch] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [mapStyle, setMapStyle] = useState<'standard' | 'satellite'>('standard');

  // Load Leaflet library
  const loadLeaflet = useCallback(async () => {
    if ((window as any).L) return;

    // Load Leaflet CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    // Load Leaflet JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    await new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });

    // Fix marker icons
    const L = (window as any).L;
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
  }, []);

  // Initialize map
  const initializeMap = useCallback(async (location: { lat: number; lng: number }) => {
    if (!mapRef.current) return;

    try {
      await loadLeaflet();
      const L = (window as any).L;

      // Create map
      const map = L.map(mapRef.current, {
        center: [location.lat, location.lng],
        zoom: MAP_CONFIG.defaultZoom,
        zoomControl: true,
      });

      // Add tile layer based on style
      const tileUrl = mapStyle === 'satellite'
        ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

      const attribution = mapStyle === 'satellite'
        ? '&copy; Esri'
        : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

      L.tileLayer(tileUrl, {
        attribution: attribution,
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;

      // Add user marker with custom icon
      const userIcon = L.divIcon({
        className: 'custom-user-marker',
        html: `
          <div style="position: relative; width: 50px; height: 50px;">
            <div style="position: absolute; width: 50px; height: 50px; background: rgba(59, 130, 246, 0.2); border-radius: 50%; animation: pulse-animation 2s infinite;"></div>
            <div style="position: absolute; left: 15px; top: 15px; width: 20px; height: 20px; background: #3b82f6; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 10px rgba(0,0,0,0.5);"></div>
          </div>
          <style>
            @keyframes pulse-animation {
              0%, 100% { transform: scale(1); opacity: 1; }
              50% { transform: scale(1.5); opacity: 0.3; }
            }
          </style>
        `,
        iconSize: [50, 50],
        iconAnchor: [25, 25],
      });

      userMarkerRef.current = L.marker([location.lat, location.lng], { icon: userIcon })
        .addTo(map)
        .bindPopup(`<div style="text-align: center; font-weight: bold;"><span style="font-size: 24px;">📍</span><br/>${translate('yourLocation')}</div>`);

      setIsLoading(false);
    } catch (err) {
      console.error('Map initialization error:', err);
      setError(translate('fcErrorNoGoogleMaps'));
      setIsLoading(false);
    }
  }, [loadLeaflet, mapStyle, translate]);

  // Get user location
  useEffect(() => {
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
  }, [initializeMap, translate]);

  // Search places using Nominatim (OpenStreetMap)
  const searchPlaces = useCallback(async (query: string, categoryId?: string) => {
    if (!mapInstanceRef.current) {
      setError(translate('fcErrorLocation'));
      return;
    }

    setIsSearching(true);
    setError(null);
    setResults([]);
    clearMarkers();
    clearRoute();

    try {
      // Use Overpass API for better POI search
      const overpassQuery = `
        [out:json][timeout:25];
        (
          node["name"~"${query}",i](around:${MAP_CONFIG.searchRadius * 1000},${currentLocation.lat},${currentLocation.lng});
          way["name"~"${query}",i](around:${MAP_CONFIG.searchRadius * 1000},${currentLocation.lat},${currentLocation.lng});
          relation["name"~"${query}",i](around:${MAP_CONFIG.searchRadius * 1000},${currentLocation.lat},${currentLocation.lng});
        );
        out center;
      `;

      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: overpassQuery,
      });

      const data = await response.json();

      if (data.elements && data.elements.length > 0) {
        const places: Place[] = data.elements.slice(0, 20).map((element: any, index: number) => {
          const lat = element.lat || element.center?.lat;
          const lng = element.lon || element.center?.lon;
          const distance = calculateDistance(currentLocation.lat, currentLocation.lng, lat, lng);

          return {
            id: element.id?.toString() || `place-${index}`,
            name: element.tags?.name || `${query} ${index + 1}`,
            address: formatAddress(element.tags),
            lat,
            lng,
            distance: `${distance.toFixed(1)} km`,
            category: categoryId,
          };
        }).filter((p: Place) => p.lat && p.lng);

        if (places.length > 0) {
          setResults(places);
          displayMarkers(places, categoryId);
        } else {
          const categoryName = categoryId 
            ? translate(`fcCategory${categoryId.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}`)
            : query;
          setError(translate('fcNoResults', { serviceName: categoryName }));
        }
      } else {
        const categoryName = categoryId 
          ? translate(`fcCategory${categoryId.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}`)
          : query;
        setError(translate('fcNoResults', { serviceName: categoryName }));
      }
    } catch (err) {
      console.error('Search error:', err);
      setError(`${translate('error')}: ${err}`);
    } finally {
      setIsSearching(false);
    }
  }, [currentLocation, translate]);

  // Calculate distance
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Format address
  const formatAddress = (tags: any): string => {
    if (!tags) return translate('addressNotAvailable');
    const parts = [];
    if (tags.addr_street) parts.push(tags.addr_street);
    if (tags.addr_city) parts.push(tags.addr_city);
    if (tags.addr_state) parts.push(tags.addr_state);
    return parts.length > 0 ? parts.join(', ') : tags.addr_full || translate('addressNotAvailable');
  };

  // Display markers
  const displayMarkers = (places: Place[], categoryId?: string) => {
    if (!mapInstanceRef.current) return;

    const L = (window as any).L;
    const bounds = L.latLngBounds([[currentLocation.lat, currentLocation.lng]]);

    const category = searchCategories.find(c => c.id === categoryId);
    const icon = category?.icon || '📍';

    places.forEach((place, index) => {
      const markerIcon = L.divIcon({
        className: 'custom-marker',
        html: `
          <div style="
            position: relative;
            background: white;
            border: 3px solid #10B981;
            border-radius: 50%;
            width: 45px;
            height: 45px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            cursor: pointer;
            transition: all 0.3s;
          " onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">
            ${icon}
          </div>
        `,
        iconSize: [45, 45],
        iconAnchor: [22.5, 22.5],
      });

      const marker = L.marker([place.lat, place.lng], { icon: markerIcon }).addTo(mapInstanceRef.current);

      const popupContent = `
        <div style="padding: 12px; min-width: 250px; font-family: system-ui;">
          <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: bold; color: #059669;">${place.name}</h3>
          <p style="margin: 4px 0; font-size: 13px; color: #666;">📍 ${place.address}</p>
          <p style="margin: 8px 0; font-size: 14px; font-weight: 600; color: #10B981;">🚗 ${place.distance}</p>
          <button 
            onclick="window.getDirections(${index})"
            style="
              margin-top: 12px;
              padding: 10px 20px;
              background: linear-gradient(135deg, #10B981, #059669);
              color: white;
              border: none;
              border-radius: 8px;
              cursor: pointer;
              font-weight: 700;
              font-size: 14px;
              width: 100%;
              box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3);
              transition: all 0.3s;
            "
            onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 12px rgba(16, 185, 129, 0.4)'"
            onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 6px rgba(16, 185, 129, 0.3)'"
          >
            🗺️ ${translate('fcGetDirections')}
          </button>
        </div>
      `;

      marker.bindPopup(popupContent, { maxWidth: 300 });
      markersRef.current.push(marker);
      bounds.extend([place.lat, place.lng]);
    });

    mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
  };

  // Get directions
  const getDirections = useCallback(async (index: number) => {
    const place = results[index];
    if (!place || !mapInstanceRef.current) return;

    const L = (window as any).L;
    setSelectedPlace(place);

    try {
      // Use OSRM for routing
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${currentLocation.lng},${currentLocation.lat};${place.lng},${place.lat}?overview=full&geometries=geojson`
      );

      const data = await response.json();

      if (data.routes && data.routes[0]) {
        const route = data.routes[0];
        const coordinates = route.geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]);

        // Clear previous route
        if (routeLayerRef.current) {
          mapInstanceRef.current.removeLayer(routeLayerRef.current);
        }

        // Draw route
        routeLayerRef.current = L.polyline(coordinates, {
          color: '#10B981',
          weight: 6,
          opacity: 0.8,
        }).addTo(mapInstanceRef.current);

        // Fit bounds to route
        mapInstanceRef.current.fitBounds(routeLayerRef.current.getBounds(), { padding: [50, 50] });

        // Set route info
        const distance = (route.distance / 1000).toFixed(1);
        const duration = Math.round(route.duration / 60);
        setRouteInfo({
          distance: `${distance} km`,
          duration: `${duration} ${language === 'kn' ? 'ನಿಮಿಷಗಳು' : 'minutes'}`,
        });
      }
    } catch (err) {
      console.error('Routing error:', err);
      setError(translate('fcErrorRouteNotFound'));
    }
  }, [results, currentLocation, mapInstanceRef, language, translate]);

  // Expose getDirections to window
  useEffect(() => {
    (window as any).getDirections = getDirections;
    return () => {
      delete (window as any).getDirections;
    };
  }, [getDirections]);

  // Clear markers
  const clearMarkers = () => {
    markersRef.current.forEach(marker => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(marker);
      }
    });
    markersRef.current = [];
    setSelectedPlace(null);
  };

  // Clear route
  const clearRoute = () => {
    if (routeLayerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }
    setRouteInfo(null);
  };

  // Change map style
  const changeMapStyle = (style: 'standard' | 'satellite') => {
    setMapStyle(style);
    if (mapInstanceRef.current) {
      const L = (window as any).L;
      
      // Remove all tile layers
      mapInstanceRef.current.eachLayer((layer: any) => {
        if (layer instanceof L.TileLayer) {
          mapInstanceRef.current.removeLayer(layer);
        }
      });

      // Add new tile layer
      const tileUrl = style === 'satellite'
        ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

      const attribution = style === 'satellite'
        ? '&copy; Esri'
        : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

      L.tileLayer(tileUrl, {
        attribution: attribution,
        maxZoom: 19,
      }).addTo(mapInstanceRef.current);
    }
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
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-4xl font-bold text-green-700 mb-2 flex items-center gap-3">
          <span className="text-5xl">🗺️</span>
          {translate('farmerConnectTitle')}
        </h2>
        <p className="text-gray-600 text-lg">
          {translate('farmerConnectDescription')}
        </p>
      </div>

      {error && (
        <Alert type="error" message={error} onClose={() => setError(null)} />
      )}

      {/* Custom Search */}
      <Card className="mb-4 bg-gradient-to-r from-green-50 to-emerald-50">
        <div className="flex gap-2 flex-col sm:flex-row">
          <input
            type="text"
            value={customSearch}
            onChange={(e) => setCustomSearch(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCustomSearch()}
            placeholder={translate('fcCustomSearchPlaceholder')}
            className="flex-1 px-4 py-3 border-2 border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-base"
          />
          <button
            onClick={handleCustomSearch}
            disabled={isSearching}
            className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-base shadow-lg transition-all transform hover:scale-105"
          >
            {isSearching ? '⏳ ' + translate('loading') : '🔍 ' + translate('search')}
          </button>
        </div>
      </Card>

      {/* Category Buttons */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-700 mb-3">
          {language === 'kn' ? 'ವರ್ಗಗಳು' : 'Categories'}:
        </h3>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-9 gap-3">
          {searchCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => handleCategoryClick(category.id)}
              disabled={isSearching}
              className={`p-4 rounded-xl border-3 transition-all duration-300 transform ${
                selectedCategory === category.id
                  ? 'bg-gradient-to-br from-green-600 to-emerald-600 border-green-600 text-white shadow-2xl scale-110'
                  : 'bg-white border-gray-300 hover:border-green-500 hover:shadow-xl hover:scale-105'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <div className="text-3xl mb-2">{category.icon}</div>
              <div className="text-xs font-bold">
                {translate(`fcCategory${category.id.split('_').map(word => 
                  word.charAt(0).toUpperCase() + word.slice(1)
                ).join('')}`)}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Map Style Switcher */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => changeMapStyle('standard')}
          className={`px-4 py-2 rounded-lg font-semibold transition-all ${
            mapStyle === 'standard'
              ? 'bg-green-600 text-white shadow-lg'
              : 'bg-white border-2 border-gray-300 hover:border-green-500'
          }`}
        >
          🗺️ {language === 'kn' ? 'ಸಾಮಾನ್ಯ' : 'Standard'}
        </button>
        <button
          onClick={() => changeMapStyle('satellite')}
          className={`px-4 py-2 rounded-lg font-semibold transition-all ${
            mapStyle === 'satellite'
              ? 'bg-green-600 text-white shadow-lg'
              : 'bg-white border-2 border-gray-300 hover:border-green-500'
          }`}
        >
          🛰️ {language === 'kn' ? 'ಉಪಗ್ರಹ' : 'Satellite'}
        </button>
      </div>

      {/* Route Info */}
      {routeInfo && (
        <Card className="mb-4 bg-gradient-to-r from-green-100 to-emerald-100 border-3 border-green-400">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex flex-wrap gap-6">
              <span className="font-bold text-green-800 text-lg">
                🚗 {translate('fcDistance')}: <span className="text-2xl">{routeInfo.distance}</span>
              </span>
              <span className="font-bold text-green-800 text-lg">
                ⏱️ {translate('fcDuration')}: <span className="text-2xl">{routeInfo.duration}</span>
              </span>
            </div>
            <button
              onClick={clearRoute}
              className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 font-bold shadow-lg transform hover:scale-105 transition-all"
            >
              ❌ {translate('fcClearRoute')}
            </button>
          </div>
        </Card>
      )}

      {/* Map */}
      <div className="relative mb-4">
        {isLoading && (
          <div className="absolute inset-0 bg-white bg-opacity-95 flex items-center justify-center z-50 rounded-2xl backdrop-blur-sm">
            <LoadingSpinner text={translate('fcMapInitializing')} />
          </div>
        )}
        <div
          ref={mapRef}
          className="w-full h-[650px] rounded-2xl shadow-2xl border-4 border-green-300"
        />
        {!isLoading && (
          <div className="absolute top-4 right-4 bg-white px-4 py-2 rounded-lg shadow-lg border-2 border-green-300 z-10">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📍</span>
              <span className="font-semibold text-sm text-gray-700">
                {language === 'kn' ? 'ನಿಮ್ಮ ಸ್ಥಳ' : 'Your Location'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Results Count */}
      {results.length > 0 && (
        <div className="mt-4 p-4 bg-gradient-to-r from-green-100 to-emerald-100 rounded-xl shadow-md border-2 border-green-300">
          <div className="text-center">
            <span className="text-gray-700 font-semibold text-lg">
              {translate('fcShowingResultsFor', { 
                serviceName: selectedCategory 
                  ? translate(`fcCategory${selectedCategory.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}`)
                  : customSearch 
              })}
            </span>
            <span className="font-bold text-green-700 text-2xl ml-2">
              {results.length} {language === 'kn' ? 'ಫಲಿತಾಂಶಗಳು' : 'results'}
            </span>
          </div>
        </div>
      )}

      {isSearching && (
        <div className="mt-4 flex justify-center">
          <div className="bg-white p-6 rounded-xl shadow-xl">
            <LoadingSpinner text={translate('fcSearchingServices', { serviceName: '' })} />
          </div>
        </div>
      )}
    </div>
  );
};

export default FarmerConnectPage;
