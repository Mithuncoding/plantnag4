import React, { useState, useCallback, useRef, useEffect } from 'react';
import ImageUploader from '../components/ImageUploader';
import LoadingSpinner from '../components/LoadingSpinner';
import Card from '../components/Card';
import Alert from '../components/Alert';
import { PlantDiagnosis, ScanResult } from '../types';
import { diagnosePlant } from '../services/geminiService';
import { addScanResult } from '../services/localStorageService';
import { useLanguage } from '../contexts/LanguageContext';
import { MdMic, MdMicOff } from 'react-icons/md';
import { PLANT_LIST } from '../constants';
import { FaSearch } from 'react-icons/fa';
import RelatedYouTubeVideo from '../components/RelatedYouTubeVideo';
import { getCachedTranslation, isTextInExpectedScript } from '../utils/googleTranslate';

// Add supported languages for translation (expanded)
const TRANSLATE_LANGS = [
  { code: 'kn', label: 'Kannada', tts: 'kn-IN', voiceName: 'kn-IN-Chirp3-HD-Achird' },
  { code: 'hi', label: 'Hindi', tts: 'hi-IN', voiceName: 'hi-IN-Wavenet-A' },
  { code: 'ta', label: 'Tamil', tts: 'ta-IN', voiceName: 'ta-IN-Wavenet-A' },
  { code: 'te', label: 'Telugu', tts: 'te-IN', voiceName: 'te-IN-Standard-A' },
  { code: 'bn', label: 'Bengali', tts: 'bn-IN', voiceName: 'bn-IN-Standard-A' },
  { code: 'mr', label: 'Marathi', tts: 'mr-IN', voiceName: 'mr-IN-Standard-A' },
  { code: 'gu', label: 'Gujarati', tts: 'gu-IN', voiceName: 'gu-IN-Standard-A' },
  { code: 'ml', label: 'Malayalam', tts: 'ml-IN', voiceName: 'ml-IN-Standard-A' },
  { code: 'pa', label: 'Punjabi', tts: 'pa-IN', voiceName: 'pa-IN-Standard-A' },
  { code: 'ur', label: 'Urdu', tts: 'ur-IN', voiceName: 'ur-IN-Standard-A' },
  { code: 'or', label: 'Oriya', tts: 'or-IN', voiceName: 'or-IN-Standard-A' },
];

