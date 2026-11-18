import { lazy } from 'react'
import { Link, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import AnimatedRoutes from './components/AnimatedRoutes.jsx'
import { EmptyState } from './components/Status.jsx'
import Dashboard from './pages/Dashboard.jsx'

// The landing page ships in the main bundle; every other page (and its heavy libraries: the code
// editor, charts, Markdown) is downloaded only when first opened.
const TopicMap = lazy(() => import('./pages/TopicMap.jsx'))
const Problems = lazy(() => import('./pages/Problems.jsx'))
const ProblemSolve = lazy(() => import('./pages/ProblemSolve.jsx'))
const Readiness = lazy(() => import('./pages/Readiness.jsx'))
const Mistakes = lazy(() => import('./pages/Mistakes.jsx'))
const Plans = lazy(() => import('./pages/Plans.jsx'))
const Mock = lazy(() => import('./pages/Mock.jsx'))

export default function App() {
  return (
    <Layout>
      <AnimatedRoutes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/topics" element={<TopicMap />} />
        <Route path="/problems" element={<Problems />} />
        <Route path="/problems/:id" element={<ProblemSolve />} />
        <Route path="/plans" element={<Plans />} />
        <Route path="/mock" element={<Mock />} />
        <Route path="/readiness" element={<Readiness />} />
        <Route path="/mistakes" element={<Mistakes />} />
        <Route path="*" element={
          <EmptyState action={<Link to="/" className="btn btn-primary mt-1">Go to Today</Link>}>
            This page does not exist.
          </EmptyState>
        } />
      </AnimatedRoutes>
    </Layout>
  )
}
