# GrowSmart - Project Setup Notes

## API Keys (Hardcoded for School Project)

### Gemini API Key
**Location:** `services/geminiService.ts`
**Value:** `AIzaSyBaPW9f5Xpy3fh8YODCMQKQbNW99jKNjFQ`

This API key is hardcoded directly in the geminiService.ts file and is used for:
- Plant health diagnosis
- Encyclopedia search
- Crop insights generation
- Weather-based farming advice
- All AI-powered features

### Google Maps API Key (Reference Only)
**Value:** `AIzaSyD5ZG9hqKY1-pqN_T4_B3X_f11MFeghLUI`

**Note:** The project currently uses OpenStreetMap (via Leaflet library) which is free and doesn't require an API key. The Google Maps API key is documented in `index.html` as a comment for future reference if you decide to switch to Google Maps.

If you want to use Google Maps instead of OpenStreetMap:
1. Check the old version: `pages/FarmerConnectPage_old.tsx`
2. Uncomment the Google Maps script in `index.html` with the API key
3. Replace the current FarmerConnectPage.tsx with the old version

## Project Name Changes

The project has been renamed from "PlantCare AI" to "GrowSmart". Changes made in:

### Files Updated:
1. **constants.ts** - APP_NAME constant
2. **package.json** - name field: "growsmart"
3. **index.html** - title tag: "GrowSmart"
4. **metadata.json** - name field: "GrowSmart"
5. **i18n/translations.ts** - appName: "GrowSmart"
6. **pages/LandingPage.tsx** - footer copyright and email
7. **services/localStorageService.ts** - localStorage keys
8. **plantcare-backend/package.json** - name: "growsmart-backend"
9. **README.md** - title and description

### What Still Uses Old Names:
- Documentation files (QUICK_START_GUIDE.md, ENHANCEMENT_ROADMAP.md, MONETIZATION_GUIDE.md, etc.)
- These are reference documents and don't affect the running application

## Running the Project

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

The Gemini API key is already hardcoded, so no environment variables need to be set.

## Project Structure

- **Frontend:** React + TypeScript + Vite
- **Map Service:** OpenStreetMap (Leaflet) - Free, no API key needed
- **AI Service:** Google Gemini API (hardcoded key)
- **Styling:** TailwindCSS

## Notes for School Project

This setup is simplified for educational purposes with hardcoded API keys. In a production environment, you would:
- Use environment variables (.env files) for API keys
- Never commit API keys to version control
- Use backend proxies to hide API keys from client-side code
- Implement proper API key rotation and security measures
