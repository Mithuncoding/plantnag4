import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { MapSearchCategory } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import Alert from '../components/Alert';
import Card from '../components/Card';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const initialSearchCategories: MapSearchCategory[] = [
  { id: 'markets', translationKey: 'fcCategoryMarkets', defaultText: 'Markets', textQuery: 'marketplace' },
  { id: 'fertilizers', translationKey: 'fcCategoryFertilizers', defaultText: 'Fertilizer Shops', textQuery: 'doityourself' },
  { id: 'nurseries', translationKey: 'fcCategoryNurseries', defaultText: 'Plant Nurseries', textQuery: 'garden_centre' },
  { id: 'equipment', translationKey: 'fcCategoryEquipment', defaultText: 'Agri Equipment', textQuery: 'hardware' },
  { id: 'veterinary', translationKey: 'fcCategoryVeterinary', defaultText: 'Veterinary Services', textQuery: 'veterinary' },
  { id: 'hospital', translationKey: 'fcCategoryHospital', defaultText: 'Hospitals', textQuery: 'hospital' },
  { id: 'pharmacy', translationKey: 'fcCategoryPharmacy', defaultText: 'Pharmacies', textQuery: 'pharmacy' },
  { id: 'school', translationKey: 'fcCategorySchool', defaultText: 'Schools', textQuery: 'school' },
  { id: 'bank', translationKey: 'fcCategoryBank', defaultText: 'Banks', textQuery: 'bank' },
];

const MAP_DEFAULT_ZOOM = 13;
const MAP_DEFAULT_LOCATION = { lat: 12.9716, lng: 77.5946 }; // Bangalore

const categoryIcons: Record<string, string> = {
  markets: '🛒',
  fertilizers: '🧪',
  nurseries: '🌱',
  equipment: '🚜',
  veterinary: '🐄',
  hospital: '🏥',
  pharmacy: '💊',
  school: '🏫',
  bank: '🏦',
};

interface SearchResult {
  name: string;
  address: string;
  coordinates: [number, number];
  distance?: string;
  category?: string;
}

