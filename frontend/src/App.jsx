import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import TopicMap from './pages/TopicMap.jsx'
import Problems from './pages/Problems.jsx'
import ProblemSolve from './pages/ProblemSolve.jsx'
import Readiness from './pages/Readiness.jsx'
import Mistakes from './pages/Mistakes.jsx'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/topics" element={<TopicMap />} />
        <Route path="/problems" element={<Problems />} />
        <Route path="/problems/:id" element={<ProblemSolve />} />
        <Route path="/readiness" element={<Readiness />} />
        <Route path="/mistakes" element={<Mistakes />} />
        <Route path="*" element={<p>Page not found.</p>} />
      </Routes>
    </Layout>
  )
}
