import { FormEvent, useEffect, useState } from 'react';
import { LockKeyhole, LogOut, Plus, Save, Trash2, RefreshCw } from 'lucide-react';

type Row = Record<string, any>;
type Tab = 'products' | 'services' | 'projects' | 'enquiries' | 'settings';
const tabs: { key: Tab; label: string }[] = [
  { key: 'products', label: 'Materials & products' },
  { key: 'services', label: 'Services' },
  { key: 'projects', label: 'Projects' },
  { key: 'enquiries', label: 'Customer enquiries' },
  { key: 'settings', label: 'Home page text' },
];
const emptyFor = (tab: Tab): Row => tab === 'products'
  ? { name: '', description: '', category: 'Other Building Materials', price: '', unit: '', image_url: '', published: false }
  : tab === 'services'
    ? { name: '', description: '', sort_order: 0, published: true }
    : { title: '', description: '', location: '', image_url: '', published: false };

async function api(path: string, options: RequestInit = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
  return data;
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<Tab>('products');
  const [rows, setRows] = useState<Row[]>([]);
  const [record, setRecord] = useState<Row>(emptyFor('products'));
  const [settings, setSettings] = useState({ heroTitle: '', heroText: '' });
  const [busy, setBusy] = useState(false);

  const load = async (selected: Tab = tab) => {
    setError('');
    if (selected === 'settings') {
      const value = await api('/api/admin/settings');
      setSettings({ heroTitle: value.heroTitle || '', heroText: value.heroText || '' });
    } else {
      const value = await api('/api/admin/' + selected);
      setRows(Array.isArray(value) ? value : []);
    }
  };

  useEffect(() => {
    api('/api/admin/me').then(() => {
      setAuthenticated(true);
      return load('products');
    }).catch(() => {}).finally(() => setChecking(false));
  }, []);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) });
      setAuthenticated(true); setPassword('');
      await load('products');
      setNotice('You are signed in.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Sign-in failed.'); }
    finally { setBusy(false); }
  };

  const changeTab = async (next: Tab) => {
    setTab(next); setRecord(emptyFor(next)); setNotice(''); setError('');
    if (next !== 'settings') setRows([]);
    try { await load(next); } catch (e) { setError(e instanceof Error ? e.message : 'Could not load this section.'); }
  };

  const edit = (row: Row) => setRecord({ ...row, published: Boolean(row.published), price: row.price ?? '' });
  const saveRecord = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const payload = { ...record, published: Boolean(record.published) };
      const path = '/api/admin/' + tab + (record.id ? '/' + record.id : '');
      await api(path, { method: record.id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
      setRecord(emptyFor(tab)); await load(tab); setNotice('Saved successfully.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save changes.'); }
    finally { setBusy(false); }
  };
  const remove = async (row: Row) => {
    if (!window.confirm('Delete this item? This cannot be undone.')) return;
    setError(''); setNotice('');
    try { await api('/api/admin/' + tab + '/' + row.id, { method: 'DELETE' }); await load(tab); if (record.id === row.id) setRecord(emptyFor(tab)); setNotice('Item deleted.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not delete this item.'); }
  };
  const saveSettings = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try { await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify(settings) }); setNotice('Home page text saved.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save settings.'); }
    finally { setBusy(false); }
  };
  const logout = async () => {
    try { await api('/api/admin/logout', { method: 'POST' }); } finally { setAuthenticated(false); setRows([]); setRecord(emptyFor('products')); }
  };

  const field = (label: string, key: string, multiline = false, placeholder = '') => (
    <label className="admin-field" key={key}>
      <span>{label}</span>
      {multiline
        ? <textarea value={record[key] ?? ''} onChange={e => setRecord({ ...record, [key]: e.target.value })} placeholder={placeholder} rows={3} />
        : <input value={record[key] ?? ''} onChange={e => setRecord({ ...record, [key]: e.target.value })} placeholder={placeholder} />}
    </label>
  );

  if (checking) return <section className="section"><div className="container narrow"><p>Checking admin access…</p></div></section>;
  if (!authenticated) return (
    <section className="section admin-page"><div className="container narrow admin-login">
      <div className="admin-mark"><LockKeyhole size={30} /></div>
      <span className="eyebrow dark">PRIVATE AREA</span><h1 className="page-title">Eyaelo Admin</h1>
      <p>Sign in to manage website content and review customer enquiries.</p>
      {error && <p className="admin-alert" role="alert">{error}</p>}
      <form onSubmit={login} className="admin-form">
        <label className="admin-field"><span>Admin password</span><input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
        <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'} <LockKeyhole size={16}/></button>
      </form>
      <p className="admin-hint">Access is restricted. If the password has not been configured yet, the site administrator must add the ADMIN_PASSWORD secret in Cloudflare.</p>
    </div></section>
  );

  return (
    <section className="section admin-page"><div className="container admin-container">
      <div className="admin-heading"><div><span className="eyebrow dark">PRIVATE MANAGEMENT</span><h1 className="page-title">Eyaelo Admin Dashboard</h1><p>Changes you publish here update the public website.</p></div><button className="btn outline" type="button" onClick={logout}><LogOut size={16}/> Sign out</button></div>
      <div className="admin-tabs">{tabs.map(item => <button key={item.key} type="button" className={tab === item.key ? 'active' : ''} onClick={() => changeTab(item.key)}>{item.label}</button>)}</div>
      {error && <p className="admin-alert" role="alert">{error}</p>}
      {notice && <p className="admin-success" role="status">{notice}</p>}
      {tab === 'settings' ? (
        <form className="admin-editor" onSubmit={saveSettings}>
          <h2>Home page message</h2>
          <label className="admin-field"><span>Main heading</span><input value={settings.heroTitle} onChange={e => setSettings({ ...settings, heroTitle: e.target.value })} maxLength={160} required /></label>
          <label className="admin-field"><span>Introductory text</span><textarea rows={4} value={settings.heroText} onChange={e => setSettings({ ...settings, heroText: e.target.value })} maxLength={600} required /></label>
          <button className="btn primary" type="submit" disabled={busy}><Save size={16}/> Save home page text</button>
        </form>
      ) : tab === 'enquiries' ? (
        <div className="admin-list-wrap">
          <div className="admin-list-heading"><h2>Customer enquiries</h2><button type="button" className="btn outline" onClick={() => load('enquiries')}><RefreshCw size={15}/> Refresh</button></div>
          {rows.length === 0 ? <p>No enquiries have been saved yet.</p> : rows.map(row => <article className="admin-list-item enquiry-item" key={row.id}>
            <div className="admin-item-main"><strong>#{row.id} · {row.name}</strong><span>{row.type === 'material' ? 'Material enquiry' : 'Construction quote'} · {row.created_at}</span><p>{row.company || ''} {row.phone || ''} {row.email || ''}</p><p>{row.subject || ''}</p><p className="admin-details">{row.details || ''}</p></div>
            <label className="admin-status">Status<select value={row.status} onChange={async e => { try { await api('/api/admin/enquiries/' + row.id, { method: 'PATCH', body: JSON.stringify({ status: e.target.value }) }); setRows(rows.map(x => x.id === row.id ? { ...x, status: e.target.value } : x)); } catch (err) { setError(err instanceof Error ? err.message : 'Could not update status.'); } }}><option value="new">New</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="archived">Archived</option></select></label>
          </article>)}
        </div>
      ) : (
        <div className="admin-workspace">
          <div className="admin-list-wrap">
            <div className="admin-list-heading"><h2>{tabs.find(t => t.key === tab)?.label}</h2><button type="button" className="btn outline" onClick={() => { setRecord(emptyFor(tab)); setError(''); }}><Plus size={16}/> New item</button></div>
            {rows.length === 0 ? <p>No items yet. Add the first one using the form.</p> : rows.map(row => <article className="admin-list-item" key={row.id}>
              <div className="admin-item-main"><strong>{row.name || row.title}</strong><span>{row.category || row.location || (row.published ? 'Published' : 'Draft')}</span><p>{row.description || ''}</p></div>
              <div className="admin-item-actions"><button type="button" className="btn outline" onClick={() => edit(row)}>Edit</button><button type="button" className="admin-delete" aria-label="Delete item" onClick={() => remove(row)}><Trash2 size={16}/></button></div>
            </article>)}
          </div>
          <form className="admin-editor" onSubmit={saveRecord}>
            <h2>{record.id ? 'Edit item' : 'Add new item'}</h2>
            {tab === 'products' && <>
              {field('Product name', 'name')}
              {field('Description', 'description', true)}
              <label className="admin-field"><span>Category</span><select value={record.category || 'Other Building Materials'} onChange={e => setRecord({ ...record, category: e.target.value })}>{['Sand','Bricks and Blocks','Cement','Lime','Aggregates','Hardcore','Building Stones','Reinforcement Steel','Roofing Materials','Concrete Materials','Other Building Materials'].map(x => <option key={x}>{x}</option>)}</select></label>
              <div className="admin-two-col">{field('Price (optional, UGX)', 'price', false, 'Leave blank to quote on request')}{field('Unit (e.g. bag, tonne)', 'unit')}</div>
              {field('Photo URL', 'image_url', false, 'Paste an image URL')}
            </>}
            {tab === 'services' && <>{field('Service name', 'name')}{field('Description', 'description', true)}{field('Display order', 'sort_order')}</>}
            {tab === 'projects' && <>{field('Project title', 'title')}{field('Description', 'description', true)}{field('Location (optional)', 'location')}{field('Photo URL', 'image_url', false, 'Paste an image URL')}</>}
            <label className="admin-checkbox"><input type="checkbox" checked={Boolean(record.published)} onChange={e => setRecord({ ...record, published: e.target.checked })}/><span>Publish this item on the public website</span></label>
            <button className="btn primary" type="submit" disabled={busy}><Save size={16}/> {busy ? 'Saving…' : record.id ? 'Save changes' : 'Add item'}</button>
            {record.id && <button className="btn outline" type="button" onClick={() => setRecord(emptyFor(tab))}>Cancel editing</button>}
            <p className="admin-hint">Draft items remain private. Product prices are for display only; online ordering and checkout remain disabled.</p>
          </form>
        </div>
      )}
    </div></section>
  );
}
