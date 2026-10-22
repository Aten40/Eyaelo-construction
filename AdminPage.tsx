import { FormEvent, useEffect, useState } from 'react';
import { LockKeyhole, LogOut, Plus, Save, Trash2, RefreshCw, Eye, EyeOff } from 'lucide-react';

type Row = Record<string, any>;
const designPackageLabel = (value: string) => ({
  floor: 'Floor plan only',
  architectural: 'Complete architectural drawing package',
  full: 'Full building package — foundation to roof',
  '3d': '3D visualisation only',
  custom: 'Custom package',
}[value] || value || 'Not specified');
type Tab = 'products' | 'services' | 'projects' | 'videos' | 'designs' | 'design-submissions' | 'enquiries' | 'settings' | 'images';
const tabs: { key: Tab; label: string }[] = [
  { key: 'products', label: 'Materials & products' },
  { key: 'services', label: 'Services' },
  { key: 'projects', label: 'Projects' },
  { key: 'videos', label: 'Videos' },
  { key: 'designs', label: 'Design catalogue' },
  { key: 'design-submissions', label: 'Designer submissions' },
  { key: 'enquiries', label: 'Customer enquiries' },
  { key: 'settings', label: 'Home page text' },
  { key: 'images', label: 'Category photos' },
];

const imageCategories = [
  { group: 'Construction', name: 'Residential Construction' },
  { group: 'Construction', name: 'Commercial and Retail Buildings' },
  { group: 'Construction', name: 'Healthcare and Institutional Facilities' },
  { group: 'Construction', name: 'Roads and Transport Infrastructure' },
  { group: 'Construction', name: 'Industrial and Agro-Processing Facilities' },
  { group: 'Construction', name: 'Property and Mixed-Use Developments' },
  { group: 'Construction', name: 'Water and Sanitation Infrastructure' },
  { group: 'Construction', name: 'Bridges and Major Structures' },
  { group: 'Construction', name: 'Warehousing and Logistics Facilities' },
  { group: 'Services', name: 'Structural and Foundation Works' },
  { group: 'Services', name: 'Civil and Site Works' },
  { group: 'Services', name: 'Renovation and Refurbishment' },
  { group: 'Services', name: 'Roofing and Building Finishes' },
  { group: 'Services', name: 'Reinforcement Steel Works' },
  { group: 'Services', name: 'Water, Drainage and Sanitation' },
  { group: 'Services', name: 'Construction Materials Sourcing' },
  { group: 'Services', name: 'Site Clearance and Earthworks' },
  { group: 'Services', name: 'Concrete and Formwork Works' },
  { group: 'Services', name: 'Waterproofing and Damp Protection' },
  { group: 'Services', name: 'Paving, Kerbs and External Works' },
  { group: 'Services', name: 'Project and Site Coordination' },
  { group: 'Services', name: 'Building Maintenance and Repairs' },
];
const emptyFor = (tab: Tab): Row => tab === 'products'
  ? { name: '', description: '', category: 'Other Building Materials', price: '', unit: '', image_url: '', published: false }
  : tab === 'services'
    ? { name: '', description: '', sort_order: 0, published: true }
    : tab === 'projects'
      ? { title: '', description: '', location: '', image_url: '', published: false }
      : tab === 'designs'
        ? { title: '', description: '', category: 'Residential', designer_name: '', designer_email: '', designer_phone: '', portfolio_url: '', image_url: '', price_label: 'Enquire for price', rights_confirmed: false, status: 'pending' }
        : { title: '', description: '', video_url: '', placement: 'website', published: false };

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
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<Tab>('products');
  const [rows, setRows] = useState<Row[]>([]);
  const [record, setRecord] = useState<Row>(emptyFor('products'));
  const [settings, setSettings] = useState<Record<string, string>>({ heroTitle: '', heroText: '' });
  const [busy, setBusy] = useState(false);
  const [uploadingImage, setUploadingImage] = useState('');
  const [imageGroup, setImageGroup] = useState<'Construction' | 'Services'>('Construction');
  const [reviewFeedback, setReviewFeedback] = useState<Record<string, string>>({});
  const [reviewingId, setReviewingId] = useState<number | null>(null);

  const load = async (selected: Tab = tab) => {
    setError('');
    if (selected === 'settings' || selected === 'images') {
      const value = await api('/api/admin/settings');
      setSettings(value || {});
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
  const saveCategoryImages = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const imageValues: Record<string, string> = {};
      for (const item of imageCategories) {
        imageValues['categoryImage:' + item.name] = settings['categoryImages:' + item.name] ? '' : (settings['categoryImage:' + item.name] || '');
        imageValues['categoryImages:' + item.name] = settings['categoryImages:' + item.name] || '[]';
      }
      await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify(imageValues) });
      setNotice('Category photos saved. The public Construction and Services pages will use these images.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save category photos.'); }
    finally { setBusy(false); }
  };

  const saveSettings = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try { await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify(settings) }); setNotice('Home page text saved.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save settings.'); }
    finally { setBusy(false); }
  };
  const reviewSubmission = async (row: Row, action: 'approve' | 'request_changes' | 'decline') => {
    const feedback = (reviewFeedback[String(row.id)] || '').trim();
    if (action !== 'approve' && !feedback) {
      setError(action === 'request_changes' ? 'Please explain what the designer needs to improve.' : 'Please record the reason for declining this submission.');
      return;
    }
    const actionLabel = action === 'approve' ? 'approve and publish this design' : action === 'request_changes' ? 'request improvements from this designer' : 'decline this submission';
    if (!window.confirm('Are you sure you want to ' + actionLabel + '?')) return;
    setReviewingId(Number(row.id)); setError(''); setNotice('');
    try {
      const result = await api('/api/admin/design-submissions/' + row.id + '/review', {
        method: 'POST',
        body: JSON.stringify({ action, feedback }),
      });
      await load('design-submissions');
      if (action === 'approve') {
        setNotice('Approved. The preview image has been copied from private storage to the public design catalogue, and the design is now published.');
      } else {
        const subject = action === 'request_changes' ? 'Please improve and resubmit your Eyaelo design' : 'Update on your Eyaelo design submission';
        const decision = action === 'request_changes'
          ? 'Your design needs some improvements before Eyaelo can publish it. Please review the feedback below and resubmit your updated design using the freelance designer form:'
          : 'Thank you for submitting your design to Eyaelo Design Marketplace. After review, we are unable to accept this submission at this time. Reason:';
        const body = 'Hello ' + (row.designer_name || 'Designer') + ',\\n\\n' + decision + '\\n\\n' + feedback + '\\n\\nDesign: ' + (row.title || 'Submission #' + row.id) + '\\n\\nResubmission form: ' + window.location.origin + '/design-marketplace#freelance-designers' + '\\n\\nRegards,\\nEyaelo Construction Ltd';
        setNotice(action === 'request_changes'
          ? 'Feedback saved and status changed to “Needs revision”. Your email app will open with a message draft for the designer; please send it to notify them.'
          : 'Submission declined and reason saved. Your email app will open with a message draft; please send it to notify the designer.');
        window.location.href = 'mailto:' + encodeURIComponent(String(result.designer_email || row.designer_email || '')) + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the review decision.');
    } finally {
      setReviewingId(null);
    }
  };

  const logout = async () => {
    try { await api('/api/admin/logout', { method: 'POST' }); } finally { setAuthenticated(false); setRows([]); setRecord(emptyFor('products')); }
  };

  const uploadImage = async (file: File, category: string, onUploaded: (url: string) => void, title = '', description = '') => {
    setUploadingImage(category); setError(''); setNotice('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('category', category);
      form.append('title', title);
      form.append('description', description);
      const response = await fetch('/api/admin/uploads', { method: 'POST', body: form, credentials: 'same-origin' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Image upload failed.');
      onUploaded(data.url);
      setNotice('Image uploaded to Cloudflare storage. Save your changes to publish it.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Image upload failed.');
    } finally {
      setUploadingImage('');
    }
  };

  const imageUploadField = (category: string, onUploaded: (url: string) => void, title = '', description = '') => (
    <label className="admin-field image-upload-field">
      <span>{uploadingImage === category ? 'Uploading image…' : 'Upload image from phone gallery'}</span>
      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={Boolean(uploadingImage)} onChange={e => {
        const file = e.currentTarget.files?.[0];
        e.currentTarget.value = '';
        if (file) void uploadImage(file, category, onUploaded, title, description);
      }} />
      <small className="admin-hint">JPG, PNG, WEBP or GIF · maximum 8 MB</small>
    </label>
  );

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
        <label className="admin-field"><span>Admin password</span><div className="admin-password-wrap"><input type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /><button className="admin-password-toggle" type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>{showPassword ? <EyeOff size={19}/> : <Eye size={19}/>}<span>{showPassword ? 'Hide' : 'Show'}</span></button></div></label>
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
      {tab === 'images' ? (
        <form className="admin-editor category-image-editor" onSubmit={saveCategoryImages}>
          <h2>Construction and Services photos</h2>
          <p className="admin-hint">Add a direct HTTPS image link for each category. You can use Eyaelo's own project photos when they are hosted online. Leave a field blank to return to the website's default photo. Use ordinary, real site photographs that match the work; avoid logos and unrelated images.</p>
          <div className="category-image-group-tabs" role="tablist" aria-label="Photo category groups">
            {(['Construction', 'Services'] as const).map(group => <button key={group} type="button" role="tab" aria-selected={imageGroup === group} className={imageGroup === group ? 'active' : ''} onClick={() => setImageGroup(group)}>{group} photos ({imageCategories.filter(item => item.group === group).length})</button>)}
          </div>
          <div className="category-image-group" key={imageGroup}>
            <h3>{imageGroup} category photos</h3>
            {imageCategories.filter(item => item.group === imageGroup).map(item => {
              const key = 'categoryImages:' + item.name;
              const legacyKey = 'categoryImage:' + item.name;
              let images: string[] = [];
              try { const parsed = JSON.parse(settings[key] || '[]'); if (Array.isArray(parsed)) images = parsed.filter((x): x is string => typeof x === 'string').slice(0, 7); } catch {}
              if (!images.length && settings[legacyKey]) images = [settings[legacyKey]];
              const updateImages = (next: string[]) => setSettings(current => ({ ...current, [key]: JSON.stringify(next.slice(0, 7)) }));
              return <div className="category-image-edit-row category-gallery-editor-row" key={item.name}>
                <div className="category-gallery-heading"><strong>{item.name}</strong><span>{images.length} of 7 images</span></div>
                <button type="button" className="btn outline" onClick={() => {
                  updateImages([]);
                  setSettings(current => ({ ...current, ['categoryImage:' + item.name]: '', ['pendingGalleryUrl:' + item.name]: '' }));
                  setNotice('Default photo selected for ' + item.name + '. Save category photos to publish the change. Existing uploaded files are kept unless you choose permanent deletion.');
                }}>Restore default photo</button>
                <div className="category-gallery-slots">
                  {images.map((image, index) => <div className="category-gallery-slot" key={image + index}>
                    <img src={image} alt={item.name + ' preview ' + (index + 1)} loading="lazy" onError={e => { e.currentTarget.style.opacity = '0.35'; }} />
                    <span>Image {index + 1}</span>
                    <button type="button" className="admin-delete" onClick={async () => {
                      const keyMatch = image.match(/\/media\/(uploads\/[^?#]+)/);
                      if (keyMatch && window.confirm('Permanently delete this Eyaelo-uploaded image from storage? Choose Cancel to remove it from the page but keep the file.')) {
                        try { const response = await fetch('/api/admin/uploads?key=' + encodeURIComponent(keyMatch[1]), { method: 'DELETE', credentials: 'same-origin' }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || 'Permanent deletion failed.'); }
                        catch (err) { setError(err instanceof Error ? err.message : 'Could not delete image from storage.'); return; }
                      }
                      updateImages(images.filter((_, i) => i !== index));
                      setNotice('Image removed from the category draft. Save category photos to publish the change.');
                    }}><Trash2 size={15}/> Remove</button>
                  </div>)}
                  {images.length < 7 && imageUploadField(item.group.toLowerCase(), url => updateImages([...images, url]), item.name)}
                </div>
                {images.length < 7 && <label className="admin-field"><span>Add an image URL (optional)</span><input type="url" inputMode="url" value={settings['pendingGalleryUrl:' + item.name] || ''} placeholder="Paste a direct HTTPS image URL" onChange={e => setSettings(current => ({ ...current, ['pendingGalleryUrl:' + item.name]: e.target.value }))} /></label>}
                {images.length < 7 && <button type="button" className="btn outline" onClick={() => {
                  const value = settings['pendingGalleryUrl:' + item.name] || '';
                  if (!/^https:\/\//i.test(value)) { setError('Enter a valid HTTPS image URL first.'); return; }
                  updateImages([...images, value]); setSettings(current => ({ ...current, ['pendingGalleryUrl:' + item.name]: '' })); setError('');
                }}>Add image URL</button>}
              </div>;
            })}
          </div>
          <button className="btn primary" type="submit" disabled={busy}><Save size={16}/> {busy ? 'Saving photos…' : 'Save category photos'}</button>
        </form>
      ) : tab === 'settings' ? (
        <form className="admin-editor" onSubmit={saveSettings}>
          <h2>Home page message</h2>
          <label className="admin-field"><span>Main heading</span><input value={settings.heroTitle} onChange={e => setSettings({ ...settings, heroTitle: e.target.value })} maxLength={160} required /></label>
          <label className="admin-field"><span>Introductory text</span><textarea rows={4} value={settings.heroText} onChange={e => setSettings({ ...settings, heroText: e.target.value })} maxLength={600} required /></label>
          <button className="btn primary" type="submit" disabled={busy}><Save size={16}/> Save home page text</button>
        </form>
      ) : tab === 'design-submissions' ? (
        <div className="admin-list-wrap">
          <div className="admin-list-heading"><h2>Design review and approval</h2><button type="button" className="btn outline" onClick={() => load('design-submissions')}><RefreshCw size={15}/> Refresh</button></div>
          <p className="admin-hint">Review private files here. Approving automatically copies the submitted preview image into public design storage and publishes the listing. Requesting changes or declining saves your feedback and opens an email draft for you to send to the designer.</p>
          {rows.length === 0 ? <p>No designer submissions were found.</p> : rows.filter((row, index, all) => all.findIndex(item => String(item.id) === String(row.id)) === index).map(row => <article className="admin-list-item enquiry-item" key={String(row.id)}>
            <div className="admin-item-main">
              <strong>#{row.id} · {row.title}</strong>
              <span>{row.category} · {row.review_state === 'needs_revision' ? 'Needs revision' : row.review_state === 'declined' ? 'Declined' : row.review_state === 'approved' || row.status === 'published' ? 'Approved and published' : 'Pending review'}</span>
              <p>{row.designer_name} · {row.designer_email} · {row.designer_phone}</p>
              <p className="admin-details">{row.description || ''}</p>
              {(row.design_package || row.included_drawings || row.file_format) && <div className="admin-design-scope"><strong>Package & drawing scope</strong><p><b>Package:</b> {designPackageLabel(row.design_package)}</p><p><b>Included drawings:</b> {row.included_drawings || 'Not specified'}</p><p><b>File format:</b> {row.file_format || 'Not specified'} · <b>Editable files:</b> {row.editable_files || 'Not specified'}</p><p><b>Design status:</b> {row.design_status || 'Not specified'} · <b>Intended country:</b> {row.intended_country || 'Not specified'}</p></div>}
              {row.portfolio_url && <p><a href={row.portfolio_url} target="_blank" rel="noopener noreferrer">Open portfolio link</a></p>}
              {row.review_feedback && <p className="admin-hint"><strong>Previous review feedback:</strong> {row.review_feedback}</p>}
              {rows.filter(fileRow => String(fileRow.id) === String(row.id) && fileRow.file_id).map(fileRow => <p key={String(fileRow.file_id)}><a className="btn outline" href={'/api/admin/design-submissions/' + row.id + '/files/' + fileRow.file_id}>{fileRow.file_kind === 'preview' ? 'View/download private preview' : 'Download private design file'} · {fileRow.file_name} ({Math.max(1, Math.round(Number(fileRow.file_size || 0) / 1024))} KB)</a></p>)}
              {!rows.some(fileRow => String(fileRow.id) === String(row.id) && fileRow.file_id) && <p className="admin-hint">No uploaded file is attached to this submission.</p>}
              <label className="admin-field"><span>Review feedback (required for improvements or decline)</span><textarea rows={3} value={reviewFeedback[String(row.id)] ?? ''} onChange={e => setReviewFeedback(current => ({ ...current, [String(row.id)]: e.target.value }))} placeholder="Explain clearly what needs changing, or why the submission cannot be accepted." /></label>
              <div className="admin-review-actions">
                <button className="btn primary" type="button" disabled={reviewingId === Number(row.id) || row.status === 'published'} onClick={() => void reviewSubmission(row, 'approve')}>{reviewingId === Number(row.id) ? 'Saving review…' : row.status === 'published' ? 'Published' : 'Approve & publish'}</button>
                <button className="btn outline" type="button" disabled={reviewingId === Number(row.id) || row.status === 'published'} onClick={() => void reviewSubmission(row, 'request_changes')}>Request improvements</button>
                <button className="btn outline" type="button" disabled={reviewingId === Number(row.id) || row.status === 'published'} onClick={() => void reviewSubmission(row, 'decline')}>Decline submission</button>
              </div>
            </div>
          </article>)}
        </div>
      ) : tab === 'enquiries' ? (
        <div className="admin-list-wrap">
          <div className="admin-list-heading"><h2>Customer enquiries</h2><button type="button" className="btn outline" onClick={() => load('enquiries')}><RefreshCw size={15}/> Refresh</button></div>
          {rows.length === 0 ? <p>No enquiries have been saved yet.</p> : rows.map(row => <article className="admin-list-item enquiry-item" key={row.id}>
            <div className="admin-item-main"><strong>#{row.id} · {row.name}</strong><span>{row.type === 'material' ? 'Material enquiry' : row.type === 'career' ? 'Career application' : 'Construction quote'} · {row.created_at}</span><p>{row.company || ''} {row.phone || ''} {row.email || ''}</p><p>{row.subject || ''}</p><p className="admin-details">{row.details || ''}</p>{row.cv_file_name && <p><a className="btn outline" href={'/api/admin/enquiries/' + row.id + '/cv'} download><span>Download CV · {row.cv_file_name}</span></a></p>}</div>
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
            {tab === 'designs' && <>
              {field('Design title', 'title')}
              {field('Description', 'description', true)}
              <label className="admin-field"><span>Category</span><select value={record.category || 'Residential'} onChange={e => setRecord({ ...record, category: e.target.value })}>{['Residential','Commercial','Education','Healthcare','Infrastructure','Other projects'].map(x => <option key={x}>{x}</option>)}</select></label>
              {field('Designer name', 'designer_name')}{field('Designer email (private)', 'designer_email')}{field('Designer phone (private)', 'designer_phone')}{field('Portfolio URL', 'portfolio_url')}{field('Preview image URL', 'image_url')}{imageUploadField('designs', url => setRecord(current => ({ ...current, image_url: url })), record.title || 'Design preview', record.description || '')}{field('Price label', 'price_label')}
              <label className="admin-field"><span>Review status</span><select value={record.status || 'pending'} onChange={e => setRecord({ ...record, status: e.target.value })}><option value="pending">Pending review</option><option value="published">Published</option><option value="rejected">Rejected</option></select></label>
              <label className="admin-checkbox"><input type="checkbox" checked={Boolean(record.rights_confirmed)} onChange={e => setRecord({ ...record, rights_confirmed: e.target.checked })}/><span>Designer confirms ownership or permission to submit</span></label>
              <p className="admin-hint">Preview images can be uploaded from the admin dashboard to Cloudflare storage. Architectural drawing files are not yet supported here; arrange file transfer separately. Only designs marked Published appear in the public catalogue.</p>
            </>}
            {tab === 'products' && <>
              {field('Product name', 'name')}
              {field('Description', 'description', true)}
              <label className="admin-field"><span>Category</span><select value={record.category || 'Other Building Materials'} onChange={e => setRecord({ ...record, category: e.target.value })}>{['Sand','Bricks and Blocks','Cement','Lime','Aggregates','Hardcore','Building Stones','Reinforcement Steel','Roofing Materials','Concrete Materials','Other Building Materials'].map(x => <option key={x}>{x}</option>)}</select></label>
              <div className="admin-two-col">{field('Price (optional, UGX)', 'price', false, 'Leave blank to quote on request')}{field('Unit (e.g. bag, tonne)', 'unit')}</div>
              {field('Photo URL', 'image_url', false, 'Paste an image URL')}{imageUploadField('products', url => setRecord(current => ({ ...current, image_url: url })), record.name || 'Building material', record.description || '')}
            </>}
            {tab === 'services' && <>{field('Service name', 'name')}{field('Description', 'description', true)}{field('Display order', 'sort_order')}</>}
            {tab === 'projects' && <>{field('Project title', 'title')}{field('Description', 'description', true)}{field('Location (optional)', 'location')}{field('Photo URL', 'image_url', false, 'Paste an image URL')}{imageUploadField('projects', url => setRecord(current => ({ ...current, image_url: url })), record.title || 'Construction project', record.description || '')}</>}
            {tab === 'videos' && <>{field('Video title', 'title')}{field('Description', 'description', true)}{field('YouTube or Vimeo link', 'video_url', false, 'Paste a YouTube or Vimeo video link')}<label className="admin-field"><span>Show video in</span><select value={record.placement || 'website'} onChange={e => setRecord({ ...record, placement: e.target.value })}><option value="website">Main website</option><option value="shop">Building materials shop</option><option value="both">Website and shop</option></select></label><p className="admin-hint">Use a public YouTube or Vimeo video link. The website embeds the video; it does not upload large video files directly.</p></>}
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
