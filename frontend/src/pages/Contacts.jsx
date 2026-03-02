import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useI18n } from '../i18n';

const fallback = {
  phone: '+7 (700) 000-00-00',
  email: 'support@erc.local',
  address: 'г. Пример, ул. Центральная, 1',
  workHours: 'Пн–Пт 09:00–18:00',
  suppliersText: 'ТОО Теплосеть\nТОО Водоканал\nТОО Электроснабжение'
};

export default function Contacts() {
  const { t } = useI18n();
  const [contacts, setContacts] = useState(fallback);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [supplierQuery, setSupplierQuery] = useState('');

  useEffect(() => {
    api.get('/public/contacts').then(({ data }) => {
      if (data?.contacts) setContacts(data.contacts);
    }).catch(() => null);

    api.get('/public/suppliers').then(({ data }) => {
      const list = data?.suppliers || [];
      setSuppliers(list);
      if (list[0]) setSelectedId(String(list[0].id));
    }).catch(() => null);
  }, []);

  const filteredSuppliers = useMemo(() => {
    const q = supplierQuery.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) => s.name.toLowerCase().includes(q));
  }, [suppliers, supplierQuery]);

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => String(s.id) === String(selectedId)),
    [suppliers, selectedId]
  );

  const fallbackSuppliers = String(contacts.suppliersText || '').split('\n').map((x) => x.trim()).filter(Boolean);

  return (
    <section>
      <h1>{t('contactsTitle')}</h1>
      <p className="muted">{t('contactsIntro')}</p>

      <div className="feature-grid">
        <div className="card"><h3>{t('contactPhone')}</h3><p>{contacts.phone}</p></div>
        <div className="card"><h3>{t('contactEmail')}</h3><p>{contacts.email}</p></div>
        <div className="card"><h3>{t('contactWorkHours')}</h3><p>{contacts.workHours}</p></div>
      </div>

      <div className="card"><h3>{t('contactServiceAddress')}</h3><p>{contacts.address}</p></div>

      <div className="card">
        <h3>{t('suppliersTitle')}</h3>
        {suppliers.length > 0 ? (
          <>
            <label>{t('suppliersSearchLabel')}
              <input value={supplierQuery} onChange={(e) => setSupplierQuery(e.target.value)} placeholder={t('suppliersSearchPlaceholder')} />
            </label>
            <label>{t('suppliersSelectLabel')}
              <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                {filteredSuppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                ))}
              </select>
            </label>
            {filteredSuppliers.length === 0 && <p className="muted">{t('suppliersNotFound')}</p>}
            {selectedSupplier && (
              <div className="card supplier-card">
                <h4>{selectedSupplier.name}</h4>
                {selectedSupplier.description && <p>{selectedSupplier.description}</p>}
                <p className="muted">
                  {selectedSupplier.phone && <>{t('contactPhone')}: {selectedSupplier.phone} · </>}
                  {selectedSupplier.email && <>{selectedSupplier.email} · </>}
                  {selectedSupplier.website && <a href={selectedSupplier.website} target="_blank" rel="noreferrer">{t('supplierWebsite')}</a>}
                </p>
                <h5>{t('supplierServices')}</h5>
                {selectedSupplier.services?.length ? (
                  <ul>
                    {selectedSupplier.services.map((srv) => (
                      <li key={srv.id}>
                        <strong>{srv.title}</strong>
                        {srv.priceInfo ? ` — ${srv.priceInfo}` : ''}
                        {srv.description ? <div className="muted">{srv.description}</div> : null}
                      </li>
                    ))}
                  </ul>
                ) : <p className="muted">{t('supplierServicesEmpty')}</p>}
              </div>
            )}
          </>
        ) : (
          <>
            <h4>{t('supplierFallbackTitle')}</h4>
            <ul>{fallbackSuppliers.map((s) => <li key={s}>{s}</li>)}</ul>
          </>
        )}
      </div>
    </section>
  );
}
