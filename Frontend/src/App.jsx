import { lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell, RequireAuth } from './components/layout/AppShell'
import { LandingPage } from './pages/LandingPage'
import { AuthPage } from './pages/AuthPage'
import { TripsPage } from './pages/TripsPage'
import { TripWorkspacePage } from './pages/TripWorkspacePage'
import { JoinInvitePage } from './pages/JoinInvitePage'
import { NotFoundPage } from './pages/NotFoundPage'

// Tabs are code-split: the map (Leaflet) and drag-and-drop only load when needed.
const ItineraryTab = lazy(() => import('./features/itinerary/ItineraryTab'))
const PlacesTab = lazy(() => import('./features/places/PlacesTab'))
const ExpensesTab = lazy(() => import('./features/expenses/ExpensesTab'))
const PackingTab = lazy(() => import('./features/packing/PackingTab'))

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<LandingPage />} />
          <Route path="login" element={<AuthPage mode="login" />} />
          <Route path="signup" element={<AuthPage mode="signup" />} />
          <Route
            path="trips"
            element={
              <RequireAuth>
                <TripsPage />
              </RequireAuth>
            }
          />
          <Route
            path="trips/:tripId"
            element={
              <RequireAuth>
                <TripWorkspacePage />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="itinerary" replace />} />
            <Route path="itinerary" element={<ItineraryTab />} />
            <Route path="places" element={<PlacesTab />} />
            <Route path="budget" element={<ExpensesTab />} />
            <Route path="packing" element={<PackingTab />} />
          </Route>
          {/* Email invites: public preview, login required to accept */}
          <Route path="join-trip" element={<JoinInvitePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
