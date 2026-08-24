import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { TrialPage } from './pages/TrialPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/trial/:trialId" element={<TrialPage />} />
      </Routes>
    </BrowserRouter>
  );
}
