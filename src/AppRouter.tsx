import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { ThemeProvider } from './theme/ThemeProvider'
import LandingPage from './App'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import NewCampaignPage from './pages/NewCampaignPage'
import CampaignDetailPage from './pages/CampaignDetailPage'
import CampaignsPage from './pages/CampaignsPage'
import ProductsPage from './pages/ProductsPage'
import LibraryPage from './pages/LibraryPage'
import StudioPage from './pages/StudioPage'
import { AdsSocialRoute } from './pages/AdsSocialPage'
import SettingsPage from './pages/SettingsPage'
import LegalPage from './pages/LegalPage'
import HiwShotsPage from './pages/HiwShotsPage'

export default function AppRouter() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/privacy" element={<LegalPage />} />
            <Route path="/terms" element={<LegalPage />} />
            <Route path="/cookies" element={<LegalPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/app" element={<DashboardPage />} />
            <Route path="/app/products" element={<ProductsPage />} />
            <Route path="/app/library" element={<LibraryPage />} />
            <Route path="/app/settings" element={<SettingsPage />} />
            <Route path="/app/campaigns/new" element={<NewCampaignPage />} />
            <Route path="/app/campaigns/:campaignId" element={<CampaignDetailPage />} />
            <Route path="/app/campaigns" element={<CampaignsPage />} />
            <Route path="/app/studio/ads" element={<AdsSocialRoute />} />
            <Route path="/app/studio/:kind" element={<StudioPage />} />
            <Route path="/demo/hiw" element={<HiwShotsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