const FarmerConnectPage: React.FC = () => {
  const { translate } = useLanguage();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const userMarkerRef = useRef<L.Marker | null>(null);

  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number}>(MAP_DEFAULT_LOCATION);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<MapSearchCategory | null>(null);
  const [customSearchQuery, setCustomSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [mapStyle, setMapStyle] = useState<'standard' | 'satellite'>('standard');

  // Initialize map once
  useEffect(() => {
    let isMounted = true;

    const setupMap = async () => {
      // Clean up any existing map
      if (map.current) {
        map.current.remove();
        map.current = null;
      }

      if (!mapContainer.current) return;

      try {
        // Get user location
        if (navigator.geolocation && isMounted) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              if (isMounted) {
                const userLoc = { lat: position.coords.latitude, lng: position.coords.longitude };
                setCurrentLocation(userLoc);
                initializeMap(userLoc);
              }
            },
            (error) => {
              console.warn('Geolocation error:', error);
              if (isMounted) {
                setError('Could not get your location. Using Bangalore as default.');
                initializeMap(MAP_DEFAULT_LOCATION);
              }
            }
          );
        } else if (isMounted) {
          setError('Geolocation not supported');
          initializeMap(MAP_DEFAULT_LOCATION);
        }
      } catch (err) {
        console.error('Setup error:', err);
        if (isMounted) {
          setError('Failed to setup map');
          setIsLoading(false);
        }
      }
    };

    setupMap();

    // Cleanup on unmount
    return () => {
      isMounted = false;
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  const initializeMap = (location: {lat: number, lng: number}) => {
    if (!mapContainer.current || map.current) return;

    try {
      // Create map with OpenStreetMap (FREE!)
      const mapInstance = L.map(mapContainer.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView([location.lat, location.lng], MAP_DEFAULT_ZOOM);

      // Add tile layer based on style
      const tileUrl = mapStyle === 'satellite' 
        ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      
      const attribution = mapStyle === 'satellite'
        ? 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
        : '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

      L.tileLayer(tileUrl, {
        attribution: attribution,
        maxZoom: 19,
      }).addTo(mapInstance);

      map.current = mapInstance;

      // Add user location marker with pulse animation
      const userIcon = L.divIcon({
        className: 'custom-user-marker',
        html: `
          <div style="position: relative;">
            <div style="position: absolute; width: 40px; height: 40px; background-color: rgba(59, 130, 246, 0.3); border-radius: 50%; animation: pulse 2s infinite;"></div>
            <div style="position: absolute; width: 20px; height: 20px; margin: 10px; background-color: #3b82f6; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>
          </div>
          <style>
            @keyframes pulse {
              0% { transform: scale(0.5); opacity: 1; }
              100% { transform: scale(1.5); opacity: 0; }
            }
          </style>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      const userMarker = L.marker([location.lat, location.lng], { icon: userIcon })
        .addTo(mapInstance)
        .bindPopup('<div style="text-align: center; font-weight: bold;"><span style="font-size: 20px;">📍</span><br/>You are here!</div>');

      userMarkerRef.current = userMarker;
      setIsLoading(false);
    } catch (err) {
      console.error('Map initialization error:', err);
      setError('Failed to initialize map. Please refresh the page.');
      setIsLoading(false);
    }
  };

  // Change map style
  const changeMapStyle = (style: 'standard' | 'satellite') => {
    setMapStyle(style);
    if (map.current) {
      // Remove old layer and add new one
      map.current.eachLayer((layer) => {
        if (layer instanceof L.TileLayer) {
          map.current!.removeLayer(layer);
        }
      });

      const tileUrl = style === 'satellite' 
        ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      
      const attribution = style === 'satellite'
        ? 'Tiles &copy; Esri'
        : '© OpenStreetMap contributors';

      L.tileLayer(tileUrl, {
        attribution: attribution,
        maxZoom: 19,
      }).addTo(map.current);

      // Re-add user marker
      if (userMarkerRef.current) {
        userMarkerRef.current.addTo(map.current);
      }

      // Re-add search markers
      markersRef.current.forEach(marker => marker.addTo(map.current!));
    }
  };

  const clearMarkers = () => {
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
  };

  const performSearch = async (query: string, categoryName: string) => {
    if (!map.current) return;

    setLoadingSearch(true);
    setError(null);
    clearMarkers();
    setResults([]);

    try {
      // Use Overpass API for better POI search (FREE OpenStreetMap data!)
      // This searches for actual places/amenities in the area
      const radius = 10000; // 10km radius
      const overpassQuery = `
        [out:json][timeout:25];
        (
          node["shop"="${query}"](around:${radius},${currentLocation.lat},${currentLocation.lng});
          node["amenity"="${query}"](around:${radius},${currentLocation.lat},${currentLocation.lng});
          node["name"~"${query}",i](around:${radius},${currentLocation.lat},${currentLocation.lng});
          way["shop"="${query}"](around:${radius},${currentLocation.lat},${currentLocation.lng});
          way["amenity"="${query}"](around:${radius},${currentLocation.lat},${currentLocation.lng});
        );
        out center;
      `;

      const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;
      
      let response = await fetch(overpassUrl);
      let data = await response.json();

      // If Overpass fails or returns no results, fallback to Nominatim
      if (!data.elements || data.elements.length === 0) {
        console.log('Overpass found nothing, trying Nominatim...');
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&bounded=1&viewbox=${currentLocation.lng-0.5},${currentLocation.lat-0.5},${currentLocation.lng+0.5},${currentLocation.lat+0.5}&limit=20`;
        
        response = await fetch(nominatimUrl, {
          headers: {
            'User-Agent': 'PlantCareAI/1.0'
          }
        });
        
        data = await response.json();
        
        // Convert Nominatim format to Overpass-like format
        if (data && data.length > 0) {
          data = {
            elements: data.map((place: any) => ({
              type: 'node',
              id: place.place_id,
              lat: parseFloat(place.lat),
              lon: parseFloat(place.lon),
              tags: {
                name: place.display_name.split(',')[0],
                full_address: place.display_name
              }
            }))
          };
        }
      }

      if (data.elements && data.elements.length > 0) {
        const searchResults: SearchResult[] = data.elements
          .filter((element: any) => {
            const lat = element.lat || (element.center && element.center.lat);
            const lon = element.lon || (element.center && element.center.lon);
            if (!lat || !lon) return false;
            
            const distance = calculateDistance(currentLocation.lat, currentLocation.lng, lat, lon);
            return distance <= 50; // Within 50km
          })
          .map((element: any) => {
            const lat = element.lat || (element.center && element.center.lat);
            const lon = element.lon || (element.center && element.center.lon);
            const distance = calculateDistance(currentLocation.lat, currentLocation.lng, lat, lon);
            
            const name = element.tags?.name || element.tags?.full_address?.split(',')[0] || `${categoryName} Location`;
            const address = element.tags?.full_address || 
                          [element.tags?.['addr:street'], element.tags?.['addr:city']].filter(Boolean).join(', ') ||
                          `Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}`;
            
            return {
              name: name,
              address: address,
              coordinates: [lon, lat] as [number, number],
              distance: `${distance.toFixed(2)} km`,
              category: categoryName
            };
          })
          .sort((a: SearchResult, b: SearchResult) => parseFloat(a.distance!) - parseFloat(b.distance!))
          .slice(0, 15); // Top 15 closest

        if (searchResults.length === 0) {
          setError(`No ${categoryName} found within 50km. Try searching in a bigger city or different area.`);
        } else {
          setResults(searchResults);
          
          // Add markers
          searchResults.forEach((result, index) => {
            const customIcon = L.divIcon({
              className: 'custom-marker',
              html: `<div style="background-color: #10b981; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3); cursor: pointer;">${index + 1}</div>`,
              iconSize: [30, 30],
              iconAnchor: [15, 15],
            });

            const marker = L.marker([result.coordinates[1], result.coordinates[0]], { icon: customIcon })
              .addTo(map.current!)
              .bindPopup(`
                <div style="padding: 10px; min-width: 200px;">
                  <h3 style="font-weight: bold; color: #16a34a; margin-bottom: 5px;">${result.name}</h3>
                  <p style="font-size: 12px; color: #6b7280; margin-bottom: 5px;">${result.address}</p>
                  <p style="font-size: 12px; color: #2563eb; font-weight: 600;">📍 ${result.distance}</p>
                </div>
              `);

            markersRef.current.push(marker);
          });

          // Fit bounds to show all results
          const bounds = L.latLngBounds([
            [currentLocation.lat, currentLocation.lng],
            ...searchResults.map(r => [r.coordinates[1], r.coordinates[0]] as [number, number])
          ]);
          map.current.fitBounds(bounds, { padding: [50, 50] });
        }
      } else {
        setError(`No results found for ${categoryName}. Try:\n• Using custom search with city name (e.g., "nursery Bangalore")\n• Searching in a different area\n• Trying a different category`);
      }
    } catch (err: any) {
      console.error('Search error:', err);
      setError(`Search failed: ${err.message || 'Please try again'}`);
    } finally {
      setLoadingSearch(false);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleCategoryClick = (category: MapSearchCategory) => {
    setSelectedCategory(category);
    // Use the category query directly for Overpass API
    performSearch(
      category.textQuery,
      translate(category.translationKey, { default: category.defaultText })
    );
  };

  const handleCustomSearch = () => {
    if (customSearchQuery.trim()) {
      performSearch(customSearchQuery, 'Custom Search');
    }
  };

  const panToResult = (result: SearchResult) => {
    if (map.current) {
      map.current.flyTo([result.coordinates[1], result.coordinates[0]], 15, { duration: 1.5 });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 p-4">
      <div className="max-w-7xl mx-auto">
        <Card className="mb-6 bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 text-white border-none shadow-2xl">
          <h1 className="text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3">
            <span className="text-5xl">🗺️</span>
            {translate('fcTitle', { default: 'Farmer Connect - Find Services' })}
          </h1>
          <p className="text-lg opacity-90">
            {translate('fcDescription', { default: 'Discover services near you - 100% FREE using OpenStreetMap!' })}
          </p>
          <p className="text-sm mt-2 bg-white/20 inline-block px-3 py-1 rounded-full">
            ✨ No API keys • No costs • Open source mapping!
          </p>
        </Card>

        {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

        {/* Map Style Selector */}
        <Card className="mb-4">
          <h3 className="font-semibold text-green-700 mb-3 flex items-center gap-2">
            <span className="text-2xl">🎨</span> Map View
          </h3>
          <div className="flex gap-3">
            <button
              onClick={() => changeMapStyle('standard')}
              className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-all ${
                mapStyle === 'standard'
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg transform scale-105'
                  : 'bg-white text-gray-700 hover:bg-green-50 border-2 border-gray-300'
              }`}
            >
              <div className="text-2xl mb-1">🗺️</div>
              Street Map
            </button>
            <button
              onClick={() => changeMapStyle('satellite')}
              className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-all ${
                mapStyle === 'satellite'
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg transform scale-105'
                  : 'bg-white text-gray-700 hover:bg-blue-50 border-2 border-gray-300'
              }`}
            >
              <div className="text-2xl mb-1">🛰️</div>
              Satellite View
            </button>
          </div>
        </Card>

        <Card className="mb-4">
          <h3 className="font-semibold text-green-700 mb-3 text-lg">
            {translate('fcSearchCategories', { default: 'Search Categories' })}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {initialSearchCategories.map(category => (
              <button
                key={category.id}
                onClick={() => handleCategoryClick(category)}
                disabled={loadingSearch}
                className={`flex flex-col items-center p-4 rounded-xl transition-all shadow-md hover:shadow-xl ${
                  selectedCategory?.id === category.id
                    ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white transform scale-105'
                    : 'bg-white hover:bg-green-50 text-gray-700'
                }`}
              >
                <span className="text-3xl mb-2">{categoryIcons[category.id]}</span>
                <span className="text-sm font-medium text-center">
                  {translate(category.translationKey, { default: category.defaultText })}
                </span>
              </button>
            ))}
          </div>
        </Card>

        <Card className="mb-4">
          <h3 className="font-semibold text-green-700 mb-3 flex items-center gap-2">
            <span className="text-2xl">🔍</span>
            {translate('fcCustomSearch', { default: 'Custom Search' })}
          </h3>
          <div className="flex flex-col md:flex-row gap-3">
            <input
              type="text"
              value={customSearchQuery}
              onChange={(e) => setCustomSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCustomSearch()}
              placeholder={translate('fcSearchPlaceholder', { default: 'Search for any service... (e.g., hospital, market, school)' })}
              className="flex-1 px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-4 focus:ring-green-500/50 focus:border-green-500"
            />
            <button
              onClick={handleCustomSearch}
              disabled={loadingSearch || !customSearchQuery.trim()}
              className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {loadingSearch ? '🔄 Searching...' : '🔍 Search'}
            </button>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Card className="p-0 overflow-hidden shadow-2xl">
              <div ref={mapContainer} className="w-full h-[500px] lg:h-[600px] relative">
                {isLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50 z-10">
                    <div className="text-6xl mb-4 animate-bounce">🗺️</div>
                    <LoadingSpinner text="Loading FREE OpenStreetMap..." size="lg" />
                    <p className="text-sm text-gray-600 mt-4">Getting your location...</p>
                  </div>
                )}
              </div>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card>
              <h3 className="font-bold text-green-700 text-xl mb-4">
                {translate('fcResults', { default: 'Search Results' })} ({results.length})
              </h3>
              
              {loadingSearch && (
                <div className="flex justify-center py-8">
                  <LoadingSpinner text="Searching..." />
                </div>
              )}

              {!loadingSearch && results.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-4xl mb-2">🔍</p>
                  <p>{translate('fcSelectCategory', { default: 'Select a category or search to find services' })}</p>
                </div>
              )}

              <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
                {results.map((result, index) => (
                  <div
                    key={index}
                    onClick={() => panToResult(result)}
                    className="group p-4 bg-gradient-to-r from-white to-green-50 rounded-xl border-2 border-green-200 hover:border-green-400 hover:shadow-xl transition-all cursor-pointer transform hover:-translate-y-1"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-lg group-hover:scale-110 transition-transform">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-green-700 text-lg group-hover:text-green-800">{result.name}</h4>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{result.address}</p>
                        {result.distance && (
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-bold flex items-center gap-1">
                              <span>📍</span>
                              {result.distance} away
                            </span>
                            {result.category && (
                              <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">
                                {result.category}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="text-2xl opacity-0 group-hover:opacity-100 transition-opacity">
                        🔍
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Custom CSS for scrollbar */}
              <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                  width: 8px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                  background: #f1f1f1;
                  border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                  background: #10b981;
                  border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                  background: #059669;
                }
              `}</style>
            </Card>
          </div>
        </div>

        <Card className="mt-6 bg-gradient-to-r from-blue-50 via-cyan-50 to-teal-50 border-2 border-blue-200 shadow-xl">
          <div className="flex items-start gap-4">
            <span className="text-5xl">💡</span>
            <div className="flex-1">
              <h3 className="font-bold text-blue-700 mb-3 text-xl">
                {translate('fcHowToUse', { default: 'How to Use Farmer Connect' })}
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-blue-600 mb-2">🎯 Features:</h4>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>✅ Click categories to find services instantly</li>
                    <li>✅ Use custom search for specific places</li>
                    <li>✅ Toggle between Street & Satellite view</li>
                    <li>✅ Click markers or results to zoom in</li>
                    <li>✅ See distance from your location</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-green-600 mb-2">🌟 Why It's Great:</h4>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>💰 <strong>100% FREE Forever!</strong></li>
                    <li>🔓 No API keys or limits</li>
                    <li>🗺️ Powered by OpenStreetMap community</li>
                    <li>🌍 Global coverage, local data</li>
                    <li>🚀 Fast, reliable, open source</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default FarmerConnectPage;
