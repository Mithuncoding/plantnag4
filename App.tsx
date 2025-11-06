
import React, { Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.tsx';
import LoadingSpinner from './components/LoadingSpinner.tsx';
import { LanguageProvider } from './contexts/LanguageContext.tsx';

// Static imports for all page components using correct relative paths
import LandingPage from './pages/LandingPage.tsx';
import PlantScanPage from './pages/PlantScanPage.tsx';
import EncyclopediaPage from './pages/EncyclopediaPage.tsx';
import CropInsightsPage from './pages/CropInsightsPage.tsx';
import ScanHistoryPage from './pages/ScanHistoryPage.tsx';
import CommunityHubPage from './pages/CommunityHubPage.tsx';
import FarmerConnectPage from './pages/FarmerConnectPage.tsx';
import ARPlantScanPage from './pages/ARPlantScanPage.tsx'; // AR Disease Detection

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <HashRouter>
        <Layout>
          <Suspense fallback={<div className="flex justify-center items-center h-full"><LoadingSpinner text="Loading page..." size="lg"/></div>}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/scan" element={<PlantScanPage />} />
              <Route path="/ar-scan" element={<ARPlantScanPage />} /> {/* AR Disease Detection */}
              <Route path="/encyclopedia" element={<EncyclopediaPage />} />
              <Route path="/crop-insights" element={<CropInsightsPage />} />
              <Route path="/history" element={<ScanHistoryPage />} />
              <Route path="/community" element={<CommunityHubPage />} />
              <Route path="/farmer-connect" element={<FarmerConnectPage />} /> {/* New Route */}
              <Route path="*" element={<Navigate to="/" replace />} /> {/* Fallback route */}
            </Routes>
          </Suspense>
        </Layout>
      </HashRouter>
    </LanguageProvider>
  );
};

export default App;