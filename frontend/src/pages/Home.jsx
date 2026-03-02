import { Link } from 'react-router-dom';
import AdBanner from '../components/AdBanner';
import { useI18n } from '../i18n';

export default function Home() {
  const { t } = useI18n();

  return (
    <section>
      <div className="hero card">
        <p className="eyebrow">{t('homeEyebrow')}</p>
        <h1>{t('homeTitle')}</h1>
        <p>{t('homeDesc')}</p>
        <div className="hero-actions">
          <Link to="/get-epd" className="btn">{t('navGet')}</Link>
          <Link to="/contacts" className="btn btn-secondary">{t('navContacts')}</Link>
        </div>
      </div>

      <div className="feature-grid">
        <div className="card">
          <h3>{t('featureSearchTitle')}</h3>
          <p>{t('featureSearchDesc')}</p>
        </div>
        <div className="card">
          <h3>{t('featureViewerTitle')}</h3>
          <p>{t('featureViewerDesc')}</p>
        </div>
        <div className="card">
          <h3>{t('featureSecureTitle')}</h3>
          <p>{t('featureSecureDesc')}</p>
        </div>
      </div>

      <AdBanner />

      <div className="card">
        <h3>{t('howToTitle')}</h3>
        <ol>
          <li>{t('howToStep1')}</li>
          <li>{t('howToStep2')}</li>
          <li>{t('howToStep3')}</li>
        </ol>
      </div>
    </section>
  );
}
