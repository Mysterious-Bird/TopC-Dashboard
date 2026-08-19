import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Members from './pages/Members'
import Contests from './pages/Contests'
import Teams from './pages/Teams'
import GraphPage from './pages/GraphPage'
import Reminders from './pages/Reminders'
import Awards from './pages/Awards'
import McpPage from './pages/McpPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="members" element={<Members />} />
        <Route path="contests" element={<Contests />} />
        <Route path="teams" element={<Teams />} />
        <Route path="graph" element={<GraphPage />} />
        <Route path="reminders" element={<Reminders />} />
        <Route path="awards" element={<Awards />} />
        <Route path="mcp" element={<McpPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
