import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import CampaignApp from './CampaignApp';
import '@fontsource-variable/golos-text';
import '@fontsource/pt-serif/400.css';
import '@fontsource/pt-serif/400-italic.css';
import './styles.css';

const standaloneFirstCase = new URLSearchParams(window.location.search).get('case') === '001';
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode>{standaloneFirstCase ? <App /> : <CampaignApp />}</React.StrictMode>);
