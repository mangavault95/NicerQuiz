import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './stili.css';
import './stili-editor.css';

createRoot(document.getElementById('radice')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
