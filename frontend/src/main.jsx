import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import GetEpd from './pages/GetEpd';
import Contacts from './pages/Contacts';
import Admin from './pages/Admin';
import './styles.css';
import { I18nProvider } from './i18n';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <I18nProvider>
      <BrowserRouter>
        <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/get-epd" element={<GetEpd />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
        </Layout>
      </BrowserRouter>
    </I18nProvider>
  </React.StrictMode>
);
