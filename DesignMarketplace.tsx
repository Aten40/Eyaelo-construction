import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Building2, BriefcaseBusiness, GraduationCap, HeartPulse, House, Landmark, Send, ShieldCheck, UploadCloud } from 'lucide-react'

const WHATSAPP = 'https://wa.me/27620686282'
const categories = [
  { title: 'Residential', description: 'House concepts, family homes, townhouses and apartments.', icon: House },
  { title: 'Commercial', description: 'Shops, offices, small plazas and shopping centres.', icon: Building2 },
  { title: 'Education', description: 'School concepts and learning facilities.', icon: GraduationCap },
  { title: 'Healthcare', description: 'Clinic and healthcare facility concepts.', icon: HeartPulse },
  { title: 'Infrastructure', description: 'Bridge, road and public-infrastructure concepts.', icon: Landmark },
  { title: 'Other projects', description: 'Other building and design concepts.', icon: BriefcaseBusiness },
]
const countries = [
  "Afghanistan",
  "Albania",
  "Algeria",
  "Andorra",
  "Angola",
  "Antigua and Barbuda",
  "Argentina",
  "Armenia",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Bahamas",
  "Bahrain",
  "Bangladesh",
  "Barbados",
  "Belarus",
  "Belgium",
  "Belize",
  "Benin",
  "Bhutan",
  "Bolivia",
  "Bosnia and Herzegovina",
  "Botswana",
  "Brazil",
  "Brunei",
  "Bulgaria",
  "Burkina Faso",
  "Burundi",
  "Cabo Verde",
  "Cambodia",
  "Cameroon",
  "Canada",
  "Central African Republic",
  "Chad",
  "Chile",
  "China",
  "Colombia",
  "Comoros",
  "Congo (Republic of the)",
  "Costa Rica",
  "Côte d’Ivoire",
  "Croatia",
  "Cuba",
  "Cyprus",
  "Czechia",
  "Democratic Republic of the Congo",
  "Denmark",
  "Djibouti",
  "Dominica",
  "Dominican Republic",
  "Ecuador",
  "Egypt",
  "El Salvador",
  "Equatorial Guinea",
  "Eritrea",
  "Estonia",
  "Eswatini",
  "Ethiopia",
  "Fiji",
  "Finland",
  "France",
  "Gabon",
  "Gambia",
  "Georgia",
  "Germany",
  "Ghana",
  "Greece",
  "Grenada",
  "Guatemala",
  "Guinea",
  "Guinea-Bissau",
  "Guyana",
  "Haiti",
  "Honduras",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Ireland",
  "Israel",
  "Italy",
  "Jamaica",
  "Japan",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Kiribati",
  "Kuwait",
  "Kyrgyzstan",
  "Laos",
  "Latvia",
  "Lebanon",
  "Lesotho",
  "Liberia",
  "Libya",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Madagascar",
  "Malawi",
  "Malaysia",
  "Maldives",
  "Mali",
  "Malta",
  "Marshall Islands",
  "Mauritania",
  "Mauritius",
  "Mexico",
  "Micronesia",
  "Moldova",
  "Monaco",
  "Mongolia",
  "Montenegro",
  "Morocco",
  "Mozambique",
  "Myanmar",
  "Namibia",
  "Nauru",
  "Nepal",
  "Netherlands",
  "New Zealand",
  "Nicaragua",
  "Niger",
  "Nigeria",
  "North Korea",
  "North Macedonia",
  "Norway",
  "Oman",
  "Pakistan",
  "Palau",
  "Palestine",
  "Panama",
  "Papua New Guinea",
  "Paraguay",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Qatar",
  "Romania",
  "Russia",
  "Rwanda",
  "Saint Kitts and Nevis",
  "Saint Lucia",
  "Saint Vincent and the Grenadines",
  "Samoa",
  "San Marino",
  "São Tomé and Príncipe",
  "Saudi Arabia",
  "Senegal",
  "Serbia",
  "Seychelles",
  "Sierra Leone",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "Solomon Islands",
  "Somalia",
  "South Africa",
  "South Korea",
  "South Sudan",
  "Spain",
  "Sri Lanka",
  "Sudan",
  "Suriname",
  "Sweden",
  "Switzerland",
  "Syria",
  "Taiwan",
  "Tajikistan",
  "Tanzania",
  "Thailand",
  "Timor-Leste",
  "Togo",
  "Tonga",
  "Trinidad and Tobago",
  "Tunisia",
  "Türkiye",
  "Turkmenistan",
  "Tuvalu",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Uzbekistan",
  "Vanuatu",
  "Vatican City",
  "Venezuela",
  "Vietnam",
  "Yemen",
  "Zambia",
  "Zimbabwe"
]
type Design = { id: number; title: string; description: string; category: string; designer_name: string; image_url: string; price_label: string }
const whatsappUrl = (message: string) => WHATSAPP + '?text=' + encodeURIComponent(message)

