import React from 'react';
import { Link } from 'react-router-dom';
import { APP_NAME } from '../constants'; // APP_AUTHORS removed as it's handled by translate
import Card from '../components/Card';
import { useLanguage } from '../contexts/LanguageContext';
import PlantCareLogo from '../components/PlantCareLogo';

interface Feature {
  emoji: string;
  title: string;
  desc: string;
}

const LandingPage: React.FC = () => {
  const { translate } = useLanguage();

  const features: Feature[] = [
    {
      emoji: '🔍',
      title: 'Instant Analysis',
      desc: 'Real-time plant disease detection using advanced AI technology',
    },
    {
      emoji: '💊',
      title: 'Treatment Guide',
      desc: 'Detailed treatment recommendations and preventive measures',
    },
    {
      emoji: '📱',
      title: 'Easy to Use',
      desc: 'Simple interface with camera and upload options',
    },
    {
      emoji: '📊',
      title: 'Analysis History',
      desc: 'Track all your previous plant analyses',
    },
  ];

  const moreFeatures: Feature[] = [
    {
      emoji: '🌐',
      title: 'Multilingual Support',
      desc: 'Access the app in 100+ languages for global reach',
    },
    {
      emoji: '🌦️',
      title: 'Weather Insights',
      desc: 'Get real-time weather data and farming advice',
    },
    {
      emoji: '🔔',
      title: 'Smart Notifications',
      desc: 'Personalized reminders for plant care and updates',
    },
    {
      emoji: '🤝',
      title: 'Community Hub',
      desc: 'Connect, share, and learn with fellow plant lovers',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-green-50 via-white to-green-100">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center text-center py-20 px-4 sm:px-0">
        <div className="mb-6">
          <PlantCareLogo size={96} />
        </div>
        <h1 className="text-5xl sm:text-7xl font-extrabold text-green-800 mb-4 leading-tight capitalize drop-shadow-lg">
          {translate(APP_NAME)}
        </h1>
        <p className="text-xl sm:text-2xl text-gray-700 max-w-2xl mx-auto leading-relaxed mb-8">
          {translate('appCatchphrase')}
        </p>
        <Link to="/scan" className="inline-block px-10 py-4 bg-green-600 text-white text-xl font-bold rounded-full shadow-lg hover:scale-105 hover:bg-green-700 transition-all duration-300">
          Get Started
        </Link>
      </section>

      {/* Features Section */}
      <section className="w-full py-12 px-2 bg-gradient-to-b from-white to-green-50">
        <h2 className="text-4xl font-bold text-gray-800 text-center mb-12">Key Features</h2>
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="bg-white rounded-3xl shadow-xl p-8 flex flex-col items-center text-center transition-transform duration-300 hover:-translate-y-2 hover:shadow-2xl animate-fade-in-up"
              style={{ animationDelay: `${i * 0.1 + 0.2}s` }}
            >
              <div className="text-5xl mb-4 drop-shadow-lg">{f.emoji}</div>
              <div className="text-2xl font-bold text-gray-800 mb-2">{f.title}</div>
              <div className="text-gray-600 text-base">{f.desc}</div>
            </div>
          ))}
        </div>
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-16">
          {moreFeatures.map((f, i) => (
            <div
              key={f.title}
              className="bg-white rounded-3xl shadow-xl p-8 flex flex-col items-center text-center transition-transform duration-300 hover:-translate-y-2 hover:shadow-2xl animate-fade-in-up"
              style={{ animationDelay: `${(i + 4) * 0.1 + 0.2}s` }}
            >
              <div className="text-5xl mb-4 drop-shadow-lg">{f.emoji}</div>
              <div className="text-2xl font-bold text-gray-800 mb-2">{f.title}</div>
              <div className="text-gray-600 text-base">{f.desc}</div>
            </div>
          ))}
        </div>

        {/* How It Works Section */}
        <h2 className="text-4xl font-bold text-gray-800 text-center mb-12">How It Works</h2>
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-stretch justify-center gap-8 relative">
          {/* Connecting line (desktop only) */}
          <div className="hidden md:block absolute left-0 right-0 top-1/2 h-0.5 bg-green-200 z-0" style={{marginTop: '-1px'}} />
          {[
            {
              num: 1,
              title: 'Upload Image',
              desc: 'Take a photo or upload an image of your plant for instant analysis',
            },
            {
              num: 2,
              title: 'AI Analysis',
              desc: 'Our advanced AI technology analyzes your plant for diseases and health issues',
            },
            {
              num: 3,
              title: 'Get Results',
              desc: 'Receive detailed diagnosis and personalized treatment recommendations',
            },
          ].map((step, i) => (
            <div key={step.num} className="relative bg-white rounded-3xl shadow-xl flex-1 p-8 flex flex-col items-center text-center z-10 animate-fade-in-up" style={{ animationDelay: `${i * 0.15 + 0.2}s` }}>
              <div className="mb-6">
                <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center text-3xl font-bold text-white shadow-lg mx-auto mb-2 ring-4 ring-green-200" style={{boxShadow: '0 0 0 8px #bbf7d0, 0 4px 24px 0 #22c55e33'}}>
                  {step.num}
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-800 mb-2">{step.title}</div>
              <div className="text-gray-600 text-base">{step.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-green-800 to-green-600 text-white py-12 mt-auto border-t-4 border-green-400">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between mb-6">
            <div className="flex items-center gap-3 mb-4 md:mb-0">
              <PlantCareLogo size={48} />
              <div>
                <div className="font-bold text-2xl">{translate(APP_NAME)}</div>
                <div className="text-green-200 text-sm">Smart Agriculture Solutions</div>
              </div>
            </div>
            <div className="flex gap-6 text-lg">
              <a href="https://github.com/Mithuncoding/plantnag4" target="_blank" rel="noopener noreferrer" className="hover:text-green-300 transition-colors flex items-center gap-2">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                GitHub
              </a>
              <a href="mailto:contact@growsmart.ai" className="hover:text-green-300 transition-colors flex items-center gap-2">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
                Contact
              </a>
            </div>
          </div>
          <div className="border-t border-green-500 pt-6 text-center">
            <p className="text-green-100 text-base mb-2">
              Crafted with <span className="text-red-400 animate-pulse">💚</span> by <span className="font-bold text-green-200">Mithun & Manoj</span>
            </p>
            <p className="text-green-300 text-sm">
              © {new Date().getFullYear()} GrowSmart. All Rights Reserved. | Empowering Farmers with AI Technology
            </p>
          </div>
        </div>
      </footer>

      {/* Animations */}
      <style>{`
        @keyframes fade-in-up { 0% { opacity: 0; transform: translateY(40px); } 100% { opacity: 1; transform: translateY(0); } }
        .animate-fade-in-up { animation: fade-in-up 0.8s cubic-bezier(0.23, 1, 0.32, 1) both; }
      `}</style>
    </div>
  );
};

export default LandingPage;