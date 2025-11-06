import React, { useState, useCallback, useRef, useEffect } from 'react';
import ImageUploader from '../components/ImageUploader';
import LoadingSpinner from '../components/LoadingSpinner';
import Card from '../components/Card';
import Alert from '../components/Alert';
import { PlantDiagnosis, ScanResult } from '../types';
import { diagnosePlant } from '../services/geminiService';
import { addScanResult } from '../services/localStorageService';
import { useLanguage } from '../contexts/LanguageContext';
import { MdMic, MdMicOff, MdVolumeUp, MdVolumeOff, MdCameraAlt, MdVideoCall, MdStopCircle } from 'react-icons/md';
import { FaRobot, FaCrosshairs, FaHistory, FaDownload } from 'react-icons/fa';
import RelatedYouTubeVideo from '../components/RelatedYouTubeVideo';

// AR Detection Interface
interface DetectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  severity: 'healthy' | 'moderate' | 'diseased';
  label: string;
}

const PlantScanPage: React.FC = () => {
  // Core states
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [diagnosis, setDiagnosis] = useState<PlantDiagnosis | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { translate, language } = useLanguage();
  
  // AR Mode states
  const [arMode, setArMode] = useState<'static' | 'live' | 'off'>('off');
  const [arDetections, setArDetections] = useState<DetectionBox[]>([]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // AR Settings
  const [arSettings, setArSettings] = useState({
    detectionMode: 'realtime', // 'realtime' | 'snapshot' | 'continuous'
    sensitivity: 70, // 0-100
    showConfidence: true,
    showBoundingBoxes: true,
    colorCoding: true,
    heatmapOverlay: false,
    autoCapture: false,
    captureInterval: 5, // seconds
    soundAlerts: true,
    voiceGuidance: true,
  });
  
  // Voice states
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<any>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  
  // Scan history
  const [scanHistory, setScanHistory] = useState<Array<{
    timestamp: number;
    image: string;
    result: PlantDiagnosis;
    detections: DetectionBox[];
  }>>([]);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = language === 'kn' ? 'kn-IN' : 'en-US';
      
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        handleVoiceCommand(transcript);
      };
      
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
      };
      
      recognition.onend = () => {
        setIsRecording(false);
      };
      
      recognitionRef.current = recognition;
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      stopCamera();
    };
  }, [language]);

  // Voice command handler
  const handleVoiceCommand = (command: string) => {
    const lowerCommand = command.toLowerCase();
    
    if (lowerCommand.includes('scan') || lowerCommand.includes('analyze') || lowerCommand.includes('ಸ್ಕ್ಯಾನ್')) {
      if (imageBase64) {
        handleScan();
      } else if (isCameraActive) {
        captureFromCamera();
      }
    } else if (lowerCommand.includes('camera') || lowerCommand.includes('ಕ್ಯಾಮೆರಾ')) {
      startCamera();
    } else if (lowerCommand.includes('stop') || lowerCommand.includes('ನಿಲ್ಲಿಸಿ')) {
      stopCamera();
    } else if (lowerCommand.includes('read') || lowerCommand.includes('speak') || lowerCommand.includes('ಮಾತನಾಡು')) {
      if (diagnosis) {
        speakDiagnosis();
      }
    }
  };

  // Start voice recognition
  const toggleVoiceRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    } else {
      recognitionRef.current?.start();
      setIsRecording(true);
      if (arSettings.voiceGuidance) {
        speak(language === 'kn' ? 'ಆಜ್ಞೆ ಹೇಳಿ' : 'Listening for command...');
      }
    }
  };

  // Text-to-speech function
  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel(); // Stop any ongoing speech
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === 'kn' ? 'kn-IN' : 'en-US';
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      utteranceRef.current = utterance;
      speechSynthesis.speak(utterance);
    }
  };

  // Speak diagnosis
  const speakDiagnosis = () => {
    if (!diagnosis) return;
    
    const suggestions = Array.isArray(diagnosis.careSuggestions) 
      ? diagnosis.careSuggestions.join('. ') 
      : diagnosis.careSuggestions;
    
    const text = language === 'kn'
      ? `ಸಸ್ಯ: ${diagnosis.plantName || 'ಅಪರಿಚಿತ'}. ಸ್ಥಿತಿ: ${diagnosis.condition}. ${diagnosis.diseaseName !== 'N/A' ? `ರೋಗ: ${diagnosis.diseaseName}.` : ''} ಆರೈಕೆ ಸಲಹೆಗಳು: ${suggestions}`
      : `Plant: ${diagnosis.plantName || 'Unknown'}. Condition: ${diagnosis.condition}. ${diagnosis.diseaseName !== 'N/A' ? `Disease: ${diagnosis.diseaseName}.` : ''} Care suggestions: ${suggestions}`;
    
    speak(text);
  };

  const toggleSpeech = () => {
    if (isSpeaking) {
      speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      speakDiagnosis();
    }
  };

  // Camera functions
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsCameraActive(true);
        setArMode('live');
        setError(null);
        
        if (arSettings.voiceGuidance) {
          speak(language === 'kn' ? 'ಕ್ಯಾಮೆರಾ ಸಿದ್ಧ. ಎಲೆಯತ್ತ ತೋರಿಸಿ.' : 'Camera ready. Point at leaf.');
        }
      }
    } catch (err) {
      setError(language === 'kn' 
        ? 'ಕ್ಯಾಮೆರಾ ಪ್ರವೇಶ ನಿರಾಕರಿಸಲಾಗಿದೆ'
        : 'Camera access denied'
      );
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setIsCameraActive(false);
      setIsScanning(false);
      setArMode('off');
      setArDetections([]);
    }
  };

  const captureFromCamera = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    
    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    setImageBase64(imageData);
    setArMode('static');
    
    // Perform AR detection
    if (arSettings.detectionMode !== 'off') {
      performARDetection(ctx.getImageData(0, 0, canvas.width, canvas.height));
    }
    
    if (arSettings.soundAlerts) {
      playBeep();
    }
  };

  // AR Detection algorithm
  const performARDetection = (imageData: ImageData) => {
    const detections: DetectionBox[] = [];
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    const gridSize = 100; // Analysis block size
    const threshold = arSettings.sensitivity / 100;
    
    for (let y = 0; y < height - gridSize; y += gridSize) {
      for (let x = 0; x < width - gridSize; x += gridSize) {
        let redSum = 0, greenSum = 0, blueSum = 0;
        let yellowPixels = 0, brownPixels = 0, darkSpots = 0;
        let pixelCount = 0;
        
        // Analyze block
        for (let dy = 0; dy < gridSize; dy += 2) {
          for (let dx = 0; dx < gridSize; dx += 2) {
            const i = ((y + dy) * width + (x + dx)) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            redSum += r;
            greenSum += g;
            blueSum += b;
            pixelCount++;
            
            // Disease indicators
            if (r > 150 && g > 120 && b < 100) yellowPixels++;
            if (r > 80 && r < 140 && g > 60 && g < 120 && b < 80) brownPixels++;
            if (r < 60 && g < 60 && b < 60) darkSpots++;
          }
        }
        
        const avgR = redSum / pixelCount;
        const avgG = greenSum / pixelCount;
        const avgB = blueSum / pixelCount;
        
        // Only process green-ish areas (plant material)
        if (avgG > avgR * 1.1 && avgG > avgB && avgG > 40) {
          const diseaseRatio = (yellowPixels + brownPixels + darkSpots) / pixelCount;
          
          if (diseaseRatio > threshold * 0.2) {
            let severity: 'healthy' | 'moderate' | 'diseased';
            let confidence: number;
            
            if (diseaseRatio > threshold * 0.4) {
              severity = 'diseased';
              confidence = Math.min(diseaseRatio * 2.5, 0.98);
            } else if (diseaseRatio > threshold * 0.1) {
              severity = 'moderate';
              confidence = diseaseRatio * 3;
            } else {
              severity = 'healthy';
              confidence = 0.9 - diseaseRatio * 2;
            }
            
            detections.push({
              x: x,
              y: y,
              width: gridSize,
              height: gridSize,
              confidence: confidence,
              severity: severity,
              label: language === 'kn' 
                ? (severity === 'diseased' ? 'ರೋಗಗ್ರಸ್ತ' : severity === 'moderate' ? 'ಮಧ್ಯಮ' : 'ಆರೋಗ್ಯಕರ')
                : (severity === 'diseased' ? 'Diseased' : severity === 'moderate' ? 'Moderate' : 'Healthy')
            });
          }
        }
      }
    }
    
    setArDetections(detections);
    
    // Voice alert for severe cases
    if (arSettings.voiceGuidance && detections.some(d => d.severity === 'diseased')) {
      speak(language === 'kn' ? 'ರೋಗ ಪತ್ತೆಯಾಗಿದೆ!' : 'Disease detected!');
    }
  };

  // Real-time AR scanning
  const scanFrame = useCallback(() => {
    if (!isScanning || !videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      performARDetection(imageData);
      drawAROverlays();
    }
    
    requestAnimationFrame(scanFrame);
  }, [isScanning, arSettings]);

  useEffect(() => {
    if (isScanning) {
      scanFrame();
    }
  }, [isScanning, scanFrame]);

  // Draw AR overlays
  const drawAROverlays = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    if (!canvas || !video || !arSettings.showBoundingBoxes) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    arDetections.forEach(box => {
      let color: string;
      let bgColor: string;
      
      if (arSettings.colorCoding) {
        switch (box.severity) {
          case 'diseased':
            color = '#EF4444';
            bgColor = 'rgba(239, 68, 68, 0.25)';
            break;
          case 'moderate':
            color = '#F59E0B';
            bgColor = 'rgba(245, 158, 11, 0.25)';
            break;
          case 'healthy':
            color = '#10B981';
            bgColor = 'rgba(16, 185, 129, 0.25)';
            break;
        }
      } else {
        color = '#3B82F6';
        bgColor = 'rgba(59, 130, 246, 0.25)';
      }
      
      // Fill
      ctx.fillStyle = bgColor;
      ctx.fillRect(box.x, box.y, box.width, box.height);
      
      // Border
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.strokeRect(box.x, box.y, box.width, box.height);
      
      // Label
      if (arSettings.showConfidence) {
        ctx.fillStyle = color;
        const labelText = `${box.label} ${Math.round(box.confidence * 100)}%`;
        ctx.font = 'bold 18px Arial';
        const textWidth = ctx.measureText(labelText).width;
        ctx.fillRect(box.x, box.y - 30, textWidth + 12, 30);
        
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(labelText, box.x + 6, box.y - 8);
      }
    });
  };

  // Sound alert
  const playBeep = () => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  };

  // Image upload handler
  const handleImageUpload = useCallback((base64: string, file: File) => {
    setImageBase64(base64);
    setImageFile(file);
    setDiagnosis(null);
    setError(null);
    setArMode('static');
    
    // Perform AR detection on uploaded image
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        performARDetection(ctx.getImageData(0, 0, canvas.width, canvas.height));
      }
    };
    img.src = base64;
  }, []);

  // Main scan function
  const handleScan = async () => {
    if (!imageBase64) {
      setError(translate('errorPleaseUploadImage'));
      return;
    }

    setIsLoading(true);
    setError(null);
    setDiagnosis(null);

    try {
      const mimeType = imageFile?.type || 'image/jpeg';
      const result = await diagnosePlant(imageBase64, mimeType);

      if (result.error) {
        setError(result.error);
        if (arSettings.voiceGuidance) {
          speak(language === 'kn' ? 'ದೋಷ ಸಂಭವಿಸಿದೆ' : 'Error occurred');
        }
      } else {
        setDiagnosis(result);
        
        // Save to history
        const historyEntry = {
          timestamp: Date.now(),
          image: imageBase64,
          result: result,
          detections: arDetections
        };
        setScanHistory(prev => [historyEntry, ...prev.slice(0, 9)]);
        
        // Save to localStorage
        if (imageFile) {
          const scanResult: ScanResult = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            imagePreviewUrl: imageBase64,
            diagnosis: result,
            originalPrompt: ''
          };
          addScanResult(scanResult);
        }
        
        // Voice feedback
        if (arSettings.voiceGuidance) {
          setTimeout(() => speakDiagnosis(), 500);
        }
        
        // Sound alert
        if (arSettings.soundAlerts) {
          playBeep();
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      if (arSettings.voiceGuidance) {
        speak(language === 'kn' ? 'ದೋಷ ಸಂಭವಿಸಿದೆ' : 'Error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const downloadResult = () => {
    if (!diagnosis || !imageBase64) return;
    
    const data = {
      timestamp: new Date().toISOString(),
      plant: diagnosis.plantName,
      condition: diagnosis.condition,
      disease: diagnosis.diseaseName,
      care: diagnosis.careSuggestions,
      confidence: diagnosis.confidenceLevel,
      detections: arDetections
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plant-scan-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 pb-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 text-white py-8 px-4 shadow-2xl">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold mb-3 text-center flex items-center justify-center gap-3">
            <span className="text-5xl">🔬</span>
            {language === 'kn' ? 'AI ಸಸ್ಯ ರೋಗನಿರ್ಣಯ' : 'AI Plant Diagnosis'}
            <span className="text-5xl">🌿</span>
          </h1>
          <p className="text-xl text-center opacity-95 mb-4">
            {language === 'kn' 
              ? 'ಉನ್ನತ AR ಪತ್ತೆ • ನೈಜ-ಸಮಯ ವಿಶ್ಲೇಷಣೆ • ಧ್ವನಿ ಮಾರ್ಗದರ್ಶನ'
              : 'Advanced AR Detection • Real-Time Analysis • Voice Guidance'
            }
          </p>
          
          {/* Quick Stats */}
          <div className="flex flex-wrap justify-center gap-3 text-sm">
            <span className="bg-white/20 px-4 py-2 rounded-full backdrop-blur flex items-center gap-2">
              <FaCrosshairs className="text-lg" />
              {arDetections.length} {language === 'kn' ? 'ಪತ್ತೆಗಳು' : 'Detections'}
            </span>
            <span className="bg-white/20 px-4 py-2 rounded-full backdrop-blur flex items-center gap-2">
              <FaHistory className="text-lg" />
              {scanHistory.length} {language === 'kn' ? 'ಸ್ಕ್ಯಾನ್‌ಗಳು' : 'Scans'}
            </span>
            {isCameraActive && (
              <span className="bg-red-500/80 px-4 py-2 rounded-full backdrop-blur animate-pulse flex items-center gap-2">
                🔴 {language === 'kn' ? 'ಲೈವ್' : 'LIVE'}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Scan Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Camera/Image Section */}
            <Card className="bg-white/90 backdrop-blur">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-green-700 flex items-center gap-2">
                  {arMode === 'live' ? (
                    <>
                      <MdVideoCall className="text-3xl" />
                      {language === 'kn' ? 'ಲೈವ್ ಕ್ಯಾಮೆರಾ' : 'Live Camera'}
                    </>
                  ) : (
                    <>
                      <MdCameraAlt className="text-3xl" />
                      {language === 'kn' ? 'ಚಿತ್ರ ಸ್ಕ್ಯಾನ್' : 'Image Scan'}
                    </>
                  )}
                </h2>
                
                {/* Voice Controls */}
                <div className="flex gap-2">
                  <button
                    onClick={toggleVoiceRecording}
                    className={`p-3 rounded-xl font-bold transition-all ${
                      isRecording 
                        ? 'bg-red-500 text-white animate-pulse' 
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                    title={language === 'kn' ? 'ಧ್ವನಿ ಆಜ್ಞೆ' : 'Voice Command'}
                  >
                    {isRecording ? <MdMicOff className="text-2xl" /> : <MdMic className="text-2xl" />}
                  </button>
                  
                  {diagnosis && (
                    <button
                      onClick={toggleSpeech}
                      className={`p-3 rounded-xl font-bold transition-all ${
                        isSpeaking 
                          ? 'bg-purple-500 text-white animate-pulse' 
                          : 'bg-green-500 text-white hover:bg-green-600'
                      }`}
                      title={language === 'kn' ? 'ಫಲಿತಾಂಶ ಮಾತನಾಡಿಸಿ' : 'Speak Result'}
                    >
                      {isSpeaking ? <MdVolumeOff className="text-2xl" /> : <MdVolumeUp className="text-2xl" />}
                    </button>
                  )}
                </div>
              </div>

              {/* Camera/Image Display */}
              <div className="relative bg-black rounded-xl overflow-hidden mb-4 w-full" style={{paddingBottom: '56.25%'}}>
                <div className="absolute inset-0">
                {isCameraActive ? (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <canvas
                      ref={canvasRef}
                      className="absolute top-0 left-0 w-full h-full pointer-events-none"
                    />
                    
                    {/* AR Overlay Stats */}
                    <div className="absolute top-4 left-4 bg-black/70 text-white px-4 py-2 rounded-lg text-sm space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-500 rounded animate-pulse"></div>
                        <span>{arDetections.filter(d => d.severity === 'diseased').length} {language === 'kn' ? 'ರೋಗಗ್ರಸ್ತ' : 'Diseased'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                        <span>{arDetections.filter(d => d.severity === 'moderate').length} {language === 'kn' ? 'ಮಧ್ಯಮ' : 'Moderate'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded"></div>
                        <span>{arDetections.filter(d => d.severity === 'healthy').length} {language === 'kn' ? 'ಆರೋಗ್ಯಕರ' : 'Healthy'}</span>
                      </div>
                    </div>
                    
                    {/* Crosshair */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <FaCrosshairs className="text-white text-6xl opacity-30" />
                    </div>
                  </>
                ) : imageBase64 ? (
                  <div className="relative w-full h-full">
                    <img src={imageBase64} alt="Plant" className="w-full h-full object-contain" />
                    {arMode === 'static' && arDetections.length > 0 && (
                      <div className="absolute top-4 right-4 bg-black/70 text-white px-4 py-2 rounded-lg text-sm">
                        <div className="font-bold mb-1">
                          {language === 'kn' ? 'AR ಪತ್ತೆಗಳು:' : 'AR Detections:'}
                        </div>
                        <div className="space-y-1">
                          <div className="text-red-400">
                            🔴 {arDetections.filter(d => d.severity === 'diseased').length} {language === 'kn' ? 'ರೋಗಗ್ರಸ್ತ' : 'Diseased'}
                          </div>
                          <div className="text-yellow-400">
                            🟡 {arDetections.filter(d => d.severity === 'moderate').length} {language === 'kn' ? 'ಮಧ್ಯಮ' : 'Moderate'}
                          </div>
                          <div className="text-green-400">
                            🟢 {arDetections.filter(d => d.severity === 'healthy').length} {language === 'kn' ? 'ಆರೋಗ್ಯಕರ' : 'Healthy'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-900">
                    <div className="text-center text-gray-400">
                      <FaRobot className="text-6xl mx-auto mb-4 opacity-50" />
                      <p className="text-lg">
                        {language === 'kn' 
                          ? 'ಚಿತ್ರ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ ಅಥವಾ ಕ್ಯಾಮೆರಾ ಪ್ರಾರಂಭಿಸಿ'
                          : 'Upload Image or Start Camera'
                        }
                      </p>
                    </div>
                  </div>
                )}
                </div>
              </div>

              {/* Control Buttons */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {!isCameraActive ? (
                  <>
                    <button
                      onClick={startCamera}
                      className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 rounded-xl font-bold hover:scale-105 transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                      <MdVideoCall className="text-2xl" />
                      {language === 'kn' ? 'ಕ್ಯಾಮೆರಾ' : 'Camera'}
                    </button>
                    
                    <div className="col-span-1">
                      <ImageUploader onImageUpload={handleImageUpload} />
                    </div>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setIsScanning(!isScanning)}
                      className={`${
                        isScanning 
                          ? 'bg-gradient-to-r from-orange-600 to-red-600' 
                          : 'bg-gradient-to-r from-green-600 to-emerald-600'
                      } text-white px-4 py-3 rounded-xl font-bold hover:scale-105 transition-all shadow-lg flex items-center justify-center gap-2`}
                    >
                      {isScanning ? (
                        <>
                          <MdStopCircle className="text-2xl" />
                          {language === 'kn' ? 'ವಿರಾಮ' : 'Pause'}
                        </>
                      ) : (
                        <>
                          <FaCrosshairs className="text-xl" />
                          {language === 'kn' ? 'ಸ್ಕ್ಯಾನ್' : 'Scan'}
                        </>
                      )}
                    </button>
                    
                    <button
                      onClick={captureFromCamera}
                      className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-3 rounded-xl font-bold hover:scale-105 transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                      <MdCameraAlt className="text-2xl" />
                      {language === 'kn' ? 'ಸೆರೆಹಿಡಿ' : 'Capture'}
                    </button>
                    
                    <button
                      onClick={stopCamera}
                      className="bg-gradient-to-r from-gray-600 to-gray-700 text-white px-4 py-3 rounded-xl font-bold hover:scale-105 transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                      <MdStopCircle className="text-2xl" />
                      {language === 'kn' ? 'ನಿಲ್ಲಿಸಿ' : 'Stop'}
                    </button>
                  </>
                )}
                
                <button
                  onClick={handleScan}
                  disabled={!imageBase64 || isLoading}
                  className={`${
                    !imageBase64 || isLoading
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:scale-105'
                  } text-white px-4 py-3 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50`}
                >
                  <FaRobot className="text-2xl" />
                  {isLoading 
                    ? (language === 'kn' ? 'ವಿಶ್ಲೇಷಿಸುತ್ತಿದೆ...' : 'Analyzing...') 
                    : (language === 'kn' ? 'AI ವಿಶ್ಲೇಷಣೆ' : 'AI Analysis')
                  }
                </button>
              </div>
            </Card>

            {/* Results Section */}
            {isLoading && (
              <Card className="bg-white/90 backdrop-blur">
                <LoadingSpinner text={language === 'kn' ? 'AI ವಿಶ್ಲೇಷಿಸುತ್ತಿದೆ...' : 'AI Analyzing...'} size="lg" />
              </Card>
            )}

            {error && (
              <Alert type="error" message={error} />
            )}

            {diagnosis && (
              <Card className="bg-white/90 backdrop-blur">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-2xl font-bold text-green-700 flex items-center gap-2">
                    <FaRobot className="text-3xl" />
                    {language === 'kn' ? 'AI ಫಲಿತಾಂಶಗಳು' : 'AI Results'}
                  </h3>
                  <button
                    onClick={downloadResult}
                    className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-all flex items-center gap-2"
                  >
                    <FaDownload />
                    {language === 'kn' ? 'ಡೌನ್‌ಲೋಡ್' : 'Download'}
                  </button>
                </div>

                {/* Plant Info */}
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-xl mb-4 border-2 border-green-200">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="text-6xl">{diagnosis.plantEmoji || '🌱'}</div>
                    <div>
                      <h4 className="text-2xl font-bold text-green-800">{diagnosis.plantName || 'Unknown'}</h4>
                      <p className="text-gray-600">
                        {language === 'kn' ? 'ವಿಶ್ವಾಸ:' : 'Confidence:'} {diagnosis.plantConfidencePercent || 0}%
                      </p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className={`p-4 rounded-lg border-2 ${
                      diagnosis.statusTag === 'Healthy' ? 'bg-green-100 border-green-300' :
                      diagnosis.statusTag === 'Diseased' ? 'bg-red-100 border-red-300' :
                      'bg-yellow-100 border-yellow-300'
                    }`}>
                      <p className="text-sm font-semibold mb-1">
                        {language === 'kn' ? 'ಸ್ಥಿತಿ' : 'Condition'}
                      </p>
                      <p className="text-lg font-bold">{diagnosis.condition}</p>
                    </div>

                    <div className="bg-blue-100 border-2 border-blue-300 p-4 rounded-lg">
                      <p className="text-sm font-semibold mb-1">
                        {language === 'kn' ? 'ರೋಗ/ಸಮಸ್ಯೆ' : 'Disease/Issue'}
                      </p>
                      <p className="text-lg font-bold">{diagnosis.diseaseName}</p>
                    </div>
                  </div>
                </div>

                {/* Care Suggestions */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-xl border-2 border-blue-200">
                  <h4 className="text-xl font-bold text-blue-800 mb-3 flex items-center gap-2">
                    💡 {language === 'kn' ? 'ಆರೈಕೆ ಸಲಹೆಗಳು' : 'Care Suggestions'}
                  </h4>
                  <ul className="space-y-2">
                    {(Array.isArray(diagnosis.careSuggestions) ? diagnosis.careSuggestions : [diagnosis.careSuggestions]).map((suggestion: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2 text-gray-700">
                        <span className="text-green-600 font-bold">✓</span>
                        <span>{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Related Video */}
                {diagnosis.plantName && diagnosis.plantName !== 'Unknown' && (
                  <div className="mt-4">
                    <RelatedYouTubeVideo plantName={diagnosis.plantName} />
                  </div>
                )}
              </Card>
            )}
          </div>

          {/* AR Settings Sidebar */}
          <div className="space-y-6">
            <Card className="bg-white/90 backdrop-blur">
              <h3 className="text-xl font-bold text-green-700 mb-4 flex items-center gap-2">
                ⚙️ {language === 'kn' ? 'AR ಸೆಟ್ಟಿಂಗ್‌ಗಳು' : 'AR Settings'}
              </h3>

              <div className="space-y-4">
                {/* Detection Mode */}
                <div>
                  <label className="block text-sm font-semibold mb-2" htmlFor="detection-mode-select">
                    {language === 'kn' ? 'ಪತ್ತೆ ಮೋಡ್' : 'Detection Mode'}
                  </label>
                  <select
                    id="detection-mode-select"
                    value={arSettings.detectionMode}
                    onChange={(e) => setArSettings({...arSettings, detectionMode: e.target.value as any})}
                    className="w-full px-3 py-2 border-2 border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="realtime">{language === 'kn' ? 'ನೈಜ-ಸಮಯ' : 'Real-time'}</option>
                    <option value="snapshot">{language === 'kn' ? 'ಸ್ನ್ಯಾಪ್‌ಶಾಟ್' : 'Snapshot'}</option>
                    <option value="continuous">{language === 'kn' ? 'ನಿರಂತರ' : 'Continuous'}</option>
                  </select>
                </div>

                {/* Sensitivity */}
                <div>
                  <label className="block text-sm font-semibold mb-2" htmlFor="sensitivity-slider">
                    {language === 'kn' ? 'ಸಂವೇದನಾ: ' : 'Sensitivity: '}{arSettings.sensitivity}%
                  </label>
                  <input
                    id="sensitivity-slider"
                    type="range"
                    min="0"
                    max="100"
                    value={arSettings.sensitivity}
                    onChange={(e) => setArSettings({...arSettings, sensitivity: parseInt(e.target.value)})}
                    className="w-full"
                    aria-label={language === 'kn' ? 'ಸಂವೇದನಾ ಸ್ಲೈಡರ್' : 'Sensitivity slider'}
                  />
                </div>

                {/* Toggle Settings */}
                {[
                  { key: 'showConfidence', label: language === 'kn' ? 'ವಿಶ್ವಾಸ ತೋರಿಸಿ' : 'Show Confidence' },
                  { key: 'showBoundingBoxes', label: language === 'kn' ? 'ಬಾಕ್ಸ್‌ಗಳು ತೋರಿಸಿ' : 'Show Boxes' },
                  { key: 'colorCoding', label: language === 'kn' ? 'ಬಣ್ಣ ಕೋಡಿಂಗ್' : 'Color Coding' },
                  { key: 'soundAlerts', label: language === 'kn' ? 'ಧ್ವನಿ ಎಚ್ಚರಿಕೆಗಳು' : 'Sound Alerts' },
                  { key: 'voiceGuidance', label: language === 'kn' ? 'ಧ್ವನಿ ಮಾರ್ಗದರ್ಶನ' : 'Voice Guidance' },
                ].map(setting => (
                  <label key={setting.key} className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm font-semibold">{setting.label}</span>
                    <input
                      type="checkbox"
                      checked={arSettings[setting.key as keyof typeof arSettings] as boolean}
                      onChange={(e) => setArSettings({...arSettings, [setting.key]: e.target.checked})}
                      className="w-5 h-5 text-green-600 rounded focus:ring-2 focus:ring-green-500"
                    />
                  </label>
                ))}
              </div>
            </Card>

            {/* Scan History */}
            <Card className="bg-white/90 backdrop-blur">
              <h3 className="text-xl font-bold text-green-700 mb-4 flex items-center gap-2">
                <FaHistory />
                {language === 'kn' ? 'ಇತ್ತೀಚಿನ ಸ್ಕ್ಯಾನ್‌ಗಳು' : 'Recent Scans'}
              </h3>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {scanHistory.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">
                    {language === 'kn' ? 'ಇನ್ನೂ ಸ್ಕ್ಯಾನ್‌ಗಳಿಲ್ಲ' : 'No scans yet'}
                  </p>
                ) : (
                  scanHistory.map((scan, idx) => (
                    <div
                      key={idx}
                      className="border-2 border-green-200 rounded-lg p-3 hover:bg-green-50 transition-all cursor-pointer"
                      onClick={() => {
                        setImageBase64(scan.image);
                        setDiagnosis(scan.result);
                        setArDetections(scan.detections);
                      }}
                    >
                      <div className="flex gap-3">
                        <img src={scan.image} alt="Scan" className="w-16 h-16 object-cover rounded" />
                        <div className="flex-1">
                          <p className="font-bold text-sm">{scan.result.plantName}</p>
                          <p className="text-xs text-gray-600">{scan.result.condition}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(scan.timestamp).toLocaleString(language === 'kn' ? 'kn-IN' : 'en-IN')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Voice Commands Help */}
            <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-300">
              <h3 className="text-lg font-bold text-purple-700 mb-3">
                🎤 {language === 'kn' ? 'ಧ್ವನಿ ಆಜ್ಞೆಗಳು' : 'Voice Commands'}
              </h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-purple-600">•</span>
                  <span>"{language === 'kn' ? 'ಸ್ಕ್ಯಾನ್' : 'scan'}" - {language === 'kn' ? 'ವಿಶ್ಲೇಷಣೆ ಪ್ರಾರಂಭಿಸಿ' : 'Start analysis'}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600">•</span>
                  <span>"{language === 'kn' ? 'ಕ್ಯಾಮೆರಾ' : 'camera'}" - {language === 'kn' ? 'ಕ್ಯಾಮೆರಾ ತೆರೆಯಿರಿ' : 'Open camera'}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600">•</span>
                  <span>"{language === 'kn' ? 'ಮಾತನಾಡು' : 'read'}" - {language === 'kn' ? 'ಫಲಿತಾಂಶ ಓದಿ' : 'Read results'}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600">•</span>
                  <span>"{language === 'kn' ? 'ನಿಲ್ಲಿಸಿ' : 'stop'}" - {language === 'kn' ? 'ಕ್ಯಾಮೆರಾ ನಿಲ್ಲಿಸಿ' : 'Stop camera'}</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlantScanPage;
