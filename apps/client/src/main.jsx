import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import { gameTransport } from './transport.js';
import '../style.css';
createRoot(document.querySelector('#root')).render(<StrictMode><App transport={gameTransport}/></StrictMode>);
