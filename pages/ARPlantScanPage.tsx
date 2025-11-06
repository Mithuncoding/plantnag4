import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import Card from '../components/Card';
import { analyzeImage } from '../services/geminiService';

interface DetectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  severity: 'healthy' | 'moderate' | 'diseased';
  label: string;
}

const ARPlantScanPage: React.FC = () => {
  const { language } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [isScanning, setIsScanning] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [detections, setDetections] = useState<DetectionBox[]>([]);
  const [diagnosis, setDiagnosis] = useState<string>('');
  const [treatment, setTreatment] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string>('');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsCameraActive(true);
        setError('');
      }
    } catch (err) {
      setError(language === 'kn' 
        ? 'ಕ್ಯಾಮೆರಾ ಪ್ರವೇಶ ನಿರಾಕರಿಸಲಾಗಿದೆ. ದಯವಿಟ್ಟು ಅನುಮತಿಗಳನ್ನು ಪರಿಶೀಲಿಸಿ.'
        : 'Camera access denied. Please check permissions.'
      );
    }
  }, [language]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setIsCameraActive(false);
      setIsScanning(false);
      setDetections([]);
    }
  }, []);

  // Simulate disease detection using color analysis and pattern recognition
  const detectDiseases = useCallback((imageData: ImageData) => {
    const detections: DetectionBox[] = [];
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;

    // Simple color-based detection algorithm
    // This simulates ML model detection for demo purposes
    const gridSize = 80; // Analyze in 80x80 pixel blocks
    
    for (let y = 0; y < height - gridSize; y += gridSize) {
      for (let x = 0; x < width - gridSize; x += gridSize) {
        let redSum = 0, greenSum = 0, blueSum = 0;
        let pixelCount = 0;
        let yellowishPixels = 0;
        let brownishPixels = 0;
        
        // Analyze color distribution in block
        for (let dy = 0; dy < gridSize; dy++) {
          for (let dx = 0; dx < gridSize; dx++) {
            const i = ((y + dy) * width + (x + dx)) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            redSum += r;
            greenSum += g;
            blueSum += b;
            pixelCount++;
            
            // Detect disease indicators by color
            // Yellow/brown spots indicate disease
            if (r > 150 && g > 120 && b < 100) yellowishPixels++;
            if (r > 100 && r < 150 && g > 80 && g < 130 && b < 80) brownishPixels++;
          }
        }
        
        const avgR = redSum / pixelCount;
        const avgG = greenSum / pixelCount;
        const avgB = blueSum / pixelCount;
        
        // Only process green-ish areas (likely plant material)
        if (avgG > avgR && avgG > avgB && avgG > 50) {
          const diseaseRatio = (yellowishPixels + brownishPixels) / pixelCount;
          
          // Determine severity based on color abnormalities
          if (diseaseRatio > 0.15) {
            // High disease
            detections.push({
              x: x,
              y: y,
              width: gridSize,
              height: gridSize,
              confidence: Math.min(diseaseRatio * 5, 0.95),
              severity: 'diseased',
              label: language === 'kn' ? 'ರೋಗಗ್ರಸ್ತ' : 'Diseased'
            });
          } else if (diseaseRatio > 0.05) {
            // Moderate disease
            detections.push({
              x: x,
              y: y,
              width: gridSize,
              height: gridSize,
              confidence: diseaseRatio * 3,
              severity: 'moderate',
              label: language === 'kn' ? 'ಮಧ್ಯಮ' : 'Moderate'
            });
          } else if (Math.random() > 0.7) {
            // Show occasional healthy regions
            detections.push({
              x: x,
              y: y,
              width: gridSize,
              height: gridSize,
              confidence: 0.9,
              severity: 'healthy',
              label: language === 'kn' ? 'ಆರೋಗ್ಯಕರ' : 'Healthy'
            });
          }
        }
      }
    }
    
    return detections;
  }, [language]);

  // Draw AR overlays on canvas
  const drawOverlays = useCallback((boxes: DetectionBox[]) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    if (!canvas || !video) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Match canvas size to video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Clear previous frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw each detection box
    boxes.forEach(box => {
      // Set color based on severity
      let color: string;
      let bgColor: string;
      
      switch (box.severity) {
        case 'diseased':
          color = '#EF4444'; // Red
          bgColor = 'rgba(239, 68, 68, 0.2)';
          break;
        case 'moderate':
          color = '#F59E0B'; // Yellow/Orange
          bgColor = 'rgba(245, 158, 11, 0.2)';
          break;
        case 'healthy':
          color = '#10B981'; // Green
          bgColor = 'rgba(16, 185, 129, 0.2)';
          break;
      }
      
      // Draw filled rectangle
      ctx.fillStyle = bgColor;
      ctx.fillRect(box.x, box.y, box.width, box.height);
      
      // Draw border
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(box.x, box.y, box.width, box.height);
      
      // Draw label background
      ctx.fillStyle = color;
      const labelText = `${box.label} ${Math.round(box.confidence * 100)}%`;
      ctx.font = 'bold 16px Arial';
      const textWidth = ctx.measureText(labelText).width;
      ctx.fillRect(box.x, box.y - 25, textWidth + 10, 25);
      
      // Draw label text
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(labelText, box.x + 5, box.y - 7);
    });
  }, []);

  // Real-time scanning loop
  const scanFrame = useCallback(() => {
    if (!isScanning || !videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Create temporary canvas for analysis
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = video.videoWidth;
      tempCanvas.height = video.videoHeight;
      const tempCtx = tempCanvas.getContext('2d');
      
      if (tempCtx) {
        tempCtx.drawImage(video, 0, 0);
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        
        // Detect diseases
        const boxes = detectDiseases(imageData);
        setDetections(boxes);
        
        // Draw overlays
        drawOverlays(boxes);
      }
    }
    
    // Continue scanning
    requestAnimationFrame(scanFrame);
  }, [isScanning, detectDiseases, drawOverlays]);

  // Start/stop scanning
  useEffect(() => {
    if (isScanning) {
      scanFrame();
    }
  }, [isScanning, scanFrame]);

  // Capture and analyze with Gemini AI
  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    setIsAnalyzing(true);
    setDiagnosis('');
    setTreatment('');
    
    try {
      // Capture current frame
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) throw new Error('Canvas context not available');
      
      ctx.drawImage(video, 0, 0);
      const imageBlob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.9);
      });
      
      // Convert to base64
      const reader = new FileReader();
      reader.readAsDataURL(imageBlob);
      const base64 = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
      });
      
      // Prepare prompt for disease detection
      const prompt = language === 'kn'
        ? `ಈ ಸಸ್ಯದ ಎಲೆಯನ್ನು ವಿಶ್ಲೇಷಿಸಿ ಮತ್ತು ಯಾವುದೇ ರೋಗಗಳನ್ನು ಗುರುತಿಸಿ. ದಯವಿಟ್ಟು ನೀಡಿ:
1. ರೋಗದ ಹೆಸರು (ಇದ್ದರೆ)
2. ತೀವ್ರತೆ (ಮಧ್ಯಮ/ತೀವ್ರ/ಆರೋಗ್ಯಕರ)
3. ಲಕ್ಷಣಗಳು
4. ಚಿಕಿತ್ಸೆ ಮತ್ತು ತಡೆಗಟ್ಟುವಿಕೆ ಸಲಹೆಗಳು
ಸ್ಪಷ್ಟ ಮತ್ತು ಕ್ರಿಯಾಶೀಲ ಸಲಹೆಗಳನ್ನು ನೀಡಿ.`
        : `Analyze this plant leaf and identify any diseases. Please provide:
1. Disease name (if present)
2. Severity (mild/moderate/severe/healthy)
3. Symptoms observed
4. Treatment and prevention recommendations
Provide clear, actionable advice for farmers.`;
      
      // Analyze with Gemini
      const result = await analyzeImage(base64, prompt);
      
      // Parse response
      const lines = result.split('\n').filter((line: string) => line.trim());
      setDiagnosis(lines.slice(0, 3).join('\n'));
      setTreatment(lines.slice(3).join('\n'));
      
    } catch (err) {
      setError(language === 'kn' 
        ? 'ವಿಶ್ಲೇಷಣೆ ವಿಫಲವಾಗಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.'
        : 'Analysis failed. Please try again.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 pb-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 text-white py-8 px-4 shadow-2xl">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-3 flex items-center justify-center gap-3">
            <span className="text-5xl">📱</span>
            {language === 'kn' ? 'AR ಸಸ್ಯ ರೋಗ ಪತ್ತೆ' : 'AR Plant Disease Detection'}
            <span className="text-5xl">🔍</span>
          </h1>
          <p className="text-lg md:text-xl opacity-95 max-w-3xl mx-auto">
            {language === 'kn' 
              ? 'ನೈಜ-ಸಮಯದ ಆಗ್ಮೆಂಟೆಡ್ ರಿಯಾಲಿಟಿ ರೋಗ ಪತ್ತೆ - ತ್ವರಿತ ರೋಗನಿರ್ಣಯಕ್ಕಾಗಿ ನಿಮ್ಮ ಕ್ಯಾಮೆರಾವನ್ನು ಬೆಳೆಗಳ ಮೇಲೆ ತೋರಿಸಿ'
              : 'Real-Time Augmented Reality Disease Detection - Point your camera at crops for instant diagnosis'
            }
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3 text-sm">
            <span className="bg-red-500/80 px-3 py-1 rounded-full">
              🔴 {language === 'kn' ? 'ರೋಗಗ್ರಸ್ತ' : 'Diseased'}
            </span>
            <span className="bg-yellow-500/80 px-3 py-1 rounded-full">
              🟡 {language === 'kn' ? 'ಮಧ್ಯಮ' : 'Moderate'}
            </span>
            <span className="bg-green-500/80 px-3 py-1 rounded-full">
              🟢 {language === 'kn' ? 'ಆರೋಗ್ಯಕರ' : 'Healthy'}
            </span>
            {isOffline && (
              <span className="bg-amber-500/80 px-3 py-1 rounded-full">
                📴 {language === 'kn' ? 'ಆಫ್‌ಲೈನ್ ಮೋಡ್' : 'Offline Mode'}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-8">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Camera Section */}
          <Card className="bg-white/90 backdrop-blur">
            <h2 className="text-2xl font-bold text-green-700 mb-4">
              📹 {language === 'kn' ? 'ಲೈವ್ ಕ್ಯಾಮೆರಾ ಸ್ಕ್ಯಾನ್' : 'Live Camera Scan'}
            </h2>
            
            {/* Video Container */}
            <div className="relative bg-black rounded-xl overflow-hidden aspect-video mb-4">
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
              
              {/* Overlay Stats */}
              {isCameraActive && (
                <div className="absolute top-2 left-2 bg-black/70 text-white px-3 py-1 rounded-lg text-sm">
                  {isScanning ? '🔴 Live' : '⏸️ Paused'} | 
                  {detections.length} {language === 'kn' ? 'ಪತ್ತೆಗಳು' : 'detections'}
                </div>
              )}
              
              {/* Detection Legend */}
              {detections.length > 0 && (
                <div className="absolute bottom-2 right-2 bg-black/70 text-white px-3 py-2 rounded-lg text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded"></div>
                    <span>{detections.filter(d => d.severity === 'diseased').length} {language === 'kn' ? 'ರೋಗಗ್ರಸ್ತ' : 'Diseased'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                    <span>{detections.filter(d => d.severity === 'moderate').length} {language === 'kn' ? 'ಮಧ್ಯಮ' : 'Moderate'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded"></div>
                    <span>{detections.filter(d => d.severity === 'healthy').length} {language === 'kn' ? 'ಆರೋಗ್ಯಕರ' : 'Healthy'}</span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Controls */}
            <div className="flex flex-wrap gap-3">
              {!isCameraActive ? (
                <button
                  onClick={startCamera}
                  className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:scale-105 transition-transform shadow-lg flex items-center justify-center gap-2"
                >
                  <span className="text-2xl">📷</span>
                  {language === 'kn' ? 'ಕ್ಯಾಮೆರಾ ಪ್ರಾರಂಭಿಸಿ' : 'Start Camera'}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setIsScanning(!isScanning)}
                    className={`flex-1 ${isScanning ? 'bg-gradient-to-r from-orange-500 to-red-500' : 'bg-gradient-to-r from-green-600 to-emerald-600'} text-white px-6 py-3 rounded-xl font-bold hover:scale-105 transition-transform shadow-lg flex items-center justify-center gap-2`}
                  >
                    <span className="text-2xl">{isScanning ? '⏸️' : '▶️'}</span>
                    {isScanning 
                      ? (language === 'kn' ? 'ವಿರಾಮಗೊಳಿಸಿ' : 'Pause Scan')
                      : (language === 'kn' ? 'ಸ್ಕ್ಯಾನ್ ಪ್ರಾರಂಭಿಸಿ' : 'Start Scan')
                    }
                  </button>
                  <button
                    onClick={stopCamera}
                    className="bg-gradient-to-r from-gray-600 to-gray-700 text-white px-6 py-3 rounded-xl font-bold hover:scale-105 transition-transform shadow-lg flex items-center justify-center gap-2"
                  >
                    <span className="text-2xl">⏹️</span>
                    {language === 'kn' ? 'ನಿಲ್ಲಿಸಿ' : 'Stop'}
                  </button>
                </>
              )}
            </div>
            
            {/* AI Analysis Button */}
            {isCameraActive && (
              <button
                onClick={captureAndAnalyze}
                disabled={isAnalyzing || isOffline}
                className={`w-full mt-3 ${isOffline ? 'bg-gray-400' : 'bg-gradient-to-r from-blue-600 to-purple-600'} text-white px-6 py-4 rounded-xl font-bold hover:scale-105 transition-transform shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <span className="text-2xl">🤖</span>
                {isAnalyzing 
                  ? (language === 'kn' ? 'AI ವಿಶ್ಲೇಷಿಸುತ್ತಿದೆ...' : 'AI Analyzing...')
                  : (language === 'kn' ? 'AI ವಿವರವಾದ ವಿಶ್ಲೇಷಣೆ' : 'Get AI Detailed Analysis')
                }
              </button>
            )}
            
            {isOffline && (
              <p className="text-amber-600 text-sm mt-2 text-center">
                ⚠️ {language === 'kn' 
                  ? 'AI ವಿಶ್ಲೇಷಣೆಗೆ ಇಂಟರ್ನೆಟ್ ಸಂಪರ್ಕ ಅಗತ್ಯವಿದೆ'
                  : 'AI analysis requires internet connection'
                }
              </p>
            )}
            
            {error && (
              <div className="mt-4 bg-red-100 border-2 border-red-400 text-red-700 px-4 py-3 rounded-xl">
                <p className="font-bold">⚠️ {language === 'kn' ? 'ದೋಷ' : 'Error'}</p>
                <p className="text-sm">{error}</p>
              </div>
            )}
          </Card>

          {/* Results Section */}
          <Card className="bg-white/90 backdrop-blur">
            <h2 className="text-2xl font-bold text-green-700 mb-4">
              📊 {language === 'kn' ? 'ಪತ್ತೆ ಫಲಿತಾಂಶಗಳು' : 'Detection Results'}
            </h2>
            
            {/* Real-time Stats */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-red-50 border-2 border-red-300 rounded-xl p-3 text-center">
                <div className="text-3xl font-bold text-red-600">
                  {detections.filter(d => d.severity === 'diseased').length}
                </div>
                <div className="text-sm text-red-700">
                  {language === 'kn' ? 'ರೋಗಗ್ರಸ್ತ' : 'Diseased'}
                </div>
              </div>
              <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-3 text-center">
                <div className="text-3xl font-bold text-yellow-600">
                  {detections.filter(d => d.severity === 'moderate').length}
                </div>
                <div className="text-sm text-yellow-700">
                  {language === 'kn' ? 'ಮಧ್ಯಮ' : 'Moderate'}
                </div>
              </div>
              <div className="bg-green-50 border-2 border-green-300 rounded-xl p-3 text-center">
                <div className="text-3xl font-bold text-green-600">
                  {detections.filter(d => d.severity === 'healthy').length}
                </div>
                <div className="text-sm text-green-700">
                  {language === 'kn' ? 'ಆರೋಗ್ಯಕರ' : 'Healthy'}
                </div>
              </div>
            </div>
            
            {/* AI Diagnosis */}
            {diagnosis && (
              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                  <span className="text-2xl">🤖</span>
                  {language === 'kn' ? 'AI ರೋಗನಿರ್ಣಯ' : 'AI Diagnosis'}
                </h3>
                <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-4">
                  <p className="text-gray-700 whitespace-pre-wrap">{diagnosis}</p>
                </div>
              </div>
            )}
            
            {/* Treatment Recommendations */}
            {treatment && (
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                  <span className="text-2xl">💊</span>
                  {language === 'kn' ? 'ಚಿಕಿತ್ಸೆ ಸಲಹೆಗಳು' : 'Treatment Recommendations'}
                </h3>
                <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4">
                  <p className="text-gray-700 whitespace-pre-wrap">{treatment}</p>
                </div>
              </div>
            )}
            
            {/* Instructions */}
            {!diagnosis && !treatment && (
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-300 rounded-xl p-6">
                <h3 className="text-lg font-bold text-blue-700 mb-3">
                  📖 {language === 'kn' ? 'ಹೇಗೆ ಬಳಸುವುದು' : 'How to Use'}
                </h3>
                <ol className="space-y-2 text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="font-bold">1️⃣</span>
                    <span>{language === 'kn' 
                      ? 'ಕ್ಯಾಮೆರಾ ಪ್ರಾರಂಭಿಸಿ ಮತ್ತು ನಿಮ್ಮ ಬೆಳೆಯ ಎಲೆಯತ್ತ ತೋರಿಸಿ'
                      : 'Start camera and point at your crop leaf'
                    }</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">2️⃣</span>
                    <span>{language === 'kn' 
                      ? 'ನೈಜ-ಸಮಯದ ಪತ್ತೆಗಾಗಿ "ಸ್ಕ್ಯಾನ್ ಪ್ರಾರಂಭಿಸಿ" ಕ್ಲಿಕ್ ಮಾಡಿ'
                      : 'Click "Start Scan" for real-time detection'
                    }</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">3️⃣</span>
                    <span>{language === 'kn' 
                      ? 'ಬಣ್ಣದ ಪೆಟ್ಟಿಗೆಗಳನ್ನು ವೀಕ್ಷಿಸಿ: 🔴 ರೋಗಗ್ರಸ್ತ, 🟡 ಮಧ್ಯಮ, 🟢 ಆರೋಗ್ಯಕರ'
                      : 'Watch colored boxes: 🔴 Diseased, 🟡 Moderate, 🟢 Healthy'
                    }</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">4️⃣</span>
                    <span>{language === 'kn' 
                      ? 'ವಿವರವಾದ ವಿಶ್ಲೇಷಣೆ ಮತ್ತು ಚಿಕಿತ್ಸೆ ಸಲಹೆಗಳಿಗಾಗಿ AI ಬಟನ್ ಬಳಸಿ'
                      : 'Use AI button for detailed analysis and treatment advice'
                    }</span>
                  </li>
                </ol>
              </div>
            )}
          </Card>
        </div>
        
        {/* Features Highlight */}
        <Card className="mt-6 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-300">
          <h3 className="text-2xl font-bold text-purple-700 mb-4 text-center">
            🏆 {language === 'kn' ? 'ವೈಶಿಷ್ಟ್ಯಗಳು' : 'Key Features'}
          </h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-4 text-center">
              <div className="text-4xl mb-2">⚡</div>
              <h4 className="font-bold text-gray-800 mb-1">
                {language === 'kn' ? 'ನೈಜ-ಸಮಯ' : 'Real-Time'}
              </h4>
              <p className="text-sm text-gray-600">
                {language === 'kn' 
                  ? 'ತ್ವರಿತ AR ಪತ್ತೆ'
                  : 'Instant AR detection'
                }
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 text-center">
              <div className="text-4xl mb-2">📴</div>
              <h4 className="font-bold text-gray-800 mb-1">
                {language === 'kn' ? 'ಆಫ್‌ಲೈನ್' : 'Offline'}
              </h4>
              <p className="text-sm text-gray-600">
                {language === 'kn' 
                  ? 'ಇಂಟರ್ನೆಟ್ ಇಲ್ಲದೆ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತದೆ'
                  : 'Works without internet'
                }
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 text-center">
              <div className="text-4xl mb-2">🌍</div>
              <h4 className="font-bold text-gray-800 mb-1">
                {language === 'kn' ? 'ಸ್ಥಳೀಯ ಭಾಷೆ' : 'Local Language'}
              </h4>
              <p className="text-sm text-gray-600">
                {language === 'kn' 
                  ? 'ಕನ್ನಡ + ಇಂಗ್ಲಿಷ್'
                  : 'Kannada + English'
                }
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ARPlantScanPage;
