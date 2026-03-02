import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useI18n } from '../i18n';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export default function PdfViewer({ url }) {
  const ref = useRef(null);
  const { t } = useI18n();
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    let cancelled = false;
    let loadingTask;

    const render = async () => {
      if (!url || !ref.current) return;
      setStatus('loading');
      ref.current.innerHTML = '';

      try {
        loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;

        if (cancelled) return;

        for (let p = 1; p <= pdf.numPages; p += 1) {
          if (cancelled || !ref.current) return;
          const page = await pdf.getPage(p);
          const viewport = page.getViewport({ scale: 1.2 });
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          if (!ctx) continue;

          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = '100%';
          canvas.style.height = 'auto';

          await page.render({ canvasContext: ctx, viewport }).promise;

          if (cancelled || !ref.current) return;
          ref.current.appendChild(canvas);
        }

        if (!cancelled) setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    };

    render();

    return () => {
      cancelled = true;
      loadingTask?.destroy?.();
    };
  }, [url]);

  return (
    <div>
      {status === 'loading' && <p className="muted">{t('viewerLoading')}</p>}
      {status === 'error' && <p className="error">{t('viewerError')}</p>}
      <div className="pdf-viewer" ref={ref} />
    </div>
  );
}
