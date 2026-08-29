import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Shell from './layout/Shell'
import Execution from './pages/Execution'
import Landing from './pages/Landing'
import MerchantBrief from './pages/MerchantBrief'
import ModelLab from './pages/ModelLab'
import Strategy from './pages/Strategy'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route path="/" element={<Landing />} />
          <Route path="/strategy" element={<Strategy />} />
          <Route path="/execution" element={<Execution />} />
          <Route path="/merchant" element={<MerchantBrief />} />
          <Route path="/merchant/:merchantId" element={<MerchantBrief />} />
          <Route path="/model" element={<ModelLab />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