export default function DesignMarketplace() {
  const [designs, setDesigns] = useState<Design[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('All designs')
  const [selectedDesign, setSelectedDesign] = useState('')
  const [requestSent, setRequestSent] = useState(false)
  const [submissionBusy, setSubmissionBusy] = useState(false)
  const [submissionMessage, setSubmissionMessage] = useState('')
  const [submissionError, setSubmissionError] = useState('')

  useEffect(() => {
    fetch('/api/designs').then(r => r.ok ? r.json() : []).then((rows: Design[]) => setDesigns(Array.isArray(rows) ? rows : [])).catch(() => setDesigns([])).finally(() => setLoading(false))
  }, [])

  function submitWhatsApp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const fields = ['Eyaelo Design Marketplace — Worldwide Design / Architectural Drawings Enquiry', 'Name: ' + data.get('name'), 'Email: ' + data.get('email'), 'Phone / WhatsApp: ' + data.get('phone'), 'Country: ' + data.get('country'), 'Project location / site: ' + data.get('location'), 'Enquiry type: ' + data.get('request_type'), 'Project category: ' + data.get('category'), 'Design selected: ' + (data.get('design') || 'No specific design'), 'Indicative budget: ' + ([data.get('budget'), data.get('currency')].filter(Boolean).join(' ') || 'Not provided'), 'Project brief: ' + data.get('brief')]
    window.location.href = whatsappUrl(fields.join('\n'))
    setRequestSent(true)
  }

  async function submitProfessional(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    setSubmissionBusy(true); setSubmissionMessage(''); setSubmissionError('')
    const data = new FormData(e.currentTarget)
    data.set('rights_confirmed', data.get('rights') === 'on' ? 'true' : 'false')
    data.delete('rights')
    try {
      const response = await fetch('/api/design-submissions', { method: 'POST', body: data })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not submit your design details.')
      setSubmissionMessage(result.file_uploaded ? 'Thank you. Your design details and file have been received privately for review. Only authorised Eyaelo administrators can download the file. Your submission remains pending until reviewed.' : 'Thank you. Your design details have been saved privately for review. Your submission remains pending until reviewed.')
      form.reset()
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'Submission failed. Please try again.')
    } finally { setSubmissionBusy(false) }
  }

  const visibleDesigns = selectedCategory === 'All designs' ? designs : designs.filter(d => d.category === selectedCategory)

  return <div className="marketplace-page">
    <section className="market-hero"><div className="container market-hero-grid"><div>
      <span className="eyebrow">EYAelo DESIGN MARKETPLACE · WORLDWIDE</span>
      <h1>Find a design.<br/>Bring your vision to life.</h1>
      <p>Explore Eyaelo-reviewed designs and architectural drawings from anywhere in the world. Enquire to purchase a ready-made design or request a custom design for your project.</p>
      <div className="actions"><a className="btn primary" href="#browse-designs">Browse catalogue <ArrowRight size={17}/></a><a className="btn secondary" href="#custom-request">Make an enquiry</a></div>
      <p className="market-note">Worldwide enquiries · Prices confirmed individually · Manual payment arrangements · No online checkout yet</p>
    </div><div className="market-hero-panel"><div className="market-panel-icon"><Building2 size={34}/></div><span className="eyebrow dark">A NEW WAY TO PLAN</span><h2>Ideas meet expertise.</h2><p>Browse approved designs, enquire about a listing, or submit your own original work for review.</p><div className="market-trust"><ShieldCheck size={19}/><span>Only designs approved by Eyaelo appear in the public catalogue.</span></div></div></div></section>

    <section className="section" id="browse-designs"><div className="container"><div className="section-head"><div><span className="eyebrow dark">BROWSE BY PROJECT</span><h2>Explore the design catalogue</h2></div><span className="market-coming-label">{designs.length} published design{designs.length === 1 ? '' : 's'}</span></div>
      <div className="market-category-grid">{categories.map(({title, description, icon: Icon}) => <article className="market-category" key={title}><div className="market-category-icon"><Icon size={23}/></div><h3>{title}</h3><p>{description}</p><button type="button" className="text-link market-filter-link" onClick={() => { setSelectedCategory(title); document.getElementById('catalogue-listings')?.scrollIntoView({behavior:'smooth'}) }}>Browse {title} <ArrowRight size={15}/></button></article>)}</div>
      <div className="catalogue-toolbar"><div><h3>Available designs</h3><p>Choose a category to narrow the catalogue.</p></div><label>Category <select value={selectedCategory} onChange={e=>setSelectedCategory(e.target.value)}><option>All designs</option>{categories.map(c=><option key={c.title}>{c.title}</option>)}</select></label></div>
      <div id="catalogue-listings" className="catalogue-listings">{loading ? <p>Loading catalogue…</p> : visibleDesigns.length ? visibleDesigns.map(design => <article className="catalogue-card" key={design.id}>{design.image_url ? <img src={design.image_url} alt={design.title} loading="lazy"/> : <div className="catalogue-card-placeholder"><House size={34}/><span>Design preview coming soon</span></div>}<div className="catalogue-card-body"><span className="eyebrow dark">{design.category}</span><h3>{design.title}</h3><p>{design.description}</p><p className="catalogue-byline">{design.designer_name ? 'By ' + design.designer_name : 'Eyaelo reviewed design'}</p><div className="catalogue-card-foot"><strong>{design.price_label || 'Enquire for price'}</strong><button className="btn primary" type="button" onClick={() => { setSelectedDesign(design.title); document.getElementById('custom-request')?.scrollIntoView({behavior:'smooth'}) }}>Enquire <ArrowRight size={15}/></button></div></div></article>) : <div className="market-empty"><UploadCloud size={31}/><div><h3>{selectedCategory === 'All designs' ? 'The catalogue is ready for its first designs' : 'No designs published in this category yet'}</h3><p>We publish designs only after Eyaelo has reviewed the submission. Choose another category or submit original work below.</p></div></div>}</div>
    </div></section>

    <section className="section muted" id="custom-request"><div className="container market-form-grid"><div><span className="eyebrow dark">ONE ENQUIRY FORM</span><h2>Purchase a design or commission architectural drawings.</h2><p className="lead">Clients in any country can enquire about purchasing ready-made designs and architectural drawings, or request a custom design. Eyaelo will confirm scope, price, file delivery, and any local professional or approval requirements before payment.</p><ul className="market-checks"><li><ShieldCheck size={18}/> No payment is taken through this form.</li><li><ShieldCheck size={18}/> Quotes and service fees are explained before you commit.</li><li><ShieldCheck size={18}/> Construction-ready plans and approvals depend on applicable professional requirements.</li></ul></div>
      <form className="form market-form" onSubmit={submitWhatsApp}><h3>Worldwide design and project enquiry</h3><div className="form-grid"><label>Name *<input name="name" required autoComplete="name" placeholder="Your full name"/></label><label>Email *<input name="email" required type="email" autoComplete="email" placeholder="you@example.com"/></label><label>Phone *<input name="phone" required type="tel" autoComplete="tel" placeholder="Your phone number"/></label><label>Project category *<select name="category" required defaultValue=""><option value="" disabled>Select category</option>{categories.map(c=><option key={c.title}>{c.title}</option>)}</select></label>
        <label className="full">Design you are enquiring about<input name="design" value={selectedDesign} onChange={e=>setSelectedDesign(e.target.value)} placeholder="Optional — select Enquire on a catalogue design"/></label><label>Country *<select name="country" required defaultValue=""><option value="" disabled>Select your country</option>{countries.map(country => <option key={country} value={country}>{country}</option>)}</select></label><label>City / project location *<input name="location" required placeholder="City, region or project site"/></label><label className="full">What do you need? *<select name="request_type" required defaultValue=""><option value="" disabled>Choose an enquiry type</option><option>Purchase a ready-made design or architectural drawings</option><option>Custom architectural design and drawings</option><option>Commercial or infrastructure project design</option><option>Other design or project enquiry</option></select></label><label>Indicative budget<input name="budget" placeholder="Optional amount"/></label><label>Budget currency<input name="currency" placeholder="e.g. USD, GBP, EUR, ZAR" maxLength={8}/></label><label className="full">Project brief *<textarea name="brief" required rows={5} placeholder="Describe the building, approximate size, intended use and what you need."/></label></div><p className="form-note">Submitting opens WhatsApp with your enquiry prepared. Review the message and tap Send in WhatsApp to deliver it.</p><button className="btn primary" type="submit">Prepare enquiry <Send size={16}/></button>{requestSent&&<p className="market-inline-note" role="status">Your WhatsApp message was prepared. Please send it in WhatsApp to complete your enquiry.</p>}</form>
    </div></section>

    <section className="section" id="freelance-designers"><div className="container market-form-grid"><div><span className="eyebrow dark">FOR FREELANCERS & DESIGN PROFESSIONALS</span><h2>Freelance architect or designer? Showcase your work with Eyaelo.</h2><p className="lead">Are you a freelance architect, architectural technologist, draughtsperson, civil or structural engineer, or building-design professional? Submit original designs to Eyaelo Construction Ltd, reach potential customers, and explore opportunities to earn from your creative work.</p><p>We welcome eligible concepts. Eyaelo reviews every submission before publication. Service fees, sales terms and usage rights are agreed before any transaction.</p><ul className="market-checks"><li><ShieldCheck size={18}/> Every submission is reviewed before publication.</li><li><ShieldCheck size={18}/> Submit only work you own or are authorised to offer.</li><li><ShieldCheck size={18}/> Professional registration or credentials may be requested where relevant.</li></ul></div>
      <form className="form market-form" onSubmit={submitProfessional}><h3>Submit a design for review</h3><div className="form-grid"><label>Design title *<input name="title" required maxLength={160} placeholder="e.g. Three-bedroom family home"/></label><label>Design category *<select name="category" required defaultValue=""><option value="" disabled>Select category</option>{categories.map(c=><option key={c.title}>{c.title}</option>)}</select></label><label>Your name *<input name="name" required autoComplete="name" placeholder="Full name"/></label><label>Email *<input name="email" required type="email" autoComplete="email" placeholder="you@example.com"/></label><label>Phone *<input name="phone" required type="tel" autoComplete="tel" placeholder="Phone number"/></label><label>Portfolio link<input name="portfolio" type="url" placeholder="https://... (optional)"/></label><label className="full">Describe the design *<textarea name="description" required rows={4} maxLength={3000} placeholder="Describe the concept, rooms, approximate size and intended use."/></label><label className="full">Attach architectural file (optional)<input name="design_file" type="file" accept=".pdf,.dwg,.dxf,.doc,.docx,.zip,application/pdf,application/acad,application/zip"/><span className="form-note">Accepted: PDF, DWG, DXF, DOC, DOCX or ZIP. Maximum 20 MB. Files are stored privately for Eyaelo review.</span></label><label className="full market-rights"><input name="rights" type="checkbox" required/><span>I confirm I own this work or have permission to submit it for review. *</span></label></div><p className="form-note">Your architectural file is uploaded privately for review and is not published in the public catalogue. Preview images are not uploaded through this form yet. Do not upload files you do not own or have permission to share. Eyaelo reviews every submission before anything is published.</p><button className="btn primary" type="submit" disabled={submissionBusy}>{submissionBusy ? 'Submitting…' : 'Submit for review'} <ArrowRight size={16}/></button>{submissionMessage&&<p className="market-inline-note" role="status">{submissionMessage}</p>}{submissionError&&<p className="admin-alert" role="alert">{submissionError}</p>}</form>
    </div></section>
    <section className="cta-band"><div className="container"><div><span className="eyebrow dark">LET'S GET STARTED</span><h2>Your project begins with a conversation.</h2></div><Link className="btn primary" to="/contact">Contact Eyaelo <ArrowRight size={17}/></Link></div></section>
  </div>
}
