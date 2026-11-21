import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { ThemeProvider } from './theme/ThemeProvider'
import RequireOnboarding from './components/RequireOnboarding'
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
import OnboardingPage from './pages/onboarding/OnboardingPage'
import BrandKitPage from './pages/BrandKitPage'
import CalendarPage from './pages/CalendarPage'
import PlansCreditsPage from './pages/PlansCreditsPage'

function AppGate({ children }: { children: ReactNode }) {
  return <RequireOnboarding>{children}</RequireOnboarding>
}

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
            <Route path="/onboarding" element={<Navigate to="/onboarding/personal" replace />} />
            <Route path="/onboarding/welcome" element={<Navigate to="/onboarding/personal" replace />} />
            <Route path="/onboarding/industry" element={<Navigate to="/onboarding/personal" replace />} />
            <Route path="/onboarding/business" element={<Navigate to="/onboarding/personal" replace />} />
            <Route path="/onboarding/review" element={<Navigate to="/onboarding/brand" replace />} />
            <Route path="/onboarding/learning" element={<Navigate to="/onboarding/scanning" replace />} />
            <Route path="/onboarding/strategy" element={<Navigate to="/onboarding/goals" replace />} />
            <Route path="/onboarding/channels" element={<Navigate to="/onboarding/goals" replace />} />
            <Route path="/onboarding/mix" element={<Navigate to="/onboarding/goals" replace />} />
            <Route path="/onboarding/style" element={<Navigate to="/onboarding/goals" replace />} />
            <Route path="/onboarding/freedom" element={<Navigate to="/onboarding/goals" replace />} />
            <Route path="/onboarding/paywall" element={<Navigate to="/onboarding/plan" replace />} />
            <Route path="/onboarding/building" element={<Navigate to="/onboarding/plan" replace />} />
            <Route path="/onboarding/ready" element={<Navigate to="/onboarding/plan" replace />} />
            <Route path="/onboarding/:step" element={<OnboardingPage />} />
            <Route
              path="/app"
              element={
                <AppGate>
                  <DashboardPage />
                </AppGate>
              }
            />
            <Route
              path="/app/products"
              element={
                <AppGate>
                  <ProductsPage />
                </AppGate>
              }
            />
            <Route
              path="/app/library"
              element={
                <AppGate>
                  <LibraryPage />
                </AppGate>
              }
            />
            <Route
              path="/app/settings"
              element={
                <AppGate>
                  <SettingsPage />
                </AppGate>
              }
            />
            <Route
              path="/app/brand"
              element={
                <AppGate>
                  <BrandKitPage />
                </AppGate>
              }
            />
            <Route
              path="/app/calendar"
              element={
                <AppGate>
                  <CalendarPage />
                </AppGate>
              }
            />
            <Route
              path="/app/plans"
              element={
                <AppGate>
                  <PlansCreditsPage />
                </AppGate>
              }
            />
            <Route
              path="/app/campaigns/new"
              element={
                <AppGate>
                  <NewCampaignPage />
                </AppGate>
              }
            />
            <Route
              path="/app/campaigns/:campaignId"
              element={
                <AppGate>
                  <CampaignDetailPage />
                </AppGate>
              }
            />
            <Route
              path="/app/campaigns"
              element={
                <AppGate>
                  <CampaignsPage />
                </AppGate>
              }
            />
            <Route
              path="/app/studio/ads"
              element={
                <AppGate>
                  <AdsSocialRoute />
                </AppGate>
              }
            />
            <Route
              path="/app/studio/:kind"
              element={
                <AppGate>
                  <StudioPage />
                </AppGate>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
