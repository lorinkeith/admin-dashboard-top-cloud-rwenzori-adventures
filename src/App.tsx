import { BlogListPage } from './pages/blog/BlogListPage'
import { lazy, Suspense } from 'react'
import { PostPreviewPage } from './pages/blog/PostPreviewPage'
import { Navigate, Route, Routes } from 'react-router-dom'
import AdminLayout from './components/layout/AdminLayout'
import ProtectedRoute from './components/layout/ProtectedRoute'
import LoginPage from './pages/auth/LoginPage'
import AnalyticsPage from './pages/analytics/AnalyticsPage'
import BookingsPage from './pages/bookings/BookingsPage'
import InquiriesPage from './pages/inquiries/InquiriesPage'
import EditPackagePage from './pages/packages/EditPackagePage'
import NewPackagePage from './pages/packages/NewPackagePage'
import PackagesPage from './pages/packages/PackagesPage'

const PostEditorPage = lazy(() => import('./pages/blog/PostEditorPage').then(module => ({ default: module.PostEditorPage })))

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/packages" replace />} />
        <Route path="/blog" element={<BlogListPage />} />
        <Route path="/blog/new" element={<Suspense fallback={<p role="status">Loading blog editor...</p>}><PostEditorPage mode="new" /></Suspense>} />
        <Route path="/blog/:id/edit" element={<Suspense fallback={<p role="status">Loading blog editor...</p>}><PostEditorPage mode="edit" /></Suspense>} />
        <Route path="/blog/:id/preview" element={<PostPreviewPage />} />
        <Route path="/categories" element={<Navigate to="/blog?panel=categories" replace />} />
        <Route path="/tags" element={<Navigate to="/blog?panel=tags" replace />} />
        <Route path="/media" element={<Navigate to="/blog?panel=media" replace />} />
        <Route path="/comments" element={<Navigate to="/blog?panel=comments" replace />} />
        <Route path="/packages" element={<PackagesPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/packages/new" element={<NewPackagePage />} />
        <Route path="/packages/:id/edit" element={<EditPackagePage />} />
        <Route path="/bookings" element={<BookingsPage />} />
        <Route path="/inquiries" element={<InquiriesPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/packages" replace />} />
    </Routes>
  )
}

export default App
