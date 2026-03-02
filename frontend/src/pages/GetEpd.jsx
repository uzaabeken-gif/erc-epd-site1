import { useEffect, useState } from 'react';
import { api, API_URL } from '../api/client';
import PdfViewer from '../components/PdfViewer';
import AdBanner from '../components/AdBanner';
import { useI18n } from '../i18n';

export default function GetEpd() {
  const { t } = useI18n();
  const [tab, setTab] = useState('account');
  const [account, setAccount] = useState('');
  const [address, setAddress] = useState({ settlement: '', street: '', house: '', apartment: '' });
  const [periods, setPeriods] = useState([]);
  const [period, setPeriod] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    api.get('/public/periods')
      .then(({ data }) => {
        const list = data.periods || [];
        setPeriods(list);
        if (list.length) setPeriod(list[0]);
      })
      .catch(() => {
        setPeriods([]);
      });
  }, []);

  const search = async () => {
    setError('');
    setReceipt(null);
    setReceipts([]);
    setIsLoading(true);

    try {
      const base = tab === 'account' ? { account } : address;
      const payload = period ? { ...base, period } : base;
      const endpoint = tab === 'account' ? '/public/search-by-account' : '/public/search-by-address';
      const { data } = await api.post(endpoint, payload);
      setReceipt(data.receipt);
      setReceipts(data.receipts || (data.receipt ? [data.receipt] : []));
    } catch (e) {
      if (e.response?.status === 404) setError(t('notFound'));
      else setError(e.response?.data?.message || t('searchError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section>
      <h1>{t('getTitle')}</h1>
      <p className="muted">{t('getIntro')}</p>

      <div className="card form-grid two-columns" style={{ marginBottom: 12 }}>
        <label>{t('periodLabel')}
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            {!periods.length && <option value="">{t('latestPeriod')}</option>}
            {periods.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
      </div>

      <div className="tabs">
        <button className={tab === 'account' ? 'active' : ''} onClick={() => setTab('account')}>{t('searchByAccount')}</button>
        <button className={tab === 'address' ? 'active' : ''} onClick={() => setTab('address')}>{t('searchByAddress')}</button>
      </div>

      {tab === 'account' ? (
        <div className="card form-grid two-columns">
          <label>{t('accountLabel')}
            <input value={account} onChange={(e) => setAccount(e.target.value)} placeholder={t('accountPlaceholder')} />
          </label>
          <div className="form-action">
            <button className="btn" onClick={search} disabled={isLoading}>{isLoading ? t('searching') : t('uploadBtn')}</button>
          </div>
        </div>
      ) : (
        <div className="card form-grid two-columns">
          {['settlement', 'street', 'house', 'apartment'].map((key) => (
            <label key={key}>{key === 'settlement' ? t('settlement') : key === 'street' ? t('street') : key === 'house' ? t('house') : t('apartment')}
              <input
                value={address[key]}
                onChange={(e) => setAddress({ ...address, [key]: e.target.value })}
                placeholder={key === 'settlement' ? t('settlementPlaceholder') : ''}
              />
            </label>
          ))}
          <div className="form-action">
            <button className="btn" onClick={search} disabled={isLoading}>{isLoading ? t('searching') : t('uploadBtn')}</button>
          </div>
        </div>
      )}

      <AdBanner />

      {error && <p className="error card">{error}</p>}

      {receipts.length > 1 && (
        <div className="card">
          <h3>{t('receiptsFound')}: {receipts.length}</h3>
          <p className="muted">{t('chooseReceipt')}</p>
          <div className="result-list">
            {receipts.map((item) => (
              <button key={item.id} className={`result-item ${receipt?.id === item.id ? 'active' : ''}`} onClick={() => setReceipt(item)}>
                <strong>#{item.id}</strong> · {item.sourceFile || t('unknownFile')} · {t('pageAbbr')} {item.pageStart}-{item.pageEnd}
              </button>
            ))}
          </div>
        </div>
      )}

      {receipt && (
        <div className="card receipt-card">
          <div className="receipt-top">
            <div>
              <h3>{t('periodResult')} {receipt.period}</h3>
              <p className="muted">{t('sourcePages')}: {receipt.sourceFile || t('unknown')}, {t('pagesWord')} {receipt.pageStart}-{receipt.pageEnd}</p>
            </div>
            <a className="btn" href={`${API_URL}/api/public/receipt/${receipt.id}/download`}>{t('downloadPdf')}</a>
          </div>
          <PdfViewer url={`${API_URL}/api/public/receipt/${receipt.id}/view`} />
        </div>
      )}
    </section>
  );
}
