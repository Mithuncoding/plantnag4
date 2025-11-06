import React, { useState, useMemo, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import Card from '../components/Card';
import { PLANTS_DATABASE, PlantData, getPlantsByCategory, searchPlants, getSeasonalPlants } from '../data/plantsDatabase';

// Offline Storage Service
const STORAGE_KEY = 'growsmart_encyclopedia_data';
const STORAGE_TIMESTAMP_KEY = 'growsmart_encyclopedia_timestamp';

const saveToOfflineStorage = (data: PlantData[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(STORAGE_TIMESTAMP_KEY, new Date().toISOString());
  } catch (error) {
    console.error('Failed to save offline data:', error);
  }
};

const loadFromOfflineStorage = (): { data: PlantData[] | null; timestamp: string | null } => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    const timestamp = localStorage.getItem(STORAGE_TIMESTAMP_KEY);
    return {
      data: data ? JSON.parse(data) : null,
      timestamp
    };
  } catch (error) {
    console.error('Failed to load offline data:', error);
    return { data: null, timestamp: null };
  }
};

const EncyclopediaPage: React.FC = () => {
  const { translate, language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPlant, setSelectedPlant] = useState<PlantData | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Save data to offline storage on component mount
  useEffect(() => {
    saveToOfflineStorage(PLANTS_DATABASE);
    const { timestamp } = loadFromOfflineStorage();
    setLastUpdated(timestamp);
  }, []);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      saveToOfflineStorage(PLANTS_DATABASE);
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Category translations
  const categories = [
    { 
      id: 'all', 
      name: translate('categoryAll'), 
      emoji: '🌍', 
      color: 'bg-gradient-to-r from-green-400 to-emerald-500' 
    },
    { 
      id: 'vegetable', 
      name: translate('categoryVegetables'), 
      emoji: '🥬', 
      color: 'bg-gradient-to-r from-green-500 to-lime-500' 
    },
    { 
      id: 'fruit', 
      name: translate('categoryFruits'), 
      emoji: '🍎', 
      color: 'bg-gradient-to-r from-red-400 to-orange-400' 
    },
    { 
      id: 'flower', 
      name: translate('categoryFlowers'), 
      emoji: '🌸', 
      color: 'bg-gradient-to-r from-pink-400 to-purple-400' 
    },
    { 
      id: 'herb', 
      name: translate('categoryHerbs'), 
      emoji: '🌿', 
      color: 'bg-gradient-to-r from-emerald-500 to-teal-500' 
    },
    { 
      id: 'tree', 
      name: translate('categoryTrees'), 
      emoji: '🌳', 
      color: 'bg-gradient-to-r from-green-600 to-green-800' 
    },
    { 
      id: 'grain', 
      name: translate('categoryGrains'), 
      emoji: '🌾', 
      color: 'bg-gradient-to-r from-yellow-600 to-amber-600' 
    },
  ];

  const filteredPlants = useMemo(() => {
    // Use offline data if available
    const { data: offlineData } = loadFromOfflineStorage();
    const dataSource = offlineData || PLANTS_DATABASE;
    
    let plants = selectedCategory === 'all' ? dataSource : getPlantsByCategory(selectedCategory);
    if (searchQuery.trim()) {
      plants = searchPlants(searchQuery);
    }
    return plants;
  }, [searchQuery, selectedCategory]);

  const seasonalPlants = getSeasonalPlants();

  const difficultyColors = {
    'Easy': 'bg-green-100 text-green-700 border-green-300',
    'Medium': 'bg-yellow-100 text-yellow-700 border-yellow-300',
    'Hard': 'bg-red-100 text-red-700 border-red-300',
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return translate('notAvailable');
    const date = new Date(dateString);
    return date.toLocaleDateString(language === 'kn' ? 'kn-IN' : 'en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 text-white py-12 px-4 shadow-2xl">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-4 flex items-center justify-center gap-4">
            <span className="text-6xl">🌱</span>
            {translate('encyclopediaTitle')}
            <span className="text-6xl">📚</span>
          </h1>
          <p className="text-xl md:text-2xl opacity-95 max-w-3xl mx-auto">
            {language === 'kn' 
              ? 'ಕರ್ನಾಟಕದ ಅದ್ಭುತ ಸಸ್ಯ ಸಾಮ್ರಾಜ್ಯವನ್ನು ಅನ್ವೇಷಿಸಿ! 🌿 ನಿಮ್ಮ ಸಂಪೂರ್ಣ ಬೆಳವಣಿಗೆ ಮಾರ್ಗದರ್ಶಿ'
              : "Discover Karnataka's Amazing Plant Kingdom! 🌿 Your Complete Growing Guide"
            }
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-4 text-lg">
            <span className="bg-white/20 px-4 py-2 rounded-full backdrop-blur">
              ✨ {PLANTS_DATABASE.length}+ {language === 'kn' ? 'ಸಸ್ಯಗಳು' : 'Plants'}
            </span>
            <span className="bg-white/20 px-4 py-2 rounded-full backdrop-blur">
              🎯 {language === 'kn' ? 'ಬೆಳೆಯುವ ಸಲಹೆಗಳು' : 'Growing Tips'}
            </span>
            <span className="bg-white/20 px-4 py-2 rounded-full backdrop-blur">
              🌍 {language === 'kn' ? 'ಕರ್ನಾಟಕ ನಿರ್ದಿಷ್ಟ' : 'Karnataka Specific'}
            </span>
            <span className="bg-white/20 px-4 py-2 rounded-full backdrop-blur">
              🧠 {language === 'kn' ? 'ಮಜೇದಾರ ಸಂಗತಿಗಳು' : 'Fun Facts'}
            </span>
            {!isOffline && (
              <span className="bg-green-400/30 px-4 py-2 rounded-full backdrop-blur border-2 border-green-300">
                {translate('offlineAvailable')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Offline Mode Banner */}
      {isOffline && (
        <div className="bg-amber-100 border-b-4 border-amber-500 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center gap-3">
            <span className="text-3xl">📴</span>
            <div className="flex-1">
              <p className="font-bold text-amber-800">{translate('offlineMode')}</p>
              <p className="text-sm text-amber-700">{translate('offlineModeDescription')}</p>
              {lastUpdated && (
                <p className="text-xs text-amber-600 mt-1">
                  {translate('dataLastUpdated').replace('{date}', formatDate(lastUpdated))}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Search Bar */}
        <Card className="mb-6 bg-white/80 backdrop-blur shadow-xl">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={translate('encyclopediaSearchPlaceholder')}
                className="w-full px-6 py-4 text-lg border-2 border-green-300 rounded-xl focus:outline-none focus:ring-4 focus:ring-green-500/50 focus:border-green-500"
              />
            </div>
            <button
              onClick={() => setSearchQuery('')}
              className="px-6 py-4 bg-gradient-to-r from-red-500 to-pink-500 text-white font-bold rounded-xl hover:scale-105 transition-transform shadow-lg"
            >
              {translate('clearSearch')}
            </button>
          </div>
        </Card>

        {/* Categories */}
        <Card className="mb-6 bg-white/80 backdrop-blur">
          <h3 className="text-2xl font-bold text-green-700 mb-4">{translate('categoriesTitle')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => { setSelectedCategory(cat.id); setSearchQuery(''); }}
                className={`${
                  selectedCategory === cat.id ? cat.color : 'bg-gray-100'
                } ${selectedCategory === cat.id ? 'text-white' : 'text-gray-700'} p-4 rounded-xl font-bold transition-all hover:scale-105 shadow-md flex flex-col items-center gap-2`}
              >
                <span className="text-4xl">{cat.emoji}</span>
                <span className="text-sm">{cat.name}</span>
              </button>
            ))}
          </div>
        </Card>

        {/* Seasonal Highlights */}
        {selectedCategory === 'all' && !searchQuery && (
          <Card className="mb-6 bg-gradient-to-r from-orange-100 to-yellow-100 border-2 border-orange-300">
            <h3 className="text-2xl font-bold text-orange-700 mb-3 flex items-center gap-2">
              <span className="text-3xl">📅</span> {translate('seasonalPlantsTitle')}
            </h3>
            <p className="text-gray-700 mb-4">{translate('seasonalPlantsDescription')}</p>
            <div className="flex flex-wrap gap-3">
              {seasonalPlants.slice(0, 6).map(plant => (
                <button
                  key={plant.id}
                  onClick={() => setSelectedPlant(plant)}
                  className="bg-white px-4 py-2 rounded-lg shadow-md hover:shadow-xl transition-all hover:scale-105 flex items-center gap-2"
                >
                  <span className="text-2xl">{plant.image}</span>
                  <span className="font-semibold text-green-700">{plant.name}</span>
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* Plant Grid */}
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-green-700 mb-4">
            {searchQuery 
              ? `${translate('searchResultsTitle')} (${filteredPlants.length})` 
              : `${categories.find(c => c.id === selectedCategory)?.name} (${filteredPlants.length})`
            }
          </h2>
          
          {filteredPlants.length === 0 ? (
            <Card className="text-center py-12 bg-gray-50">
              <p className="text-6xl mb-4">🔍</p>
              <p className="text-xl text-gray-600">{translate('noResultsFound')}</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredPlants.map(plant => (
                <Card
                  key={plant.id}
                  className="cursor-pointer hover:shadow-2xl transition-all hover:scale-105 bg-white overflow-hidden group"
                  onClick={() => setSelectedPlant(plant)}
                >
                  <div className="bg-gradient-to-br from-green-400 to-emerald-500 p-6 text-center">
                    <div className="text-7xl mb-2 transform group-hover:scale-110 transition-transform">{plant.image}</div>
                  </div>
                  <div className="p-4">
                    <h3 className="text-xl font-bold text-green-700 mb-1">{plant.name}</h3>
                    <p className="text-sm italic text-gray-500 mb-2">{plant.scientificName}</p>
                    <p className="text-sm text-gray-600 line-clamp-2 mb-3">{plant.description}</p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className={`text-xs px-2 py-1 rounded-full border ${difficultyColors[plant.difficulty]}`}>
                        {plant.difficulty}
                      </span>
                      <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-300">
                        {plant.category}
                      </span>
                    </div>
                    <div className="text-2xl">{plant.emojis}</div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Plant Detail Modal */}
      {selectedPlant && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setSelectedPlant(null)}>
          <div className="bg-white rounded-2xl max-w-4xl w-full my-8 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-8 relative">
              <button
                onClick={() => setSelectedPlant(null)}
                className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 rounded-full w-10 h-10 flex items-center justify-center text-2xl backdrop-blur"
                aria-label="Close"
              >
                {translate('plantDetailClose')}
              </button>
              <div className="flex items-center gap-6">
                <div className="text-8xl">{selectedPlant.image}</div>
                <div>
                  <h2 className="text-4xl font-bold mb-2">{selectedPlant.name}</h2>
                  <p className="text-xl italic opacity-90">{selectedPlant.scientificName}</p>
                  <div className="flex gap-2 mt-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${difficultyColors[selectedPlant.difficulty]} bg-white`}>
                      {selectedPlant.difficulty}
                    </span>
                    <span className="px-3 py-1 rounded-full text-sm font-bold bg-white text-green-700">
                      {selectedPlant.category}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-8 max-h-[70vh] overflow-y-auto">
              {/* Description & Fun Fact */}
              <div className="mb-6 bg-gradient-to-r from-blue-50 to-cyan-50 p-6 rounded-xl border-2 border-blue-200">
                <p className="text-lg text-gray-700 mb-4">{selectedPlant.description}</p>
                <div className="bg-yellow-100 border-l-4 border-yellow-500 p-4 rounded">
                  <p className="font-bold text-yellow-800 mb-1 text-sm">{translate('plantDetailFunFact')}</p>
                  <p className="text-gray-700">{selectedPlant.funFact}</p>
                </div>
              </div>

              {/* Quick Info Grid */}
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <InfoBox icon="☀️" title={translate('sunlight')} content={selectedPlant.sunlight} />
                <InfoBox icon="💧" title={translate('watering')} content={selectedPlant.watering} />
                <InfoBox icon="🌡️" title={translate('plantDetailTemperature')} content={selectedPlant.temperature} />
                <InfoBox icon="📏" title={translate('plantDetailSpacing')} content={selectedPlant.spacing} />
                <InfoBox icon="⏱️" title={translate('plantDetailHarvestTime')} content={selectedPlant.harvestTime} />
                <InfoBox icon="🌱" title={translate('plantDetailPropagation')} content={selectedPlant.propagation.join(', ')} />
              </div>

              {/* Growing Details */}
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <DetailBox
                  icon="🏡"
                  title={translate('plantDetailSpaceRequired')}
                  items={[selectedPlant.spaceRequired]}
                  color="purple"
                />
                <DetailBox
                  icon="📅"
                  title={translate('plantDetailGrowingSeasons')}
                  items={selectedPlant.growingSeasons}
                  color="green"
                />
                <DetailBox
                  icon="🌍"
                  title={translate('plantDetailKarnatakaRegions')}
                  items={selectedPlant.karnatakaRegions}
                  color="blue"
                />
                <DetailBox
                  icon="🧪"
                  title={translate('plantDetailFertilizer')}
                  items={[selectedPlant.fertilizer]}
                  color="amber"
                />
              </div>

              {/* Companion Plants */}
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div className="bg-green-50 p-4 rounded-xl border-2 border-green-200">
                  <h4 className="font-bold text-green-700 mb-2 flex items-center gap-2">
                    <span className="text-xl">✅</span> {translate('plantDetailCompanionPlants')}
                  </h4>
                  <p className="text-sm text-gray-600 flex flex-wrap gap-1">
                    {selectedPlant.companionPlants.join(', ')}
                  </p>
                </div>
                <div className="bg-red-50 p-4 rounded-xl border-2 border-red-200">
                  <h4 className="font-bold text-red-700 mb-2 flex items-center gap-2">
                    <span className="text-xl">⛔</span> {translate('plantDetailAvoidPlanting')}
                  </h4>
                  <p className="text-sm text-gray-600 flex flex-wrap gap-1">
                    {selectedPlant.avoidPlanting.join(', ')}
                  </p>
                </div>
              </div>

              {/* Pests & Diseases */}
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <DetailBox icon="🐛" title={translate('plantDetailPests')} items={selectedPlant.pests} color="orange" />
                <DetailBox icon="🦠" title={translate('plantDetailDiseases')} items={selectedPlant.diseases} color="red" />
              </div>

              {/* Benefits & Uses */}
              <div className="mb-6">
                <DetailBox icon="💪" title={translate('plantDetailBenefits')} items={selectedPlant.benefits} color="emerald" />
              </div>
              <div className="mb-6">
                <DetailBox icon="🍽️" title={translate('plantDetailCommonUses')} items={selectedPlant.commonUses} color="indigo" />
              </div>

              {/* Additional Info */}
              {selectedPlant.nutritionalValue && (
                <InfoBox icon="🥗" title={translate('plantDetailNutritionalValue')} content={selectedPlant.nutritionalValue} />
              )}
              {selectedPlant.medicinalUses && (
                <InfoBox icon="💊" title={translate('plantDetailMedicinalUses')} content={selectedPlant.medicinalUses} />
              )}
              {selectedPlant.culturalSignificance && (
                <div className="bg-gradient-to-r from-orange-100 to-pink-100 p-6 rounded-xl border-2 border-orange-300 mb-6">
                  <h4 className="font-bold text-orange-700 mb-2 flex items-center gap-2 text-lg">
                    <span className="text-2xl">🕉️</span> {translate('plantDetailCulturalSignificance')}
                  </h4>
                  <p className="text-gray-700">{selectedPlant.culturalSignificance}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper Components
const InfoBox: React.FC<{ icon: string; title: string; content: string }> = ({ icon, title, content }) => (
  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
    <h4 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
      <span className="text-xl">{icon}</span> {title}
    </h4>
    <p className="text-sm text-gray-600">{content}</p>
  </div>
);

const DetailBox: React.FC<{ icon: string; title: string; items: string[]; color: string }> = ({ icon, title, items, color }) => {
  const colors: Record<string, string> = {
    green: 'bg-green-50 border-green-200 text-green-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
  };
  
  return (
    <div className={`${colors[color]} p-4 rounded-xl border-2`}>
      <h4 className={`font-bold mb-2 flex items-center gap-2`}>
        <span className="text-xl">{icon}</span> {title}
      </h4>
      <ul className="text-sm space-y-1">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-start gap-1">
            <span>•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default EncyclopediaPage;
