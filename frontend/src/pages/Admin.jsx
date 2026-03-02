import { useEffect, useMemo, useState } from 'react';
import { adminApi, api, API_URL } from '../api/client';

const initialAd = { id: '', ruText: '', kzText: '', linkUrl: '', imageUrl: '', mediaPath: '', isActive: true, rotationSeconds: 5 };
const initialContacts = { id: '', phone: '', email: '', address: '', workHours: '', suppliersText: '' };
const initialSupplier = { name: '', description: '', phone: '', email: '', website: '', isActive: true };
const initialService = { title: '', description: '', priceInfo: '', isActive: true };

export default function Admin() {
  const [token, setToken] = useState(localStorage.getItem('adminToken') || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [period, setPeriod] = useState('2026-03');
  const [uploads, setUploads] = useState([]);
  const [files, setFiles] = useState([]);
  const [unassigned, setUnassigned] = useState([]);
  const [form, setForm] = useState({ uploadId: '', fromPage: '', toPage: '', account: '', rawAddress: '' });
  const [ad, setAd] = useState(initialAd);
  const [ads, setAds] = useState([]);
  const [adMediaFiles, setAdMediaFiles] = useState([]);
  const [contacts, setContacts] = useState(initialContacts);
  const [suppliers, setSuppliers] = useState([]);
  const [newSupplier, setNewSupplier] = useState(initialSupplier);
  const [serviceForms, setServiceForms] = useState({});
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const uploadStats = {
    total: uploads.length,
    processed: uploads.filter((u) => u.status === 'processed').length,
    failed: uploads.filter((u) => u.status === 'failed').length
  };

  const client = useMemo(() => adminApi(token), [token]);

  const loadUploads = async () => {
    if (!token) return;
    const { data } = await client.get('/uploads');
    setUploads(data.uploads);
  };

  const loadAdminData = async () => {
    if (!token) return;
    const [adRes, contactsRes, suppliersRes] = await Promise.all([
      client.get('/ads'),
      client.get('/contacts'),
      client.get('/suppliers')
    ]);
    const adList = adRes.data.ads || (adRes.data.ad ? [adRes.data.ad] : []);
    setAds(adList);
    setAd(adList[0] || adRes.data.ad || initialAd);
    setContacts(contactsRes.data.contacts);
    setSuppliers(suppliersRes.data.suppliers || []);
  };

  useEffect(() => {
    loadUploads().catch(() => null);
    loadAdminData().catch(() => null);
    if (!token) return;
    const t = setInterval(() => loadUploads().catch(() => null), 5000);
    return () => clearInterval(t);
  }, [token]);


  const runAction = async (action, successMessage) => {
    try {
      setBusy(true);
      await action();
      if (successMessage) setStatus(successMessage);
    } catch (e) {
      setStatus(e?.response?.data?.message || 'Ошибка операции');
    } finally {
      setBusy(false);
    }
  };

  const login = async () => {
    const { data } = await api.post('/admin/auth/login', { email, password });
    localStorage.setItem('adminToken', data.token);
    setToken(data.token);
  };

  const upload = async () => runAction(async () => {
    const fd = new FormData();
    fd.append('period', period);
    [...files].forEach((f) => fd.append('files', f));
    await client.post('/uploads', fd);
    await loadUploads();
  }, 'Файлы отправлены на обработку');

  const removeUpload = async (id) => {
    if (!window.confirm('Удалить загрузку и связанные квитанции?')) return;
    await runAction(async () => {
      await client.delete(`/uploads/${id}`);
      await loadUploads();
    }, 'Загрузка удалена');
  };

  const reprocess = async (id) => runAction(async () => {
    await client.post(`/uploads/${id}/reprocess`);
    await loadUploads();
  }, 'Перепроцессинг запущен');


  const removePeriod = async () => {
    if (!period) return;
    if (!window.confirm(`Удалить все загрузки и квитанции за период ${period}?`)) return;
    await runAction(async () => {
      await client.delete('/uploads', { params: { period } });
      await loadUploads();
    }, `Данные за период ${period} удалены`);
  };

  const loadUnassigned = async (uploadId) => {
    const { data } = await client.get('/unassigned-pages', { params: { uploadId } });
    setUnassigned(data.pages);
  };

  const assign = async () => runAction(async () => {
    await client.post('/unassigned-pages/assign', form);
    await loadUnassigned(form.uploadId);
    await loadUploads();
  }, 'Диапазон успешно привязан');

  const createAd = async () => runAction(async () => {
    const { data } = await client.post('/ads', {
      ruText: 'Новый рекламный блок',
      kzText: 'Жаңа жарнама блогы',
      isActive: true,
      rotationSeconds: 5
    });
    await loadAdminData();
    if (data?.ad) setAd(data.ad);
  }, 'Рекламный блок создан');

  const removeAd = async (id) => {
    if (!window.confirm('Удалить рекламный блок?')) return;
    await runAction(async () => {
      await client.delete(`/ads/${id}`);
      await loadAdminData();
    }, 'Рекламный блок удален');
  };

  const saveAd = async () => runAction(async () => {
    if (!ad?.id) throw new Error('Выберите рекламный блок');
    await client.put(`/ads/${ad.id}`, ad);
    if (adMediaFiles.length) {
      const fd = new FormData();
      adMediaFiles.forEach((file) => fd.append('media', file));
      await client.post(`/ads/${ad.id}/media`, fd);
      setAdMediaFiles([]);
    }
    await loadAdminData();
  }, 'Реклама обновлена');

  const saveContacts = async () => runAction(async () => {
    await client.put(`/contacts/${contacts.id}`, contacts);
    await loadAdminData();
  }, 'Контакты обновлены');

  const createSupplier = async () => runAction(async () => {
    await client.post('/suppliers', newSupplier);
    setNewSupplier(initialSupplier);
    await loadAdminData();
  }, 'Поставщик добавлен');

  const updateSupplier = async (supplier) => runAction(async () => {
    await client.put(`/suppliers/${supplier.id}`, supplier);
    await loadAdminData();
  }, 'Поставщик обновлен');

  const deleteSupplier = async (id) => {
    if (!window.confirm('Удалить поставщика и все его услуги?')) return;
    await runAction(async () => {
      await client.delete(`/suppliers/${id}`);
      await loadAdminData();
    }, 'Поставщик удален');
  };

  const addService = async (supplierId) => runAction(async () => {
    const payload = serviceForms[supplierId] || initialService;
    await client.post(`/suppliers/${supplierId}/services`, payload);
    setServiceForms({ ...serviceForms, [supplierId]: initialService });
    await loadAdminData();
  }, 'Услуга добавлена');

  const updateService = async (service) => runAction(async () => {
    await client.put(`/services/${service.id}`, service);
    await loadAdminData();
  }, 'Услуга обновлена');

  const deleteService = async (id) => {
    if (!window.confirm('Удалить услугу?')) return;
    await runAction(async () => {
      await client.delete(`/services/${id}`);
      await loadAdminData();
    }, 'Услуга удалена');
  };

  if (!token) {
    return (
      <section className="card">
        <h1>Админ-панель</h1>
        <p className="muted">Вход для операторов ЕРЦ.</p>
        <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Пароль<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <button className="btn" onClick={login}>Войти</button>
      </section>
    );
  }

  return (
    <section className="admin-page">
      <div className="admin-head card">
        <h1>Админ-панель</h1>
        <button className="btn btn-secondary" onClick={() => { localStorage.removeItem('adminToken'); setToken(''); }}>Выйти</button>
      </div>


      <div className="card admin-quicknav">
        <a href="#uploads-block">Загрузки PDF</a>
        <a href="#ads-block">Реклама</a>
        <a href="#contacts-block">Контакты</a>
        <a href="#suppliers-block">Поставщики</a>
        <a href="#recognition-block">Распознавание</a>
      </div>

      <div id="uploads-block" className="card form-grid two-columns">
        <label>Период<input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="YYYY-MM" /></label>
        <label>PDF файлы<input type="file" multiple accept="application/pdf" onChange={(e) => setFiles(e.target.files)} /></label>
        <div className="table-actions">
          <button className="btn" onClick={upload} disabled={busy}>Загрузить и обработать</button>
          <button onClick={removePeriod} disabled={busy || !period}>Удалить период</button>
        </div>
      </div>

      <div id="ads-block" className="card">
        <h3>Управление рекламой</h3>
        <p className="muted">Можно создавать несколько рекламных блоков, включать/выключать, настраивать ротацию и загружать несколько медиа-файлов.</p>
        <div className="form-grid two-columns">
          <label>Выбранный блок
            <select value={ad.id || ''} onChange={(e) => setAd(ads.find((x) => String(x.id) === e.target.value) || initialAd)}>
              {ads.map((item) => <option key={item.id} value={item.id}>#{item.id} · {item.ruText || 'Без названия'} {item.isActive ? '· активен' : '· выключен'}</option>)}
            </select>
          </label>
          <div className="table-actions">
            <button onClick={createAd} disabled={busy}>Новый блок</button>
            <button onClick={() => removeAd(ad.id)} disabled={busy || !ad.id}>Удалить блок</button>
          </div>
          <label>Текст (RU)<input value={ad.ruText || ''} onChange={(e) => setAd({ ...ad, ruText: e.target.value })} /></label>
          <label>Текст (KZ)<input value={ad.kzText || ''} onChange={(e) => setAd({ ...ad, kzText: e.target.value })} /></label>
          <label>Ссылка<input value={ad.linkUrl || ''} onChange={(e) => setAd({ ...ad, linkUrl: e.target.value })} /></label>
          <label>URL картинок (по одному в строке, через запятую или ; )<textarea rows="3" value={ad.imageUrl || ''} onChange={(e) => setAd({ ...ad, imageUrl: e.target.value })} /></label>
          <label>Файлы баннеров/гиф (можно несколько)<input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => setAdMediaFiles(Array.from(e.target.files || []))} /></label>
          <label>Интервал смены (сек)<input type="number" min="1" max="120" value={ad.rotationSeconds || 5} onChange={(e) => setAd({ ...ad, rotationSeconds: Number(e.target.value || 5) })} /></label>
          <label className="inline-check"><input type="checkbox" checked={Boolean(ad.isActive)} onChange={(e) => setAd({ ...ad, isActive: e.target.checked })} /><span>Показывать рекламу</span></label>
          <div className="form-action"><button className="btn" onClick={saveAd} disabled={busy || !ad.id}>Сохранить рекламу</button></div>
        </div>
      </div>

      <div id="contacts-block" className="card">
        <h3>Управление контактами</h3>
        <div className="form-grid two-columns">
          <label>Телефон<input value={contacts.phone || ''} onChange={(e) => setContacts({ ...contacts, phone: e.target.value })} /></label>
          <label>Email<input value={contacts.email || ''} onChange={(e) => setContacts({ ...contacts, email: e.target.value })} /></label>
          <label>Адрес<input value={contacts.address || ''} onChange={(e) => setContacts({ ...contacts, address: e.target.value })} /></label>
          <label>Режим работы<input value={contacts.workHours || ''} onChange={(e) => setContacts({ ...contacts, workHours: e.target.value })} /></label>
          <label className="span-2">Старое поле поставщиков (fallback)
            <textarea rows="3" value={contacts.suppliersText || ''} onChange={(e) => setContacts({ ...contacts, suppliersText: e.target.value })} />
          </label>
          <div className="form-action"><button className="btn" onClick={saveContacts} disabled={busy}>Сохранить контакты</button></div>
        </div>
      </div>

      <div id="suppliers-block" className="card">
        <h3>Поставщики и услуги (новый каталог)</h3>
        <div className="form-grid two-columns">
          <label>Название поставщика<input value={newSupplier.name} onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })} /></label>
          <label>Телефон<input value={newSupplier.phone} onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })} /></label>
          <label>Email<input value={newSupplier.email} onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })} /></label>
          <label>Сайт<input value={newSupplier.website} onChange={(e) => setNewSupplier({ ...newSupplier, website: e.target.value })} /></label>
          <label className="span-2">Описание<textarea rows="2" value={newSupplier.description} onChange={(e) => setNewSupplier({ ...newSupplier, description: e.target.value })} /></label>
          <label className="inline-check"><input type="checkbox" checked={newSupplier.isActive} onChange={(e) => setNewSupplier({ ...newSupplier, isActive: e.target.checked })} /><span>Активен</span></label>
          <div className="form-action"><button className="btn" onClick={createSupplier} disabled={busy}>Добавить поставщика</button></div>
        </div>

        {suppliers.map((supplier) => (
          <details className="card supplier-details" key={supplier.id} open>
            <summary><strong>{supplier.name}</strong> · услуг: {supplier.services?.length || 0}</summary>
            <h4>{supplier.name}</h4>
            <div className="form-grid two-columns">
              <label>Название<input value={supplier.name || ''} onChange={(e) => setSuppliers(suppliers.map((s) => s.id === supplier.id ? { ...s, name: e.target.value } : s))} /></label>
              <label>Телефон<input value={supplier.phone || ''} onChange={(e) => setSuppliers(suppliers.map((s) => s.id === supplier.id ? { ...s, phone: e.target.value } : s))} /></label>
              <label>Email<input value={supplier.email || ''} onChange={(e) => setSuppliers(suppliers.map((s) => s.id === supplier.id ? { ...s, email: e.target.value } : s))} /></label>
              <label>Сайт<input value={supplier.website || ''} onChange={(e) => setSuppliers(suppliers.map((s) => s.id === supplier.id ? { ...s, website: e.target.value } : s))} /></label>
              <label className="span-2">Описание<textarea rows="2" value={supplier.description || ''} onChange={(e) => setSuppliers(suppliers.map((s) => s.id === supplier.id ? { ...s, description: e.target.value } : s))} /></label>
              <label className="inline-check"><input type="checkbox" checked={supplier.isActive} onChange={(e) => setSuppliers(suppliers.map((s) => s.id === supplier.id ? { ...s, isActive: e.target.checked } : s))} /><span>Активен</span></label>
              <div className="table-actions">
                <button onClick={() => updateSupplier(supplier)} disabled={busy}>Сохранить поставщика</button>
                <button onClick={() => deleteSupplier(supplier.id)} disabled={busy}>Удалить поставщика</button>
              </div>
            </div>

            <h5>Услуги</h5>
            {(supplier.services || []).map((srv) => (
              <div className="form-grid two-columns" key={srv.id}>
                <label>Услуга<input value={srv.title || ''} onChange={(e) => setSuppliers(suppliers.map((s) => s.id === supplier.id ? { ...s, services: s.services.map((x) => x.id === srv.id ? { ...x, title: e.target.value } : x) } : s))} /></label>
                <label>Тариф/цена<input value={srv.priceInfo || ''} onChange={(e) => setSuppliers(suppliers.map((s) => s.id === supplier.id ? { ...s, services: s.services.map((x) => x.id === srv.id ? { ...x, priceInfo: e.target.value } : x) } : s))} /></label>
                <label className="span-2">Описание<textarea rows="2" value={srv.description || ''} onChange={(e) => setSuppliers(suppliers.map((s) => s.id === supplier.id ? { ...s, services: s.services.map((x) => x.id === srv.id ? { ...x, description: e.target.value } : x) } : s))} /></label>
                <label className="inline-check"><input type="checkbox" checked={srv.isActive} onChange={(e) => setSuppliers(suppliers.map((s) => s.id === supplier.id ? { ...s, services: s.services.map((x) => x.id === srv.id ? { ...x, isActive: e.target.checked } : x) } : s))} /><span>Активна</span></label>
                <div className="table-actions">
                  <button onClick={() => updateService(srv)} disabled={busy}>Сохранить услугу</button>
                  <button onClick={() => deleteService(srv.id)} disabled={busy}>Удалить услугу</button>
                </div>
              </div>
            ))}

            <div className="form-grid two-columns">
              <label>Новая услуга<input value={(serviceForms[supplier.id] || initialService).title} onChange={(e) => setServiceForms({ ...serviceForms, [supplier.id]: { ...(serviceForms[supplier.id] || initialService), title: e.target.value } })} /></label>
              <label>Тариф/цена<input value={(serviceForms[supplier.id] || initialService).priceInfo} onChange={(e) => setServiceForms({ ...serviceForms, [supplier.id]: { ...(serviceForms[supplier.id] || initialService), priceInfo: e.target.value } })} /></label>
              <label className="span-2">Описание<textarea rows="2" value={(serviceForms[supplier.id] || initialService).description} onChange={(e) => setServiceForms({ ...serviceForms, [supplier.id]: { ...(serviceForms[supplier.id] || initialService), description: e.target.value } })} /></label>
              <div className="form-action"><button className="btn" onClick={() => addService(supplier.id)} disabled={busy}>Добавить услугу</button></div>
            </div>
          </details>
        ))}
      </div>

      {status && <p className="card muted">{status}</p>}

      <div className="card">
        <h3>Загрузки</h3>
        <p className="muted stats-line">Всего: <strong>{uploadStats.total}</strong> · Обработано: <strong>{uploadStats.processed}</strong> · Ошибки: <strong>{uploadStats.failed}</strong></p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>ID</th><th>Файл</th><th>Период</th><th>Статус</th><th>Квитанций</th><th>Неопознано</th><th>Действия</th></tr></thead>
            <tbody>
              {uploads.map((u) => <tr key={u.id}><td>{u.id}</td><td>{u.originalName}</td><td>{u.period}</td><td><span className={`status-pill ${u.status}`}>{u.status}</span></td><td>{u.recognizedCount}</td><td>{u.unassignedCount}</td>
                <td className="table-actions">
                  <button onClick={() => reprocess(u.id)} disabled={busy}>Перепроцессить</button>
                  <button onClick={() => removeUpload(u.id)} disabled={busy}>Удалить</button>
                  <button onClick={() => loadUnassigned(u.id)}>Неопознанные</button>
                  <a href={`${API_URL}/api/admin/uploads/${u.id}/source`} target="_blank" rel="noreferrer">Исходник</a>
                </td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </div>

      <div id="recognition-block" className="card">
        <h3>Проверка распознавания</h3>
        {unassigned.length === 0 && <p className="muted">Неопознанных страниц нет или выберите загрузку.</p>}
        {unassigned.map((p) => <p key={p.id}>Стр. {p.pageNumber}: {p.rawText.slice(0, 120)}...</p>)}
        <div className="form-grid two-columns">
          {['uploadId', 'fromPage', 'toPage', 'account', 'rawAddress'].map((k) => (
            <label key={k}>{k}<input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></label>
          ))}
          <div className="form-action"><button className="btn" onClick={assign} disabled={busy}>Привязать диапазон</button></div>
        </div>
      </div>
    </section>
  );
}
