import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Board } from './Board'
import { WatchDetail } from './WatchDetail'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Board />} />
        <Route path="/w/:id" element={<WatchDetail />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
