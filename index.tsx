import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './src/index.css';

// The Gemini API key check is more robustly handled within geminiService.ts,
// where it prevents API calls if the key is missing.
// The Google Maps API key is loaded directly in index.html.

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to. Make sure an element with id='root' exists in your HTML.");
}

const root = ReactDOM.createRoot(rootElement);

// Inject Google Maps script dynamically
const injectGoogleMapsScript = () => {
  if (document.getElementById('google-maps-script')) return;
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error('Google Maps API key is missing!');
    return;
  }
  window.initMap = function () {
    console.log("[PlantCareAI] Google Maps API script has executed and 'initMap' callback is now running.");
    console.log("[PlantCareAI] Dispatching 'google-maps-loaded' event.");
    window.dispatchEvent(new CustomEvent('google-maps-loaded'));
    console.log("[PlantCareAI] 'google-maps-loaded' event dispatched.");
  };
  const script = document.createElement('script');
  script.id = 'google-maps-script';
  script.async = true;
  script.defer = true;
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker,routes,visualization&callback=initMap`;
  document.head.appendChild(script);
};

injectGoogleMapsScript();

// Declare initMap on the Window interface
declare global {
  interface Window {
    initMap: () => void;
  }
}

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);