const PlantScanPage: React.FC = () => {
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [diagnosis, setDiagnosis] = useState<PlantDiagnosis | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState<string>("");
  const { translate} = useLanguage();
  const [detectedLang, setDetectedLang] = useState<string>('en');
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [rawSTTText, setRawSTTText] = useState<string>("");
  const [aiCorrectedText, setAICorrectedText] = useState<string>("");
  const [sttLangDisplay, setSTTLangDisplay] = useState<string>("");
  const [selectedLang, setSelectedLang] = useState('en-US');
  const [speakActive, setSpeakActive] = useState<'question' | 'answer' | null>(null);
  const [aiPromptActive, setAIPromptActive] = useState(false);
  const [plantSearch, setPlantSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All Plants');
  const [selectedPlant, setSelectedPlant] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Ref for SpeechRecognition instance
  const recognitionRef = useRef<any>(null);

  // TTS controls
  const [ttsUtterance, setTtsUtterance] = useState<SpeechSynthesisUtterance | null>(null);
  const [ttsPaused, setTtsPaused] = useState(false);
  const [ttsSpeaking, setTtsSpeaking] = useState(false);
  const [translateTarget, setTranslateTarget] = useState('en');
  const [translatedAnswer, setTranslatedAnswer] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedScriptOk, setTranslatedScriptOk] = useState(true);

  // --- Plant Picker Logic ---
  const mainCategories = [
    { name: 'All Plants', emoji: '🪴' },
    { name: 'Cereals & Millets', emoji: '🌾' },
    { name: 'Pulses', emoji: '🫘' },
    { name: 'Vegetables', emoji: '🥦' },
    { name: 'Fruits', emoji: '🍎' },
    { name: 'Spices', emoji: '🌶️' },
    { name: 'Commercial Crops', emoji: '🏭' },
    { name: 'Ornamental Plants', emoji: '🌸' },
    { name: 'Medicinal Plants', emoji: '🌿' },
    { name: 'Trees', emoji: '🌳' },
    { name: 'Unknown Plant', emoji: '🔍' },
  ];

  // Reset selectedPlant when category changes (except for 'Unknown Plant')
  useEffect(() => {
    if (activeCategory === 'Unknown Plant') {
      setSelectedPlant('Unknown Plant');
      setCustomPrompt('');
    } else {
      setSelectedPlant(null);
      setCustomPrompt('');
    }
  }, [activeCategory]);

  const getCategoryForPlant = (plant: { name: string; emoji: string; category: string }) => {
    if (mainCategories.some(cat => cat.name === plant.category)) return plant.category;
    return 'All Plants';
  };

  const PLANTS_PER_PAGE = 60;
  useEffect(() => { setCurrentPage(1); }, [activeCategory, plantSearch]);
  const filteredPlants = PLANT_LIST.filter(p =>
    (activeCategory === 'All Plants' || (activeCategory === 'Unknown Plant' ? false : getCategoryForPlant(p) === activeCategory)) &&
    (!plantSearch || p.name.toLowerCase().includes(plantSearch.toLowerCase()))
  );
  const totalPages = Math.ceil(filteredPlants.length / PLANTS_PER_PAGE);
  const paginatedPlants = filteredPlants.slice((currentPage - 1) * PLANTS_PER_PAGE, currentPage * PLANTS_PER_PAGE);

  const handleImageUpload = useCallback((base64: string, file: File) => {
    setImageBase64(base64);
    setImageFile(file);
    setDiagnosis(null); 
    setError(null);
  }, []);

  const handleScanPlant = async () => {
    if (!imageBase64 || !imageFile) {
      setError(translate('errorPleaseUploadImage'));
      return;
    }
    setIsLoading(true);
    setError(null);
    setDiagnosis(null);

    let promptToSend = customPrompt;
    if (activeCategory === 'Unknown Plant') {
      promptToSend = `
        Identify the plant or leaf in this image. Respond ONLY in JSON format with keys: 
        "plantName", "plantEmoji", "plantConfidencePercent", "condition", "statusTag", 
        "diseaseName", "careSuggestions" (array of strings), "confidenceLevel".
        Be as specific as possible and only guess if you are reasonably sure.
        If you are not sure, say "Unknown" for plantName and set plantConfidencePercent to 0.
      `;
    }

    const result = await diagnosePlant(imageBase64, imageFile.type, promptToSend);
    
    if (result.error && !result.condition) { // Prioritize error if no condition is present
      setError(result.error);
      setDiagnosis(null);
    } else if (result.statusTag === "Unknown" && result.condition === "Unknown") {
      setError(translate('errorNotAPlant'));
      // Still set diagnosis to show "Unknown" etc.
      setDiagnosis(result);
    }
    else {
      setDiagnosis(result);
      if (!result.error) { // Only save to history if not an AI-side error within the result
        const scanEntry: ScanResult = {
          id: new Date().toISOString(),
          timestamp: Date.now(),
          imagePreviewUrl: imageBase64,
          diagnosis: result,
          originalPrompt: customPrompt || translate('defaultDiagnosisPrompt'),
        };
        addScanResult(scanEntry);
      }
    }
    setIsLoading(false);
  };
  
  const defaultPromptTextForPlaceholder = `You are a plant health expert... Respond ONLY in JSON format with keys: "condition", "statusTag", "diseaseName", "careSuggestions" (array of strings), "confidenceLevel".`;

  let diagnosisTextForTTS = "";
  if (diagnosis) {
    let ttsParts = [];
    if(diagnosis.condition) ttsParts.push(`${translate('condition')}: ${translate(diagnosis.statusTag ? 'status' + diagnosis.statusTag.charAt(0).toUpperCase() + diagnosis.statusTag.slice(1) : diagnosis.condition)}.`);
    if(diagnosis.diseaseName && diagnosis.diseaseName !== "N/A") ttsParts.push(`${translate('diseaseIssue')}: ${diagnosis.diseaseName}.`);
    if(diagnosis.careSuggestions && Array.isArray(diagnosis.careSuggestions) && diagnosis.careSuggestions.length > 0) {
        ttsParts.push(`${translate('careSuggestions')}: ${diagnosis.careSuggestions.join('. ')}`);
    } else if (typeof diagnosis.careSuggestions === 'string' && diagnosis.careSuggestions !== "N/A") {
        ttsParts.push(`${translate('careSuggestions')}: ${diagnosis.careSuggestions}`);
    }
    diagnosisTextForTTS = ttsParts.join(' ');
  }
  
  const getStatusTagColor = (statusTag?: PlantDiagnosis['statusTag']) => {
    switch (statusTag) {
      case 'Healthy': return 'bg-green-500 text-white';
      case 'Diseased': return 'bg-red-500 text-white';
      case 'NeedsAttention': return 'bg-yellow-500 text-black';
      case 'Unknown': return 'bg-gray-400 text-white';
      default: return 'bg-gray-200 text-gray-700';
    }
  };
  
  const getStatusTagText = (statusTag?: PlantDiagnosis['statusTag']) => {
    if (!statusTag) return diagnosis?.condition || translate('statusUnknown');
    switch (statusTag) {
        case 'Healthy': return translate('statusHealthy');
        case 'Diseased': return translate('statusDiseased');
        case 'NeedsAttention': return translate('statusNeedsAttention');
        case 'Unknown': return translate('statusUnknown');
        default: return diagnosis?.condition || translate('statusUnknown');
    }
  }

  // --- Speech-to-Text (STT) using browser SpeechRecognition ---
  const handleToggleRecording = async () => {
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      setError('Speech recognition is not supported in this browser.');
      return;
    }
    if (isRecording) {
      setIsRecording(false);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      return;
    }
    setIsRecording(true);
    setError(null);
    setRawSTTText("");
    setAICorrectedText("");
    setCustomPrompt("");
    const recognition = new SpeechRecognitionClass();
    recognitionRef.current = recognition;
    recognition.lang = selectedLang || 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setCustomPrompt(transcript);
      setRawSTTText(transcript);
      setAICorrectedText("");
      setSTTLangDisplay(selectedLang);
      setIsRecording(false);
    };
    recognition.onerror = (event: any) => {
      setError('Speech recognition failed: ' + event.error);
      setIsRecording(false);
    };
    recognition.onend = () => {
      setIsRecording(false);
    };
    recognition.start();
  };

  // TTS controls
  const pauseTTS = () => {
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
      setTtsPaused(true);
    }
  };
  const resumeTTS = () => {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setTtsPaused(false);
    }
  };
  const stopTTS = () => {
    window.speechSynthesis.cancel();
    setTtsPaused(false);
    setTtsSpeaking(false);
    setTtsUtterance(null);
  };

  // Modified TTS function to use state
  const speakWithCloudTTS = async (text: string, lang: string, which: 'question' | 'answer', voiceName?: string) => {
    if (!text) return;
    setSpeakActive(which);
    if (!('speechSynthesis' in window) && !voiceName) {
      setSpeakActive(null);
      setError('Text-to-speech is not supported in this browser.');
      return;
    }
    stopTTS();
    // Use backend TTS if voiceName is provided
    if (voiceName) {
      try {
        const res = await fetch('/api/speak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, languageCode: lang, voiceName })
        });
        const data = await res.json();
        if (data.audioContent) {
          const audio = new Audio('data:audio/mp3;base64,' + data.audioContent);
          audio.onended = () => setSpeakActive(null);
          audio.play();
        } else {
          setSpeakActive(null);
        }
      } catch {
        setSpeakActive(null);
      }
      return;
    }
    // Fallback to browser TTS if no voiceName
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.lang = lang || 'en-US';
    utterance.onend = () => {
      setSpeakActive(null);
      setTtsSpeaking(false);
      setTtsPaused(false);
      setTtsUtterance(null);
    };
    utterance.onerror = () => {
      setSpeakActive(null);
      setTtsSpeaking(false);
      setTtsPaused(false);
      setTtsUtterance(null);
    };
    setTtsUtterance(utterance);
    setTtsSpeaking(true);
    setTtsPaused(false);
    window.speechSynthesis.speak(utterance);
  };

  // Translation function using Google Translate
  const translateText = async (text: string, target: string) => {
    setIsTranslating(true);
    setTranslatedAnswer('');
    setTranslatedScriptOk(true);
    try {
      const { translated, scriptOk } = await getCachedTranslation(text, target);
      setTranslatedAnswer(translated);
      setTranslatedScriptOk(scriptOk);
      if (!scriptOk) {
        // Don't set error - just show warning. Translation might still be useful
        console.warn('Translation script validation warning - text may contain mixed content');
      } else {
        setError(null);
      }
    } catch (e) {
      setError('Translation failed. Showing original text.');
      setTranslatedAnswer(text); // Fallback to original text
    }
    setIsTranslating(false);
  };

  // AI Prompt for sentence correction
  const handleAICorrectPrompt = async () => {
    if (!rawSTTText) return;
    setAIPromptActive(true);
    try {
      const aiRes = await diagnosePlant('', '', rawSTTText + '\nRewrite the above as a clear, grammatically correct, natural sentence in the same language. If the text is a question, make it a polite, complete question. Do not translate. Do not add extra information.');
      if (aiRes && aiRes.condition) {
        setCustomPrompt(aiRes.condition);
        setAICorrectedText(aiRes.condition);
      } else if (aiRes && aiRes.diseaseName) {
        setCustomPrompt(aiRes.diseaseName);
        setAICorrectedText(aiRes.diseaseName);
      } else if (aiRes && aiRes.careSuggestions) {
        const careText = Array.isArray(aiRes.careSuggestions)
          ? aiRes.careSuggestions.join('. ')
          : aiRes.careSuggestions;
        setCustomPrompt(careText);
        setAICorrectedText(careText);
      } else {
        setCustomPrompt(rawSTTText);
        setAICorrectedText('');
      }
    } catch (err) {
      setError('AI prompt correction failed.');
    }
    setTimeout(() => setAIPromptActive(false), 1000);
  };

  // Improved TTS for translated answers
  const speakTranslated = (text: string, langCode: string) => {
    if (!('speechSynthesis' in window)) {
      setError('Text-to-speech is not supported in this browser.');
      return;
    }
    stopTTS();
    const voices = window.speechSynthesis.getVoices();
    // Try to find all matching voices for the language
    let ttsLang = TRANSLATE_LANGS.find(l => l.code === langCode)?.tts || 'en-US';
    let matchingVoices = voices.filter(v => v.lang === ttsLang || v.lang.startsWith(langCode));
    if (matchingVoices.length === 0 && ttsLang.includes('-')) {
      // Try base language
      matchingVoices = voices.filter(v => v.lang.startsWith(ttsLang.split('-')[0]));
    }
    let voice = matchingVoices[0];
    if (!voice) {
      setError('No suitable TTS voice found for this language on your device. Falling back to English.');
      const englishVoice = voices.find(v => v.lang.startsWith('en'));
      if (!englishVoice) {
        setError('No English TTS voice found either. TTS not available.');
        return;
      }
      voice = englishVoice;
    }
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.lang = voice.lang;
    utterance.voice = voice;
    utterance.onend = () => {
      setSpeakActive(null);
      setTtsSpeaking(false);
      setTtsPaused(false);
      setTtsUtterance(null);
    };
    utterance.onerror = () => {
      setSpeakActive(null);
      setTtsSpeaking(false);
      setTtsPaused(false);
      setTtsUtterance(null);
    };
    setTtsUtterance(utterance);
    setTtsSpeaking(true);
    setTtsPaused(false);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-3xl font-bold text-green-700 mb-6 text-center capitalize">Plant Identifier</h2>
      <p className="text-gray-600 mb-8 text-center max-w-2xl mx-auto">
        {activeCategory === 'Unknown Plant' 
          ? translate('uploadAnyPlantMessage')
          : translate('selectPlantMessage')}
      </p>
      {/* Category Buttons */}
      <div className="flex flex-wrap justify-center gap-2 mb-4">
        {mainCategories.map(cat => (
          <button
            key={cat.name}
            onClick={() => { 
              setActiveCategory(cat.name); 
              // selectedPlant is now handled by useEffect above
            }}
            className={`flex items-center gap-2 px-5 py-2 rounded-2xl text-base font-medium shadow-sm border border-green-200 transition-colors
              ${activeCategory === cat.name
                ? (cat.name === 'Unknown Plant'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-green-600 text-white')
                : 'bg-white text-green-800 hover:bg-green-50'}
            `}
            style={{ minWidth: 120 }}
          >
            <span className="text-xl">{cat.emoji}</span>
            {cat.name}
          </button>
        ))}
      </div>
      {/* Content based on selected category and plant selection */}
      {(selectedPlant || activeCategory === 'Unknown Plant') ? (
        // Show upload/scan UI for selected plant or Unknown Plant
        <>
          {error && !diagnosis?.error && <Alert type="error" message={error} onClose={() => setError(null)} />}
          <Card className="mb-8">
            <div className="grid md:grid-cols-2 gap-6 items-start">
              <div>
                <h3 className="text-xl font-semibold text-green-700 mb-3 capitalize">Upload Plant Image</h3>
                <ImageUploader onImageUpload={handleImageUpload} idSuffix="plantscan" enableCamera={true} enablePaste={true} />
                <div className="text-xs text-gray-500 mt-2">
                  <div>Upload a file</div>
                  <div>No file chosen</div>
                  <div>or drag and drop</div>
                  <div>or paste image from clipboard</div>
                  <div>or <span className="text-blue-600 underline cursor-pointer">use camera</span></div>
                  <div>PNG, JPG, GIF up to 30MB</div>
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-green-700 mb-3 capitalize">Advanced Options (Optional)</h3>
                <div className="flex items-center gap-2 mb-2">
                  <textarea
                    value={customPrompt || (selectedPlant && selectedPlant !== 'Unknown Plant' ? selectedPlant : '')}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder={translate('customPromptPlaceholder') + ` ` + translate('defaultPromptExample', {default: defaultPromptTextForPlaceholder.substring(0,100) + "..."})}
                    rows={4}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                    aria-label={translate('customPromptPlaceholder')}
                  />
                  <button
                    onClick={handleToggleRecording}
                    className={`p-3 rounded-full shadow-lg border-2 ${isRecording ? 'bg-red-500 border-red-700 animate-pulse' : 'bg-white border-green-500 hover:bg-green-100'} text-green-700 transition-colors`}
                    title={isRecording ? 'Click to stop' : 'Click to speak'}
                    aria-label={isRecording ? 'Click to stop' : 'Click to speak'}
                  >
                    {isRecording ? (
                      <MdMicOff className="w-6 h-6 text-white" />
                    ) : (
                      <MdMic className="w-6 h-6" />
                    )}
                  </button>
                </div>
                {rawSTTText && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-gray-500">Detected language: {sttLangDisplay}</span>
                    <button
                      onClick={handleAICorrectPrompt}
                      className={`p-2 rounded-full text-xs ${aiPromptActive ? 'bg-yellow-400 text-white' : 'bg-purple-500 text-white hover:bg-purple-600'} transition-colors`}
                      title="AI: Make it a proper sentence"
                    >
                      AI Prompt
                    </button>
                    {aiCorrectedText && <span className="text-xs text-green-700">AI: {aiCorrectedText}</span>}
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  {translate('customPromptExampleText')}
                </p>
                {(customPrompt || (selectedPlant && selectedPlant !== 'Unknown Plant')) && (
                  <button
                    onClick={() => speakWithCloudTTS(customPrompt || selectedPlant || '', selectedLang, 'question')}
                    className={`mt-2 p-2 rounded-full ${speakActive === 'question' ? 'bg-yellow-400 text-white' : 'bg-blue-500 text-white hover:bg-blue-600'} transition-colors`}
                    title="Speak question"
                    aria-label="Speak question"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" /></svg>
                  </button>
                )}
              </div>
            </div>
            {imageBase64 && (
              <div className="mt-6 text-center">
                <button
                  onClick={handleScanPlant}
                  disabled={isLoading}
                  className="px-8 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center mx-auto"
                >
                  {isLoading ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span className="ml-2">{translate('scanningButton')}</span>
                    </>
                  ) : (
                    translate('scanPlantButton')
                  )}
                </button>
              </div>
            )}
          </Card>
        </>
      ) : (
        // Show plant grid if no plant is selected
        <>
          {/* Search Bar */}
          <div className="flex justify-center mb-8">
            <div className="relative w-full max-w-lg">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><FaSearch /></span>
              <input
                type="text"
                value={plantSearch}
                onChange={e => setPlantSearch(e.target.value)}
                placeholder="Search plants..."
                className="w-full p-3 pl-12 border border-gray-300 rounded-full shadow-sm focus:ring-green-500 focus:border-green-500 text-base"
              />
            </div>
          </div>
          {/* Plant Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5 mb-8">
            {paginatedPlants.map(plant => (
              <button
                key={plant.name}
                onClick={() => {
                  setSelectedPlant(plant.name);
                  setCustomPrompt(plant.name);
                }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-md border border-gray-200 bg-white transition-all text-left focus:outline-none focus:ring-2 focus:ring-green-500
                  ${selectedPlant === plant.name
                    ? 'ring-2 ring-green-600 bg-green-50 scale-105 text-green-900'
                    : 'hover:bg-green-100 text-green-800'}
                `}
                style={{ minHeight: 60, transition: 'transform 0.15s, box-shadow 0.15s', boxShadow: selectedPlant === plant.name ? '0 8px 24px rgba(34,197,94,0.15)' : '0 2px 8px rgba(0,0,0,0.04)' }}
              >
                <span className="text-2xl">{plant.emoji}</span>
                <span className="truncate w-full font-medium text-base">{plant.name}</span>
              </button>
            ))}
            {filteredPlants.length === 0 && (
              <div className="col-span-full text-center text-gray-500 text-sm">No plants found for this category/search.</div>
            )}
          </div>
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mb-8">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 rounded-lg bg-green-100 text-green-800 font-semibold shadow hover:bg-green-200 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-green-900 font-medium">Page {currentPage} of {totalPages}</span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 rounded-lg bg-green-100 text-green-800 font-semibold shadow hover:bg-green-200 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
          {filteredPlants.length > PLANTS_PER_PAGE && (
            <div className="text-center text-gray-500 text-sm mb-4">Showing {paginatedPlants.length} of {filteredPlants.length} plants. Use search or next page to see more.</div>
          )}
        </>
      )}
      {isLoading && !diagnosis && <LoadingSpinner text={translate('analyzingPlant')} />}
      {diagnosis && (
        <Card title={translate('aiDiagnosisTitle')} className="overflow-visible bg-gradient-to-br from-green-100 via-lime-100 to-yellow-50 shadow-2xl border-2 border-green-300">
          <div className="space-y-6">
            {/* Plant Identification Section */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-green-200 via-lime-100 to-yellow-100 shadow-inner border border-green-300 mb-2 animate-fade-in">
              <span className="text-5xl drop-shadow-lg">
                {diagnosis.plantEmoji || '🪴'}
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-green-800 tracking-wide">
                    {diagnosis.plantName || 'Unknown Plant'}
                  </span>
                  {diagnosis.plantConfidencePercent !== undefined && (
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-green-500 text-white animate-pulse ml-2">
                      {diagnosis.plantConfidencePercent}% sure
                    </span>
                  )}
                </div>
                {diagnosis.plantConfidencePercent !== undefined && (
                  <div className="w-full h-2 bg-green-200 rounded-full mt-2">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-green-400 via-lime-400 to-yellow-300 transition-all duration-700"
                      style={{ width: `${diagnosis.plantConfidencePercent}%` }}
                    ></div>
                  </div>
                )}
              </div>
            </div>
            {/* Status & Disease Section */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className={`px-4 py-2 rounded-full text-lg font-bold shadow ${getStatusTagColor(diagnosis.statusTag)} animate-glow`}>{getStatusTagText(diagnosis.statusTag)}</span>
              </div>
              {diagnosis.diseaseName && diagnosis.diseaseName !== "N/A" && (
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-100 text-red-700 font-semibold shadow animate-pulse">
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-1.414 1.414M6.343 17.657l-1.414 1.415M5.636 5.636l1.414 1.414m11.314 11.314l1.414 1.415M12 8v4l3 3" /></svg>
                  {diagnosis.diseaseName}
                </span>
              )}
            </div>
            {/* Care Suggestions */}
            {diagnosis.careSuggestions && (Array.isArray(diagnosis.careSuggestions) ? diagnosis.careSuggestions.length > 0 : diagnosis.careSuggestions !== "N/A") && (
              <div className="bg-white/80 rounded-xl p-4 shadow-inner border border-green-100 animate-fade-in">
                <strong className="block text-green-700 capitalize mb-2 text-lg">{translate('careSuggestions')}:</strong>
                {Array.isArray(diagnosis.careSuggestions) ? (
                  <ul className="list-disc list-inside ml-4 mt-1 space-y-1 text-green-900">
                    {diagnosis.careSuggestions.map((item, index) => item.trim() && <li key={index} className="pl-1">{item.trim()}</li>)}
                  </ul>
                ) : (
                  <p className="text-green-900 whitespace-pre-line">{diagnosis.careSuggestions}</p>
                )}
              </div>
            )}
            {/* Confidence Section */}
            {(diagnosis.confidenceLevel && diagnosis.confidenceLevel !== "N/A") || diagnosis.confidencePercent !== undefined ? (
              <div className="flex items-center gap-4 mt-2">
                <div className="flex flex-col items-start">
                  <span className="text-green-700 font-semibold">{translate('confidence')}:</span>
                  {diagnosis.confidenceLevel && (
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-500 text-white mt-1 animate-pulse">
                      {diagnosis.confidenceLevel}
                    </span>
                  )}
                </div>
                {diagnosis.confidencePercent !== undefined && (
                  <div className="flex flex-col items-start">
                    <span className="text-green-700 font-semibold">Diagnosis Confidence:</span>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-32 h-3 bg-blue-200 rounded-full overflow-hidden">
                        <div
                          className="h-3 rounded-full bg-gradient-to-r from-blue-400 via-cyan-400 to-green-300 transition-all duration-700"
                          style={{ width: `${diagnosis.confidencePercent}%` }}
                        ></div>
                      </div>
                      <span className="text-blue-700 font-bold text-lg ml-2">{diagnosis.confidencePercent}%</span>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
            {diagnosis.error && <Alert type="warning" message={`${translate('aiResponseWarning')}: ${diagnosis.error}`} />}
            {/* TTS and Translation Controls */}
            <div className="flex flex-col items-center gap-2 mt-4">
              <div className="flex gap-2">
                <button
                  onClick={() => speakWithCloudTTS(diagnosisTextForTTS, selectedLang, 'answer')}
                  className={`p-2 rounded-full ${speakActive === 'answer' ? 'bg-yellow-400 text-white' : 'bg-blue-500 text-white hover:bg-blue-600'} transition-colors`}
                  title="Speak answer"
                  aria-label="Speak answer"
                  disabled={ttsSpeaking}
                >
                  ▶️ Speak
                </button>
                <button
                  onClick={pauseTTS}
                  className="p-2 rounded-full bg-gray-300 text-gray-700 hover:bg-gray-400"
                  disabled={!ttsSpeaking || ttsPaused}
                  title="Pause TTS"
                >⏸️ Pause</button>
                <button
                  onClick={resumeTTS}
                  className="p-2 rounded-full bg-gray-300 text-gray-700 hover:bg-gray-400"
                  disabled={!ttsSpeaking || !ttsPaused}
                  title="Resume TTS"
                >▶️ Resume</button>
                <button
                  onClick={stopTTS}
                  className="p-2 rounded-full bg-gray-300 text-gray-700 hover:bg-gray-400"
                  disabled={!ttsSpeaking}
                  title="Stop TTS"
                >⏹️ Stop</button>
              </div>
              <div className="flex gap-2 items-center mt-2">
                <label htmlFor="translateTarget" className="text-sm font-medium">Translate to:</label>
                <select
                  id="translateTarget"
                  value={translateTarget}
                  onChange={e => setTranslateTarget(e.target.value)}
                  className="p-1 rounded border border-gray-300"
                >
                  {TRANSLATE_LANGS.map(lang => (
                    <option key={lang.code} value={lang.code}>{lang.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => translateText(diagnosisTextForTTS, translateTarget)}
                  className="p-2 rounded bg-green-500 text-white hover:bg-green-600"
                  disabled={isTranslating}
                >{isTranslating ? 'Translating...' : 'Translate'}</button>
              </div>
              {translatedAnswer && (
                <div className="mt-2 p-3 bg-white border border-green-200 rounded shadow w-full max-w-xl">
                  {/* Script warning */}
                  {!translatedScriptOk && (
                    <div className="mb-2 p-2 bg-yellow-100 text-yellow-800 rounded text-sm">
                      Warning: The translated text may not be in the correct script for this language. TTS is disabled. Try again or check your translation settings.
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">Translated Answer:</span>
                    <button
                      onClick={() => {
                        const langObj = TRANSLATE_LANGS.find(l => l.code === translateTarget);
                        speakWithCloudTTS(translatedAnswer, langObj?.tts || 'en-US', 'answer', langObj?.voiceName);
                      }}
                      className="ml-2 p-1 rounded bg-blue-400 text-white hover:bg-blue-600"
                      disabled={ttsSpeaking || !translatedScriptOk}
                    >▶️ Speak</button>
                    <button
                      onClick={pauseTTS}
                      className="p-1 rounded bg-gray-300 text-gray-700 hover:bg-gray-400"
                      disabled={!ttsSpeaking || ttsPaused}
                      title="Pause TTS"
                    >⏸️ Pause</button>
                    <button
                      onClick={resumeTTS}
                      className="p-1 rounded bg-gray-300 text-gray-700 hover:bg-gray-400"
                      disabled={!ttsSpeaking || !ttsPaused}
                      title="Resume TTS"
                    >▶️ Resume</button>
                    <button
                      onClick={stopTTS}
                      className="p-1 rounded bg-gray-300 text-gray-700 hover:bg-gray-400"
                      disabled={!ttsSpeaking}
                      title="Stop TTS"
                    >⏹️ Stop</button>
                  </div>
                  <div className="text-gray-800 whitespace-pre-line">{translatedAnswer}</div>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}
      {/* --- YouTube Video Section --- */}
      {diagnosis && (
        <div className="mt-8 flex flex-col items-center justify-center">
          <h3 className="text-2xl font-bold text-green-700 mb-4 animate-fade-in">Related YouTube Video</h3>
          <RelatedYouTubeVideo plantName={diagnosis.plantName || selectedPlant || ''} diseaseName={diagnosis.diseaseName} />
        </div>
      )}
    </div>
  );
};

export default PlantScanPage;