import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import LandingPage from './App'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import NewCampaignPage from './pages/NewCampaignPage'
import CampaignDetailPage from './pages/CampaignDetailPage'
import StudioPage from './pages/StudioPage'
import WorkspaceStubPage from './pages/WorkspaceStubPage'

export default function AppRouter() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/app" element={<DashboardPage />} />
          <Route path="/app/products" element={<WorkspaceStubPage />} />
          <Route path="/app/library" element={<WorkspaceStubPage />} />
          <Route path="/app/settings" element={<WorkspaceStubPage />} />
          <Route path="/app/campaigns/new" element={<NewCampaignPage />} />
          <Route path="/app/campaigns/:campaignId" element={<CampaignDetailPage />} />
          <Route path="/app/campaigns" element={<WorkspaceStubPage />} />
          <Route path="/app/studio/:kind" element={<StudioPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
