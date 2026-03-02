import { Link, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n';

const NavLink = ({ to, children }) => {
  const { pathname } = useLocation();
  const active = pathname === to;
  return (
    <Link className={`nav-link ${active ? 'active' : ''}`} to={to}>
      {children}
    </Link>
  );
};

export default function Layout({ children }) {
  const { lang, setLang, t } = useI18n();

  return (
    <div className="app">
      <header className="site-header">
        <div className="container nav">
          <div>
            <p className="brand-title">{t('brandTitle')}</p>
            <p className="brand-subtitle">{t('brandSubtitle')}</p>
          </div>
          <nav>
            <NavLink to="/">{t('navHome')}</NavLink>
            <NavLink to="/get-epd">{t('navGet')}</NavLink>
            <NavLink to="/contacts">{t('navContacts')}</NavLink>
          </nav>
          <div className="lang-switch">
            <button type="button" className={lang === 'ru' ? 'lang-btn active' : 'lang-btn'} onClick={() => setLang('ru')}>{t('langRu')}</button>
            <button type="button" className={lang === 'kz' ? 'lang-btn active' : 'lang-btn'} onClick={() => setLang('kz')}>{t('langKz')}</button>
          </div>
        </div>
      </header>
      <main className="container">{children}</main>
      <footer>
        <div className="container footer-row">
          <span>© {new Date().getFullYear()} {t('footerCopyright')}</span>
          <Link to="/admin">{t('adminLogin')}</Link>
        </div>
      </footer>
    </div>
  );
}
