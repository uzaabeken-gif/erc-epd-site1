import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { api, API_URL } from '../api/client';

const defaultAd = {
  ruText: 'Здесь может быть размещена ваша реклама',
  kzText: 'Мұнда сіздің жарнамаңыз орналастырылуы мүмкін',
  linkUrl: '',
  imageUrl: '',
  mediaPath: '',
  isActive: true
};

const parseImageList = (ad) => {
  const fromImageUrl = String(ad.imageUrl || '')
    .split(/\r?\n|,/)
    .map((v) => v.trim())
    .filter(Boolean)
    .map((src) => (src.startsWith('/media/') ? `${API_URL}${src}` : src));

  const fromMediaPath = ad.mediaPath ? [`${API_URL}${ad.mediaPath}`] : [];
  return [...new Set([...fromMediaPath, ...fromImageUrl])];
};

export default function AdBanner() {
  const { t } = useI18n();
  const [ad, setAd] = useState(defaultAd);
  const [ads, setAds] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    api.get('/public/ad').then(({ data }) => {
      if (data?.ad) setAd(data.ad);
      if (Array.isArray(data?.ads)) setAds(data.ads);
    }).catch(() => null);
  }, []);

  const creatives = useMemo(() => {
    const sourceAds = ads.length ? ads.filter((item) => item?.isActive !== false) : [ad];
    return sourceAds.flatMap((item) => parseImageList(item).map((src) => ({ src, ad: item })));
  }, [ad, ads]);

  const activeCreative = creatives[currentIndex] || null;
  const activeImage = activeCreative?.src || '';
  const activeAd = activeCreative?.ad || ad;

  useEffect(() => {
    setCurrentIndex(0);
  }, [activeAd?.rotationSeconds, creatives.length]);

  useEffect(() => {
    if (creatives.length <= 1) return undefined;
    const intervalMs = Math.max(1, Number(activeAd?.rotationSeconds || 5)) * 1000;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % creatives.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [activeAd?.rotationSeconds, creatives.length]);

  if (!ad.isActive) return null;

  const content = (
    <div className="ad-banner card">
      <p className="ad-label">{t('adBlockLabel')}</p>
      {activeImage && (
        <div className="ad-media-wrap">
          <img src={activeImage} alt={t('adImageAlt')} className="ad-image" />
        </div>
      )}

      {creatives.length > 1 && (
        <div className="ad-controls">
          <button type="button" className="ad-control" onClick={(e) => { e.preventDefault(); setCurrentIndex((prev) => (prev - 1 + creatives.length) % creatives.length); }}>‹</button>
          <span className="ad-index">{currentIndex + 1} / {creatives.length}</span>
          <button type="button" className="ad-control" onClick={(e) => { e.preventDefault(); setCurrentIndex((prev) => (prev + 1) % creatives.length); }}>›</button>
        </div>
      )}

      <p className="ad-ru">{activeAd.ruText || defaultAd.ruText}</p>
      <p className="ad-kz">{activeAd.kzText || defaultAd.kzText}</p>
    </div>
  );

  if (activeAd.linkUrl) {
    return <a href={activeAd.linkUrl} target="_blank" rel="noreferrer">{content}</a>;
  }

  return content;
}
