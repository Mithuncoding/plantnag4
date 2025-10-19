import React, { useState, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import Card from '../components/Card';
import { PLANTS_DATABASE, PlantData, getPlantsByCategory, searchPlants, getSeasonalPlants } from '../data/plantsDatabase';

const EncyclopediaPage: React.FC = () => {
  const { translate } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPlant, setSelectedPlant] = useState<PlantData | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);

  const categories = [
    { id: 'all', name: 'All Plants', emoji: '🌍', color: 'bg-gradient-to-r from-green-400 to-emerald-500' },
    { id: 'vegetable', name: 'Vegetables', emoji: '🥬', color: 'bg-gradient-to-r from-green-500 to-lime-500' },
    { id: 'fruit', name: 'Fruits', emoji: '🍎', color: 'bg-gradient-to-r from-red-400 to-orange-400' },
    { id: 'flower', name: 'Flowers', emoji: '🌸', color: 'bg-gradient-to-r from-pink-400 to-purple-400' },
    { id: 'herb', name: 'Herbs', emoji: '🌿', color: 'bg-gradient-to-r from-emerald-500 to-teal-500' },
    { id: 'tree', name: 'Trees', emoji: '🌳', color: 'bg-gradient-to-r from-green-600 to-green-800' },
    { id: 'grain', name: 'Grains', emoji: '🌾', color: 'bg-gradient-to-r from-yellow-600 to-amber-600' },
  ];

  const filteredPlants = useMemo(() => {
    let plants = selectedCategory === 'all' ? PLANTS_DATABASE : getPlantsByCategory(selectedCategory);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 text-white py-12 px-4 shadow-2xl">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-4 flex items-center justify-center gap-4">
            <span className="text-6xl">🌱</span>
            Plant Encyclopedia
            <span className="text-6xl">📚</span>
          </h1>
          <p className="text-xl md:text-2xl opacity-95 max-w-3xl mx-auto">
            Discover Karnataka's Amazing Plant Kingdom! 🌿 Your Complete Growing Guide
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-4 text-lg">
            <span className="bg-white/20 px-4 py-2 rounded-full backdrop-blur">✨ {PLANTS_DATABASE.length}+ Plants</span>
            <span className="bg-white/20 px-4 py-2 rounded-full backdrop-blur">🎯 Growing Tips</span>
            <span className="bg-white/20 px-4 py-2 rounded-full backdrop-blur">🌍 Karnataka Specific</span>
            <span className="bg-white/20 px-4 py-2 rounded-full backdrop-blur">🧠 Fun Facts</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Search Bar */}
        <Card className="mb-6 bg-white/80 backdrop-blur shadow-xl">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 Search for any plant... (e.g., tomato, medicinal, Karnataka)"
                className="w-full px-6 py-4 text-lg border-2 border-green-300 rounded-xl focus:outline-none focus:ring-4 focus:ring-green-500/50 focus:border-green-500"
              />
            </div>
            <button
              onClick={() => setSearchQuery('')}
              className="px-6 py-4 bg-gradient-to-r from-red-500 to-pink-500 text-white font-bold rounded-xl hover:scale-105 transition-transform shadow-lg"
            >
              Clear ✖️
            </button>
          </div>
        </Card>

        {/* Categories */}
        <Card className="mb-6 bg-white/80 backdrop-blur">
          <h3 className="text-2xl font-bold text-green-700 mb-4">📂 Categories</h3>
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
              <span className="text-3xl">📅</span> Plant This Season!
            </h3>
            <p className="text-gray-700 mb-4">Perfect plants for current month in Karnataka:</p>
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
            {searchQuery ? `Search Results (${filteredPlants.length})` : `${categories.find(c => c.id === selectedCategory)?.name} (${filteredPlants.length})`}
          </h2>
          
          {filteredPlants.length === 0 ? (
            <Card className="text-center py-12 bg-gray-50">
              <p className="text-6xl mb-4">🔍</p>
              <p className="text-xl text-gray-600">No plants found. Try a different search!</p>
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
              >
                ✖️
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
                  <p className="font-bold text-yellow-800 mb-1 text-sm">💡 FUN FACT</p>
                  <p className="text-gray-700">{selectedPlant.funFact}</p>
                </div>
              </div>

              {/* Quick Info Grid */}
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <InfoBox icon="☀️" title="Sunlight" content={selectedPlant.sunlight} />
                <InfoBox icon="💧" title="Watering" content={selectedPlant.watering} />
                <InfoBox icon="🌡️" title="Temperature" content={selectedPlant.temperature} />
                <InfoBox icon="📏" title="Spacing" content={selectedPlant.spacing} />
                <InfoBox icon="⏱️" title="Harvest Time" content={selectedPlant.harvestTime} />
                <InfoBox icon="🌱" title="Propagation" content={selectedPlant.propagation.join(', ')} />
              </div>

              {/* Growing Details */}
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <DetailBox
                  icon="🏡"
                  title="Space Required"
                  items={[selectedPlant.spaceRequired]}
                  color="purple"
                />
                <DetailBox
                  icon="📅"
                  title="Growing Seasons"
                  items={selectedPlant.growingSeasons}
                  color="green"
                />
                <DetailBox
                  icon="🌍"
                  title="Karnataka Regions"
                  items={selectedPlant.karnatakaRegions}
                  color="blue"
                />
                <DetailBox
                  icon="🧪"
                  title="Fertilizer"
                  items={[selectedPlant.fertilizer]}
                  color="amber"
                />
              </div>

              {/* Companion Plants */}
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div className="bg-green-50 p-4 rounded-xl border-2 border-green-200">
                  <h4 className="font-bold text-green-700 mb-2 flex items-center gap-2">
                    <span className="text-xl">✅</span> Companion Plants
                  </h4>
                  <p className="text-sm text-gray-600 flex flex-wrap gap-1">
                    {selectedPlant.companionPlants.join(', ')}
                  </p>
                </div>
                <div className="bg-red-50 p-4 rounded-xl border-2 border-red-200">
                  <h4 className="font-bold text-red-700 mb-2 flex items-center gap-2">
                    <span className="text-xl">⛔</span> Avoid Planting With
                  </h4>
                  <p className="text-sm text-gray-600 flex flex-wrap gap-1">
                    {selectedPlant.avoidPlanting.join(', ')}
                  </p>
                </div>
              </div>

              {/* Pests & Diseases */}
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <DetailBox icon="🐛" title="Common Pests" items={selectedPlant.pests} color="orange" />
                <DetailBox icon="🦠" title="Diseases" items={selectedPlant.diseases} color="red" />
              </div>

              {/* Benefits & Uses */}
              <div className="mb-6">
                <DetailBox icon="💪" title="Benefits" items={selectedPlant.benefits} color="emerald" />
              </div>
              <div className="mb-6">
                <DetailBox icon="🍽️" title="Common Uses" items={selectedPlant.commonUses} color="indigo" />
              </div>

              {/* Additional Info */}
              {selectedPlant.nutritionalValue && (
                <InfoBox icon="🥗" title="Nutritional Value" content={selectedPlant.nutritionalValue} />
              )}
              {selectedPlant.medicinalUses && (
                <InfoBox icon="💊" title="Medicinal Uses" content={selectedPlant.medicinalUses} />
              )}
              {selectedPlant.culturalSignificance && (
                <div className="bg-gradient-to-r from-orange-100 to-pink-100 p-6 rounded-xl border-2 border-orange-300 mb-6">
                  <h4 className="font-bold text-orange-700 mb-2 flex items-center gap-2 text-lg">
                    <span className="text-2xl">🕉️</span> Cultural Significance
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
