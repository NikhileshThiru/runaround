import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Landing from '@/pages/Landing'
import { AthleteProvider } from '@/context/AthleteContext'
import AppErrorBoundary from '@/components/shared/AppErrorBoundary'

const Dashboard = lazy(() => import('@/pages/Dashboard'))

export default function App() {
  return (
    <AppErrorBoundary>
      <AthleteProvider>
        <Suspense fallback={<div className="min-h-screen bg-void" />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AthleteProvider>
    </AppErrorBoundary>
  )
}
