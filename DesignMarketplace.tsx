import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Building2, BriefcaseBusiness, GraduationCap, HeartPulse, House, Landmark, Send, ShieldCheck, UploadCloud } from 'lucide-react'

const WHATSAPP = 'https://wa.me/27620686282'
const categories = [
  { title: 'Residential', description: 'House concepts, family homes, townhouses and apartments.', icon: House },
  { title: 'Commercial', description: 'Shops, offices, small plazas and shopping centres.', icon: Building2 },
  { title: 'Education', description: 'School concepts and learning facilities.', icon: GraduationCap },
  { title: 'Healthcare', description: 'Clinic and healthcare facility concepts.', icon: HeartPulse },
  { title: 'Infrastructure', description: 'Bridge, road and public-infrastructure concepts.', icon: Landmark },
  { title: 'Other projects', description: 'Tell us what you are planning and what expertise you need.', icon: BriefcaseBusiness },
]
const whatsappUrl = (message: string) => WHATSAPP + '?text=' + encodeURIComponent(message)

export default function DesignMarketplace() {
  const [requestSent, setRequestSent] = useState(false)
  const [professionalSent, setProfessionalSent] = useState(false)

  function submitWhatsApp(e: React.FormEvent<HTMLFormElement>, kind: 'customer' | 'professional') {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const fields = kind === 'customer'
      ? ['Eyaelo Design Marketplace — Custom Project Enquiry', 'Name: ' + data.get('name'), 'Email: ' + data.get('email'), 'Phone: ' + data.get('phone'), 'Project category: ' + data.get('category'), 'Location in South Africa: ' + data.get('location'), 'Indicative budget (ZAR): ' + (data.get('budget') || 'Not provided'), 'Project brief: ' + data.get('brief')]
      : ['Eyaelo Design Marketplace — Professional Submission Enquiry', 'Name: ' + data.get('name'), 'Email: ' + data.get('email'), 'Phone: ' + data.get('phone'), 'Professional role: ' + data.get('role'), 'Registration / credentials: ' + (data.get('credentials') || 'Not provided'), 'Portfolio link: ' + (data.get('portfolio') || 'Not provided'), 'Design category: ' + data.get('category'), 'Notes: ' + (data.get('notes') || 'Not provided'), 'I understand Eyaelo reviews submissions before publication. I will send artwork files separately after contacting Eyaelo.']
    window.location.href = whatsappUrl(fields.join('\n'))
    if (kind === 'customer') setRequestSent(true)
    else setProfessionalSent(true)
  }

  return <div className="marketplace-page">
    <section className="market-hero"><div className="container market-hero-grid"><div>
      <span className="eyebrow">EYAelo DESIGN MARKETPLACE · SOUTH AFRICA</span>
      <h1>Find a design.<br/>Bring your vision to life.</h1>
      <p>Explore architectural concepts and connect with design professionals for your next residential, commercial or community project.</p>
      <div className="actions"><a className="btn primary" href="#browse-designs">Explore categories <ArrowRight size={17}/></a><a className="btn secondary" href="#custom-request">Request a custom design</a></div>
      <p className="market-note">Enquiry-based launch · Prices and availability confirmed individually · No online checkout yet</p>
    </div><div className="market-hero-panel"><div className="market-panel-icon"><Building2 size={34}/></div><span className="eyebrow dark">A NEW WAY TO PLAN</span><h2>Ideas meet expertise.</h2><p>Browse design categories, tell us what you need, or apply to showcase your professional work.</p><div className="market-trust"><ShieldCheck size={19}/><span>Every submitted design is reviewed by Eyaelo before publication.</span></div></div></div></section>

    <section className="section" id="browse-designs"><div className="container"><div className="section-head"><div><span className="eyebrow dark">BROWSE BY PROJECT</span><h2>What are you planning?</h2></div><span className="market-coming-label">Catalogue onboarding now</span></div>
      <div className="market-category-grid">{categories.map(({title, description, icon: Icon}) => <article className="market-category" key={title}><div className="market-category-icon"><Icon size={23}/></div><h3>{title}</h3><p>{description}</p><a href="#custom-request" className="text-link">Enquire about this category <ArrowRight size={15}/></a></article>)}</div>
      <div className="market-empty"><UploadCloud size={31}/><div><h3>Ready-made designs are being onboarded</h3><p>We are reviewing original artwork and professional submissions before publishing listings. Contact us to ask about a design or register your interest.</p></div><a className="btn primary" href={whatsappUrl('Hello Eyaelo, I would like to enquire about ready-made designs in the Design Marketplace.')}>Enquire on WhatsApp <ArrowRight size={16}/></a></div>
    </div></section>

    <section className="section muted" id="custom-request"><div className="container market-form-grid"><div><span className="eyebrow dark">CUSTOM PROJECT</span><h2>Tell us what you want to create.</h2><p className="lead">Share your project type, location and brief. Eyaelo will follow up manually to discuss your requirements and help connect you with an appropriate professional.</p><ul className="market-checks"><li><ShieldCheck size={18}/> No payment is taken through this form.</li><li><ShieldCheck size={18}/> Any quote and service fee will be explained before you commit.</li><li><ShieldCheck size={18}/> Construction-ready plans and approvals depend on applicable professional requirements.</li></ul></div>
      <form className="form market-form" onSubmit={e=>submitWhatsApp(e,'customer')}><h3>Request a custom design</h3><div className="form-grid">
        <label>Name *<input name="name" required autoComplete="name" placeholder="Your full name"/></label><label>Email *<input name="email" required type="email" autoComplete="email" placeholder="you@example.com"/></label><label>Phone *<input name="phone" required type="tel" autoComplete="tel" placeholder="Your phone number"/></label>
        <label>Project category *<select name="category" required defaultValue=""><option value="" disabled>Select category</option>{categories.map(c=><option key={c.title}>{c.title}</option>)}</select></label>
        <label className="full">Project location in South Africa *<input name="location" required placeholder="Town, city or province"/></label><label className="full">Indicative budget (ZAR)<input name="budget" placeholder="Optional — e.g. R5,000 to R10,000"/></label><label className="full">Project brief *<textarea name="brief" required rows={5} placeholder="Describe the building, approximate size, intended use and what you need."/></label>
      </div><p className="form-note">Submitting opens WhatsApp with your enquiry prepared. Review the message and tap Send in WhatsApp to deliver it.</p><button className="btn primary" type="submit">Prepare enquiry <Send size={16}/></button>{requestSent&&<p className="market-inline-note" role="status">Your WhatsApp message was prepared. Please send it in WhatsApp to complete your enquiry.</p>}</form>
    </div></section>

    <section className="section" id="freelance-designers"><div className="container market-form-grid"><div><span className="eyebrow dark">FOR FREELANCERS & DESIGN PROFESSIONALS</span><h2>Freelance architect or designer? Showcase your work with Eyaelo.</h2><p className="lead">Are you a freelance architect, architectural technologist, draughtsperson, civil or structural engineer, or building-design professional? Submit original designs to Eyaelo Construction Ltd, reach potential customers, and explore opportunities to earn from your creative work.</p><p>We welcome eligible residential, commercial, education, healthcare and infrastructure concepts. Eyaelo reviews every submission before publication. Contact us to discuss how your work may be listed and what service fees, sales terms and usage rights apply.</p><ul className="market-checks"><li><ShieldCheck size={18}/> Every submission is reviewed before publication.</li><li><ShieldCheck size={18}/> Submit only work you own or are authorised to offer.</li><li><ShieldCheck size={18}/> Professional registration or credentials may be requested where relevant.</li><li><ShieldCheck size={18}/> Sales, service fees and usage rights are agreed before a transaction; submission does not guarantee a sale.</li></ul></div>
      <form className="form market-form" onSubmit={e=>submitWhatsApp(e,'professional')}><h3>Register professional interest</h3><div className="form-grid">
        <label>Name *<input name="name" required autoComplete="name" placeholder="Your full name"/></label><label>Email *<input name="email" required type="email" autoComplete="email" placeholder="you@example.com"/></label><label>Phone *<input name="phone" required type="tel" autoComplete="tel" placeholder="Your phone number"/></label>
        <label>Professional role *<select name="role" required defaultValue=""><option value="" disabled>Select role</option><option>Architect</option><option>Architectural technologist</option><option>Architectural draughtsperson / draughtsperson</option><option>Civil / structural engineer</option><option>Building designer</option><option>Freelance designer</option><option>Other design professional</option></select></label>
        <label className="full">Registration / credentials (if applicable)<input name="credentials" placeholder="Professional body and registration number, if applicable"/></label><label className="full">Portfolio link<input name="portfolio" type="url" placeholder="https://..."/></label>
        <label className="full">Design category *<select name="category" required defaultValue=""><option value="" disabled>Select category</option>{categories.map(c=><option key={c.title}>{c.title}</option>)}</select></label><label className="full">Notes<textarea name="notes" rows={3} placeholder="Tell us about your work or designs you would like to submit."/></label>
      </div><p className="form-note">This form does not upload artwork. After contacting Eyaelo, you can send files separately for review. Submission does not guarantee publication.</p><button className="btn primary" type="submit">Register interest <ArrowRight size={16}/></button>{professionalSent&&<p className="market-inline-note" role="status">Your WhatsApp message was prepared. Please send it in WhatsApp to complete your enquiry.</p>}</form>
    </div></section>
    <section className="cta-band"><div className="container"><div><span className="eyebrow dark">LET'S GET STARTED</span><h2>Your project begins with a conversation.</h2></div><Link className="btn primary" to="/contact">Contact Eyaelo <ArrowRight size={17}/></Link></div></section>
  </div>
}
