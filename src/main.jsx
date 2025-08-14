import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
import iconUrl from '../images/icon.png'

// Ensure favicon uses the bundled asset URL so it works after build
const ensureFavicon = () => {
	try {
		let link = document.querySelector("link[rel='icon']");
		if (!link) {
			link = document.createElement('link');
			link.rel = 'icon';
			document.head.appendChild(link);
		}
		link.type = 'image/png';
		link.href = iconUrl;
	} catch {}
};

ensureFavicon();

createRoot(document.getElementById('root')).render(<App />)
