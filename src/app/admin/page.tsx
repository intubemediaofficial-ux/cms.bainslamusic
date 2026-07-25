'use client';

import { useEffect, useRef, useState } from 'react';

export default function AdminPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [data, setData] = useState<Record<string, unknown>>({
    settings: {}, banners: [], releases: [], artists: [], videos: [], catalogue: [], licensing: [], inquiries: [], distribution: []
  });

  const ADMIN_USER = 'admin';
  const ADMIN_PASS = 'Bainsla@2024';

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (username === ADMIN_USER && password === ADMIN_PASS) {
      setLoggedIn(true);
      setError('');
      loadData();
    } else {
      setError('Invalid credentials');
    }
  }

  function loadData() {
    try {
      const stored = localStorage.getItem('bainsla_admin_data');
      if (stored) {
        setData(JSON.parse(stored));
      } else {
        const defaultData = getDefaultData();
        setData(defaultData);
        localStorage.setItem('bainsla_admin_data', JSON.stringify(defaultData));
      }
    } catch {
      setData(getDefaultData());
    }
  }

  function saveData(newData: Record<string, unknown>) {
    setData(newData);
    localStorage.setItem('bainsla_admin_data', JSON.stringify(newData));
  }

  function toast(msg: string) {
    const t = document.createElement('div');
    t.style.cssText = 'position:fixed;top:20px;right:20px;padding:14px 24px;border-radius:8px;font-size:13px;font-weight:600;z-index:200;background:#16a34a;color:#fff;box-shadow:0 8px 32px rgba(0,0,0,.3);animation:slideIn .3s ease';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = '@keyframes slideIn{from{transform:translateX(100px);opacity:0}to{transform:translateX(0);opacity:1}}';
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('.admin-profile-wrap') && !target.closest('.dropdown-menu-wrap')) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  if (!loggedIn) {
    return (
      <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0a0a0a',backgroundImage:'radial-gradient(ellipse at 50% 0%,rgba(245,158,11,.08) 0%,transparent 60%)',fontFamily:'Inter,-apple-system,BlinkMacSystemFont,sans-serif'}}>
        <div style={{background:'#111',border:'1px solid #222',borderRadius:20,padding:'48px 40px',width:420,textAlign:'center'}}>
          <div style={{fontSize:48,color:'#f59e0b',marginBottom:8}}>♪</div>
          <div style={{fontSize:28,fontWeight:900,color:'#fff',letterSpacing:3}}>INTUBEMEDIA</div>
          <div style={{fontSize:11,color:'#f59e0b',letterSpacing:4,marginBottom:8}}>PRIVATE LIMITED</div>
          <p style={{color:'#666',fontSize:13,marginBottom:28}}>Admin Dashboard</p>
          <form onSubmit={handleLogin}>
            <div style={{textAlign:'left',marginBottom:16}}>
              <label style={{display:'block',fontSize:11,color:'#999',marginBottom:6,fontWeight:600,letterSpacing:.5}}>Username</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter username" required
                style={{width:'100%',padding:'13px 16px',background:'#1a1a1a',border:'1px solid #333',borderRadius:8,color:'#fff',fontSize:14,outline:'none',boxSizing:'border-box'}} />
            </div>
            <div style={{textAlign:'left',marginBottom:16}}>
              <label style={{display:'block',fontSize:11,color:'#999',marginBottom:6,fontWeight:600,letterSpacing:.5}}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" required
                style={{width:'100%',padding:'13px 16px',background:'#1a1a1a',border:'1px solid #333',borderRadius:8,color:'#fff',fontSize:14,outline:'none',boxSizing:'border-box'}} />
            </div>
            <button type="submit" style={{width:'100%',padding:14,background:'#f59e0b',color:'#000',fontWeight:700,border:'none',borderRadius:8,cursor:'pointer',fontSize:14,letterSpacing:1,marginTop:8}}>LOGIN</button>
            {error && <p style={{color:'#dc2626',fontSize:12,marginTop:10}}>{error}</p>}
          </form>
        </div>
      </div>
    );
  }

  const sections = [
    { id: 'overview', icon: '🏠', label: 'Dashboard' },
    { id: 'banners', icon: '🖼️', label: 'Home Banner' },
    { id: 'artists', icon: '👤', label: 'Artists' },
    { id: 'releases', icon: '🎵', label: 'Releases' },
    { id: 'videos', icon: '📹', label: 'Videos' },
    { id: 'catalogue', icon: '📁', label: 'Music Catalogue' },
    { id: 'licensing', icon: '©️', label: 'Licensing' },
    { id: 'distribution', icon: '🌐', label: 'Distribution' },
    { id: 'inquiries', icon: '💬', label: 'Contact Inquiries' },
    { id: 'analytics', icon: '📊', label: 'Analytics' },
    { id: 'settings', icon: '⚙️', label: 'Settings' },
  ];

  const sectionMeta: Record<string, { title: string; subtitle: string }> = {
    overview: { title: 'Dashboard', subtitle: "Welcome back, Admin! Here's what's happening with InTubeMedia." },
    banners: { title: 'Home Banner', subtitle: 'Manage homepage hero banners for the website.' },
    artists: { title: 'Artists', subtitle: 'Manage and explore all artists associated with InTubeMedia.' },
    releases: { title: 'RELEASES', subtitle: 'Manage and upload your music releases.' },
    videos: { title: 'VIDEOS', subtitle: 'Upload, manage and publish devotional music videos.' },
    catalogue: { title: '🎵 Music Catalogue', subtitle: 'Manage your complete music catalogue.' },
    licensing: { title: 'LICENSING MANAGEMENT', subtitle: 'Manage licensing inquiries, copyright requests, and content usage permissions.' },
    distribution: { title: 'Distribution Overview', subtitle: 'Manage and monitor your music distribution across all platforms.' },
    inquiries: { title: 'Contact Inquiries', subtitle: 'View and manage contact form submissions.' },
    analytics: { title: 'Analytics Overview', subtitle: 'Track performance, audience insights and content growth across all platforms.' },
    settings: { title: '⚙️ Settings', subtitle: 'Manage company information, contact details, and social links.' },
  };

  const meta = sectionMeta[activeSection] || { title: activeSection, subtitle: '' };

  return (
    <div style={{display:'flex',minHeight:'100vh',background:'#0a0a0a',fontFamily:'Inter,-apple-system,BlinkMacSystemFont,sans-serif',color:'#e5e5e5'}}>
      {/* Sidebar */}
      <nav style={{width:220,background:'#111',borderRight:'1px solid #222',display:'flex',flexDirection:'column',position:'fixed',top:0,left:0,bottom:0,zIndex:20,transform:sidebarOpen?'translateX(0)':'',transition:'transform .3s'}} className="admin-sidebar">
        <div style={{display:'flex',alignItems:'center',gap:12,padding:'20px 16px',borderBottom:'1px solid #222'}}>
          <div style={{fontSize:36,color:'#f59e0b',lineHeight:1}}>♪</div>
          <div style={{lineHeight:1.2}}>
            <div style={{fontSize:16,fontWeight:900,color:'#fff',letterSpacing:2}}>INTUBEMEDIA</div>
            <div style={{fontSize:16,fontWeight:900,color:'#fff',letterSpacing:2,marginTop:-2}}>MUSIC</div>
            <div style={{fontSize:8,color:'#f59e0b',letterSpacing:3,marginTop:2}}>PRIVATE LIMITED</div>
          </div>
        </div>
        <ul style={{listStyle:'none',flex:1,padding:'12px 8px',overflowY:'auto',margin:0}}>
          {sections.map(s => (
            <li key={s.id} onClick={() => { setActiveSection(s.id); setSidebarOpen(false); }}
              style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',borderRadius:8,cursor:'pointer',fontSize:13,
                color: activeSection === s.id ? '#000' : '#999',
                background: activeSection === s.id ? '#f59e0b' : 'transparent',
                fontWeight: activeSection === s.id ? 700 : 400,
                marginBottom:2,transition:'all .2s'}}>
              <span style={{fontSize:16,width:20,textAlign:'center'}}>{s.icon}</span>
              <span>{s.label}</span>
            </li>
          ))}
        </ul>
        <div style={{padding:16,borderTop:'1px solid #222',textAlign:'center'}}>
          <div style={{fontSize:40,marginBottom:4}}>🎧</div>
          <div style={{fontSize:12,fontWeight:600,color:'#fff'}}>Welcome Admin</div>
          <div style={{fontSize:10,color:'#666'}}>InTubeMedia</div>
        </div>
      </nav>

      {/* Main */}
      <main style={{marginLeft:220,flex:1,minHeight:'100vh',display:'flex',flexDirection:'column'}}>
        {/* Top Bar */}
        <header style={{padding:'14px 24px',borderBottom:'1px solid #222',display:'flex',alignItems:'center',justifyContent:'space-between',background:'#0a0a0a',position:'sticky',top:0,zIndex:10}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{background:'none',border:'none',color:'#999',fontSize:22,cursor:'pointer',display:'none'}}>☰</button>
            <div>
              <h1 style={{fontSize:20,fontWeight:800,color:'#fff',margin:0}}>{meta.title}</h1>
              <p style={{fontSize:12,color:'#666',margin:'2px 0 0'}}>{meta.subtitle}</p>
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:16}}>
            <button style={{background:'none',border:'none',fontSize:20,cursor:'pointer',position:'relative',padding:4}}>🔔<span style={{position:'absolute',top:-2,right:-4,background:'#f59e0b',color:'#000',fontSize:9,fontWeight:700,width:18,height:18,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center'}}>5</span></button>
            <div className="admin-profile-wrap" style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',padding:'4px 8px',borderRadius:8}} onClick={() => setDropdownOpen(!dropdownOpen)}>
              <div style={{fontSize:28,width:36,height:36,background:'#161616',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center'}}>👤</div>
              <div style={{display:'flex',flexDirection:'column'}}>
                <span style={{fontSize:13,fontWeight:600,color:'#fff'}}>Admin</span>
                <span style={{fontSize:10,color:'#666'}}>Super Admin</span>
              </div>
              <span style={{color:'#666',fontSize:14}}>▾</span>
            </div>
          </div>
        </header>

        {dropdownOpen && (
          <div className="dropdown-menu-wrap" style={{position:'fixed',top:56,right:24,background:'#111',border:'1px solid #333',borderRadius:8,padding:'8px 0',minWidth:180,zIndex:100,boxShadow:'0 8px 32px rgba(0,0,0,.5)'}}>
            <a href="/" style={{display:'flex',alignItems:'center',gap:8,padding:'10px 16px',color:'#e5e5e5',fontSize:13,textDecoration:'none'}}>🌐 View Website</a>
            <a href="#" onClick={(e) => { e.preventDefault(); setLoggedIn(false); setDropdownOpen(false); }} style={{display:'flex',alignItems:'center',gap:8,padding:'10px 16px',color:'#e5e5e5',fontSize:13,textDecoration:'none'}}>🚪 Logout</a>
          </div>
        )}

        {/* Content */}
        <div style={{flex:1,padding:24}}>
          <SectionContent section={activeSection} data={data} saveData={saveData} toast={toast} />
        </div>

        {/* Footer */}
        <footer style={{padding:'16px 24px',borderTop:'1px solid #222',display:'flex',justifyContent:'space-between',fontSize:11,color:'#666'}}>
          <p>© 2024 InTubeMedia. All Rights Reserved.</p>
          <p>Made with ❤️ for Devotional Music</p>
        </footer>
      </main>
    </div>
  );
}

/* ═══════ Section Content Renderer ═══════ */
function SectionContent({ section, data, saveData, toast }: { section: string; data: Record<string, unknown>; saveData: (d: Record<string, unknown>) => void; toast: (m: string) => void }) {
  switch (section) {
    case 'overview': return <OverviewSection data={data} />;
    case 'banners': return <BannersSection data={data} saveData={saveData} toast={toast} />;
    case 'artists': return <ArtistsSection data={data} saveData={saveData} toast={toast} />;
    case 'releases': return <ReleasesSection data={data} saveData={saveData} toast={toast} />;
    case 'videos': return <VideosSection data={data} saveData={saveData} toast={toast} />;
    case 'catalogue': return <CatalogueSection data={data} />;
    case 'licensing': return <LicensingSection />;
    case 'distribution': return <DistributionSection />;
    case 'inquiries': return <InquiriesSection data={data} saveData={saveData} toast={toast} />;
    case 'analytics': return <AnalyticsSection />;
    case 'settings': return <SettingsSection data={data} saveData={saveData} toast={toast} />;
    default: return <div style={{textAlign:'center',padding:40,color:'#666'}}>Select a section</div>;
  }
}

/* ═══════ Shared Styles ═══════ */
const S = {
  card: { background:'#111',border:'1px solid #222',borderRadius:12,overflow:'hidden' as const,marginBottom:20 } as React.CSSProperties,
  cardHeader: { display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 20px',borderBottom:'1px solid #222' } as React.CSSProperties,
  cardTitle: { fontSize:15,fontWeight:700,color:'#f59e0b' } as React.CSSProperties,
  cardBody: { padding:20 } as React.CSSProperties,
  statCard: { background:'#111',border:'1px solid #222',borderRadius:12,padding:20,position:'relative' as const,overflow:'hidden' as const } as React.CSSProperties,
  statIcon: { position:'absolute' as const,top:16,right:16,fontSize:32,opacity:.3,color:'#f59e0b' } as React.CSSProperties,
  statLabel: { fontSize:11,color:'#999',textTransform:'uppercase' as const,letterSpacing:1,marginBottom:8 } as React.CSSProperties,
  statNumber: { fontSize:32,fontWeight:900,color:'#fff' } as React.CSSProperties,
  statChange: { fontSize:11,color:'#16a34a',marginTop:4 } as React.CSSProperties,
  btn: { padding:'9px 18px',borderRadius:6,fontSize:12,fontWeight:600,cursor:'pointer',border:'none',display:'inline-flex',alignItems:'center',gap:6,fontFamily:'inherit',letterSpacing:.3 } as React.CSSProperties,
  btnPrimary: { background:'#f59e0b',color:'#000' } as React.CSSProperties,
  btnOutline: { background:'transparent',border:'1px solid #f59e0b',color:'#f59e0b' } as React.CSSProperties,
  btnSecondary: { background:'#161616',border:'1px solid #333',color:'#999' } as React.CSSProperties,
  btnDanger: { background:'#dc2626',color:'#fff' } as React.CSSProperties,
  table: { width:'100%',borderCollapse:'collapse' as const } as React.CSSProperties,
  th: { padding:'12px 16px',textAlign:'left' as const,borderBottom:'1px solid #222',color:'#f59e0b',fontWeight:600,fontSize:11,textTransform:'uppercase' as const,letterSpacing:1,background:'#161616' } as React.CSSProperties,
  td: { padding:'12px 16px',textAlign:'left' as const,borderBottom:'1px solid #222',fontSize:13 } as React.CSSProperties,
  badge: { display:'inline-block',padding:'3px 10px',borderRadius:20,fontSize:10,fontWeight:700,letterSpacing:.5 } as React.CSSProperties,
  badgeGreen: { background:'rgba(22,163,74,.15)',color:'#22c55e' } as React.CSSProperties,
  badgeAmber: { background:'rgba(245,158,11,.1)',color:'#f59e0b' } as React.CSSProperties,
  input: { width:'100%',padding:'11px 14px',background:'#1a1a1a',border:'1px solid #333',borderRadius:6,color:'#fff',fontSize:13,outline:'none',boxSizing:'border-box' as const,fontFamily:'inherit' } as React.CSSProperties,
  label: { display:'block',fontSize:12,color:'#999',marginBottom:6,fontWeight:600,letterSpacing:.3 } as React.CSSProperties,
  formGroup: { marginBottom:16 } as React.CSSProperties,
  grid4: { display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:24 } as React.CSSProperties,
  grid3: { display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20 } as React.CSSProperties,
  grid2: { display:'grid',gridTemplateColumns:'1fr 1fr',gap:20 } as React.CSSProperties,
  platformIcons: { display:'flex',gap:4,alignItems:'center' } as React.CSSProperties,
};

function PlatformIcons() {
  return (
    <div style={S.platformIcons}>
      {[['#f00','▶'],['#1db954','♪'],['#2bc5b4','J'],['#fc3c44','♫'],['#1c2b4a','W']].map(([bg, icon], i) => (
        <span key={i} style={{width:22,height:22,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'#fff',background:bg}}>{icon}</span>
      ))}
      <span style={{width:22,height:22,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:'#999',background:'#333'}}>+2</span>
    </div>
  );
}

function ChartBars({ count, maxH }: { count: number; maxH: number }) {
  const bars = Array.from({ length: count }, () => Math.floor(Math.random() * maxH) + 20);
  return (
    <div style={{background:'#161616',borderRadius:8,padding:20,minHeight:200,display:'flex',alignItems:'flex-end',gap:4}}>
      {bars.map((h, i) => <div key={i} style={{flex:1,background:'linear-gradient(to top,#d97706,#f59e0b)',borderRadius:'3px 3px 0 0',minWidth:8,height:h}} />)}
    </div>
  );
}

/* ═══════ 1. OVERVIEW ═══════ */
function OverviewSection({ data }: { data: Record<string, unknown> }) {
  const settings = (data.settings || {}) as Record<string, string>;
  const releases = (data.releases || []) as Record<string, string>[];
  const artists = (data.artists || []) as Record<string, string>[];
  const videos = (data.videos || []) as Record<string, string>[];
  const inquiries = (data.inquiries || []) as Record<string, string>[];

  return (
    <>
      <div style={S.grid4}>
        {[
          { icon: '🎵', label: 'Total Songs', number: settings.stats_songs || '256', change: '+18 this month ↑' },
          { icon: '👥', label: 'Total Artists', number: settings.stats_artists || String(artists.length || 42), change: '+5 this month ↑' },
          { icon: '▶', label: 'YouTube Videos', number: settings.stats_videos || String(videos.length || 178), change: '+14 this month ↑' },
          { icon: '✉', label: 'Contact Leads', number: String(inquiries.length || 89), change: '+21 this month ↑' },
        ].map((s, i) => (
          <div key={i} style={S.statCard}>
            <div style={S.statIcon}>{s.icon}</div>
            <div style={S.statLabel}>{s.label}</div>
            <div style={S.statNumber}>{s.number}</div>
            <div style={S.statChange}>{s.change}</div>
          </div>
        ))}
      </div>

      <div style={S.grid2}>
        <div style={S.card}>
          <div style={S.cardHeader}><h2 style={S.cardTitle}>🎵 Recent Releases</h2></div>
          <div style={{padding:0}}>
            <table style={S.table}>
              <thead><tr>{['#','Title','Artist','Status','Platform'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {releases.slice(0, 5).map((r, i) => (
                  <tr key={i}><td style={S.td}>{i + 1}</td><td style={{...S.td,fontWeight:600,color:'#fff'}}>{r.hindi_title || r.eng_title || ''}</td><td style={S.td}>{r.artist || 'InTubeMedia'}</td><td style={S.td}><span style={{...S.badge,...S.badgeGreen}}>Published</span></td><td style={S.td}><PlatformIcons /></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={S.card}>
          <div style={S.cardHeader}><h2 style={S.cardTitle}>📊 Video Performance (YouTube)</h2></div>
          <div style={S.cardBody}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:16}}>
              {[['2.45M','Total Views','+12.5%'],['145.8K','Watch Time','+9.4%'],['98.6K','Likes','+8.1%'],['52.3K','Subscribers','+11.7%']].map(([num, label, change], i) => (
                <div key={i} style={{textAlign:'center'}}><div style={{color:'#f59e0b',fontWeight:800,fontSize:18}}>{num}</div><div style={{fontSize:11,color:'#666'}}>{label}</div><div style={{fontSize:11,color:'#16a34a'}}>{change}</div></div>
              ))}
            </div>
            <ChartBars count={20} maxH={120} />
          </div>
        </div>
      </div>
    </>
  );
}

/* ═══════ 2. BANNERS ═══════ */
function BannersSection({ data, saveData, toast }: { data: Record<string, unknown>; saveData: (d: Record<string, unknown>) => void; toast: (m: string) => void }) {
  const banners = (data.banners || []) as Record<string, string>[];
  const [title, setTitle] = useState('');
  const [image, setImage] = useState('');

  function addBanner() {
    if (!title) return;
    const newBanners = [...banners, { id: Date.now().toString(), title, image }];
    saveData({ ...data, banners: newBanners });
    toast('Banner added');
    setTitle(''); setImage('');
  }

  function deleteBanner(id: string) {
    saveData({ ...data, banners: banners.filter(b => b.id !== id) });
    toast('Banner deleted');
  }

  return (
    <>
      <div style={S.card}>
        <div style={S.cardHeader}><h2 style={S.cardTitle}>Add Banner</h2></div>
        <div style={S.cardBody}>
          <div style={S.formGroup}><label style={S.label}>Title</label><input style={S.input} value={title} onChange={e => setTitle(e.target.value)} placeholder="Banner title" /></div>
          <div style={S.formGroup}><label style={S.label}>Image URL</label><input style={S.input} value={image} onChange={e => setImage(e.target.value)} placeholder="https://..." /></div>
          <button style={{...S.btn,...S.btnPrimary}} onClick={addBanner}>Add Banner</button>
        </div>
      </div>
      <div style={S.card}>
        <div style={S.cardHeader}><h2 style={S.cardTitle}>Banners ({banners.length})</h2></div>
        <table style={S.table}>
          <thead><tr>{['#','Title','Image','Actions'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>{banners.map((b, i) => (
            <tr key={b.id}><td style={S.td}>{i + 1}</td><td style={{...S.td,fontWeight:600,color:'#fff'}}>{b.title}</td><td style={S.td}>{b.image ? <img src={b.image} alt="" style={{width:80,height:45,objectFit:'cover',borderRadius:4}} /> : '-'}</td><td style={S.td}><button style={{...S.btn,...S.btnDanger,padding:'6px 12px',fontSize:11}} onClick={() => deleteBanner(b.id)}>Delete</button></td></tr>
          ))}</tbody>
        </table>
      </div>
    </>
  );
}

/* ═══════ 3. ARTISTS ═══════ */
function ArtistsSection({ data, saveData, toast }: { data: Record<string, unknown>; saveData: (d: Record<string, unknown>) => void; toast: (m: string) => void }) {
  const artists = (data.artists || []) as Record<string, string>[];
  const [name, setName] = useState('');
  const [role, setRole] = useState('Singer');
  const [genre, setGenre] = useState('');
  const [image, setImage] = useState('');

  function addArtist() {
    if (!name) return;
    const newArtists = [...artists, { id: Date.now().toString(), name, role, genre, image }];
    saveData({ ...data, artists: newArtists });
    toast('Artist added');
    setName(''); setGenre(''); setImage('');
  }

  function deleteArtist(id: string) {
    saveData({ ...data, artists: artists.filter(a => a.id !== id) });
    toast('Artist deleted');
  }

  return (
    <>
      <div style={S.grid4}>
        {[{ icon:'👥',label:'Total Artists',num:String(artists.length)},{icon:'⭐',label:'Featured',num:String(Math.floor(artists.length/2))},{icon:'🎵',label:'Total Songs',num:'256'},{icon:'📈',label:'Active This Month',num:String(Math.min(artists.length,8))}].map((s,i) => (
          <div key={i} style={S.statCard}><div style={S.statIcon}>{s.icon}</div><div style={S.statLabel}>{s.label}</div><div style={S.statNumber}>{s.num}</div></div>
        ))}
      </div>
      <div style={S.grid2}>
        <div style={S.card}>
          <div style={S.cardHeader}><h2 style={S.cardTitle}>Artists</h2></div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:16,padding:20}}>
            {artists.map(a => (
              <div key={a.id} style={{background:'#111',border:'1px solid #222',borderRadius:12,padding:20,textAlign:'center'}}>
                {a.image ? <img src={a.image} alt="" style={{width:80,height:80,borderRadius:'50%',objectFit:'cover',margin:'0 auto 8px',display:'block',border:'3px solid #222'}} /> : <div style={{width:80,height:80,borderRadius:'50%',background:'#161616',margin:'0 auto 8px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:28}}>👤</div>}
                <div style={{fontSize:15,fontWeight:700,color:'#f59e0b'}}>{a.name}</div>
                <div style={{fontSize:12,color:'#999'}}>{a.role}</div>
                <div style={{fontSize:11,color:'#666'}}>{a.genre}</div>
                <button style={{...S.btn,...S.btnDanger,padding:'4px 10px',fontSize:10,marginTop:8}} onClick={() => deleteArtist(a.id)}>Delete</button>
              </div>
            ))}
          </div>
        </div>
        <div style={S.card}>
          <div style={S.cardHeader}><h2 style={S.cardTitle}>Add New Artist</h2></div>
          <div style={S.cardBody}>
            <div style={S.formGroup}><label style={S.label}>Name</label><input style={S.input} value={name} onChange={e => setName(e.target.value)} placeholder="Artist name" /></div>
            <div style={S.formGroup}><label style={S.label}>Role</label><select style={S.input} value={role} onChange={e => setRole(e.target.value)}><option>Singer</option><option>Producer</option><option>Lyricist</option><option>Composer</option></select></div>
            <div style={S.formGroup}><label style={S.label}>Genre</label><input style={S.input} value={genre} onChange={e => setGenre(e.target.value)} placeholder="Devotional, Folk..." /></div>
            <div style={S.formGroup}><label style={S.label}>Image URL</label><input style={S.input} value={image} onChange={e => setImage(e.target.value)} placeholder="https://..." /></div>
            <button style={{...S.btn,...S.btnPrimary}} onClick={addArtist}>Add Artist</button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ═══════ 4. RELEASES ═══════ */
function ReleasesSection({ data, saveData, toast }: { data: Record<string, unknown>; saveData: (d: Record<string, unknown>) => void; toast: (m: string) => void }) {
  const releases = (data.releases || []) as Record<string, string>[];
  const [hindiTitle, setHindiTitle] = useState('');
  const [engTitle, setEngTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [image, setImage] = useState('');

  function addRelease() {
    if (!hindiTitle) return;
    saveData({ ...data, releases: [...releases, { id: Date.now().toString(), hindi_title: hindiTitle, eng_title: engTitle, artist: artist || 'InTubeMedia', image, label: 'InTubeMedia', status: 'Published' }] });
    toast('Release added');
    setHindiTitle(''); setEngTitle(''); setArtist(''); setImage('');
  }

  function deleteRelease(id: string) {
    saveData({ ...data, releases: releases.filter(r => r.id !== id) });
    toast('Release deleted');
  }

  return (
    <div style={S.grid2}>
      <div style={S.card}>
        <div style={S.cardHeader}><h2 style={S.cardTitle}>ADD NEW RELEASE</h2></div>
        <div style={S.cardBody}>
          <div style={S.formGroup}><label style={S.label}>Hindi Title</label><input style={S.input} value={hindiTitle} onChange={e => setHindiTitle(e.target.value)} placeholder="हिंदी टाइटल" /></div>
          <div style={S.formGroup}><label style={S.label}>English Title</label><input style={S.input} value={engTitle} onChange={e => setEngTitle(e.target.value)} /></div>
          <div style={S.formGroup}><label style={S.label}>Artist</label><input style={S.input} value={artist} onChange={e => setArtist(e.target.value)} placeholder="InTubeMedia" /></div>
          <div style={S.formGroup}><label style={S.label}>Cover Image URL</label><input style={S.input} value={image} onChange={e => setImage(e.target.value)} /></div>
          <button style={{...S.btn,...S.btnPrimary}} onClick={addRelease}>🎵 Publish Release</button>
        </div>
      </div>
      <div style={S.card}>
        <div style={S.cardHeader}><h2 style={S.cardTitle}>RECENT RELEASES ({releases.length})</h2></div>
        <table style={S.table}>
          <thead><tr>{['Title','Artist','Status','Platforms','Actions'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>{releases.map(r => (
            <tr key={r.id}><td style={{...S.td,fontWeight:600,color:'#fff'}}>{r.hindi_title || r.eng_title}</td><td style={S.td}>{r.artist}</td><td style={S.td}><span style={{...S.badge,...S.badgeGreen}}>Published</span></td><td style={S.td}><PlatformIcons /></td><td style={S.td}><button style={{...S.btn,...S.btnDanger,padding:'4px 10px',fontSize:10}} onClick={() => deleteRelease(r.id)}>🗑</button></td></tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════ 5. VIDEOS ═══════ */
function VideosSection({ data, saveData, toast }: { data: Record<string, unknown>; saveData: (d: Record<string, unknown>) => void; toast: (m: string) => void }) {
  const videos = (data.videos || []) as Record<string, string>[];
  const [title, setTitle] = useState('');
  const [ytId, setYtId] = useState('');
  const [category, setCategory] = useState('');

  function addVideo() {
    if (!title) return;
    saveData({ ...data, videos: [...videos, { id: Date.now().toString(), hindi_title: title, youtube_id: ytId, category, status: 'Published' }] });
    toast('Video added');
    setTitle(''); setYtId(''); setCategory('');
  }

  function deleteVideo(id: string) {
    saveData({ ...data, videos: videos.filter(v => v.id !== id) });
    toast('Video deleted');
  }

  return (
    <>
      <div style={S.card}>
        <div style={S.cardHeader}><h2 style={S.cardTitle}>UPLOAD / PUBLISH VIDEO</h2></div>
        <div style={{...S.cardBody,display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16}}>
          <div><div style={S.formGroup}><label style={S.label}>Video Title</label><input style={S.input} value={title} onChange={e => setTitle(e.target.value)} placeholder="Video title" /></div></div>
          <div><div style={S.formGroup}><label style={S.label}>YouTube Video ID</label><input style={S.input} value={ytId} onChange={e => setYtId(e.target.value)} placeholder="dQw4w9WgXcQ" /></div></div>
          <div><div style={S.formGroup}><label style={S.label}>Category</label><input style={S.input} value={category} onChange={e => setCategory(e.target.value)} placeholder="Krishna Bhajan" /></div><button style={{...S.btn,...S.btnPrimary}} onClick={addVideo}>🎵 Publish Video</button></div>
        </div>
      </div>
      <div style={S.card}>
        <div style={S.cardHeader}><h2 style={S.cardTitle}>VIDEO LIBRARY ({videos.length})</h2></div>
        <table style={S.table}>
          <thead><tr>{['#','Title','Category','Status','Actions'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>{videos.map((v, i) => (
            <tr key={v.id}><td style={S.td}>{i + 1}</td><td style={{...S.td,fontWeight:600,color:'#fff'}}>{v.hindi_title || v.eng_title}</td><td style={S.td}>{v.category || 'Devotional'}</td><td style={S.td}><span style={{...S.badge,...S.badgeGreen}}>Published</span></td><td style={S.td}><button style={{...S.btn,...S.btnDanger,padding:'4px 10px',fontSize:10}} onClick={() => deleteVideo(v.id)}>🗑</button></td></tr>
          ))}</tbody>
        </table>
      </div>
    </>
  );
}

/* ═══════ 6. CATALOGUE ═══════ */
function CatalogueSection({ data }: { data: Record<string, unknown> }) {
  const catalogue = (data.catalogue || []) as Record<string, string | number>[];
  const releases = (data.releases || []) as Record<string, string>[];
  return (
    <>
      <div style={S.card}>
        <div style={S.cardHeader}><h2 style={S.cardTitle}>CATEGORIES</h2></div>
        <div style={{...S.cardBody,display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
          {catalogue.map((c, i) => (
            <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',background:'#161616',borderRadius:6}}>
              <span>🎵</span><span style={{flex:1,fontSize:13,fontWeight:700}}>{c.name}</span><span style={{color:'#f59e0b',fontWeight:700}}>{c.count}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={S.card}>
        <div style={S.cardHeader}><h2 style={S.cardTitle}>ALL SONGS ({releases.length})</h2></div>
        <table style={S.table}>
          <thead><tr>{['#','Title','Artist','Platforms','Status'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>{releases.map((r, i) => (
            <tr key={r.id || i}><td style={S.td}>{i + 1}</td><td style={{...S.td,fontWeight:600,color:'#fff'}}>{r.hindi_title || r.eng_title}</td><td style={S.td}>{r.artist || 'InTubeMedia'}</td><td style={S.td}><PlatformIcons /></td><td style={S.td}><span style={{...S.badge,...S.badgeGreen}}>Published</span></td></tr>
          ))}</tbody>
        </table>
      </div>
    </>
  );
}

/* ═══════ 7. LICENSING ═══════ */
function LicensingSection() {
  return (
    <>
      <div style={S.grid4}>
        {[{icon:'📋',label:'Total Inquiries',num:'128'},{icon:'✅',label:'Approved',num:'76'},{icon:'©',label:'Copyright Claims',num:'14'},{icon:'₹',label:'Revenue (YTD)',num:'₹18.75L'}].map((s,i) => (
          <div key={i} style={S.statCard}><div style={S.statIcon}>{s.icon}</div><div style={S.statLabel}>{s.label}</div><div style={S.statNumber}>{s.num}</div></div>
        ))}
      </div>
      <div style={S.card}>
        <div style={S.cardHeader}><h2 style={S.cardTitle}>RECENT LICENSING REQUESTS</h2></div>
        <table style={S.table}>
          <thead><tr>{['ID','Client','Content','License Type','Status','Date'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>
            {[['LIC-2024-128','Saregama India Ltd.','Shyam Teri Bansi','Synchronization','Under Review','12 May 2024'],['LIC-2024-127','Zee Entertainment','Radha Rani Meri Hai','Broadcast','In Discussion','11 May 2024'],['LIC-2024-126','Times Music','Hanuman Chalisa','Digital','Approved','10 May 2024']].map((r, i) => (
              <tr key={i}><td style={{...S.td,color:'#f59e0b'}}>{r[0]}</td><td style={S.td}>{r[1]}</td><td style={S.td}>{r[2]}</td><td style={S.td}>{r[3]}</td><td style={S.td}><span style={{...S.badge,...(r[4]==='Approved'?S.badgeGreen:S.badgeAmber)}}>{r[4]}</span></td><td style={S.td}>{r[5]}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ═══════ 8. DISTRIBUTION ═══════ */
function DistributionSection() {
  return (
    <>
      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:16,marginBottom:24}}>
        {[{label:'Total Distributed',num:'128'},{label:'Platforms',num:'12'},{label:'Tracks Delivered',num:'546'},{label:'Successful',num:'512'},{label:'Pending',num:'34'}].map((s,i) => (
          <div key={i} style={S.statCard}><div style={S.statLabel}>{s.label}</div><div style={S.statNumber}>{s.num}</div></div>
        ))}
      </div>
      <div style={S.card}>
        <div style={S.cardHeader}><h2 style={S.cardTitle}>PLATFORM DELIVERY STATUS</h2></div>
        <div style={S.cardBody}>
          {[['YouTube','98%'],['Spotify','96%'],['JioSaavn','95%'],['Apple Music','93%'],['Amazon Music','90%'],['Wynk Music','85%']].map(([name, pct], i) => (
            <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:'1px solid #222'}}>
              <span style={{flex:1,fontSize:13,fontWeight:600,color:'#fff'}}>{name}</span>
              <span style={{fontSize:13,color:'#999',width:40}}>{pct}</span>
              <div style={{flex:2,height:6,background:'#222',borderRadius:3,overflow:'hidden'}}><div style={{height:'100%',background:'#f59e0b',borderRadius:3,width:pct}} /></div>
              <span style={{...S.badge,...S.badgeGreen}}>Delivered</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ═══════ 9. INQUIRIES ═══════ */
function InquiriesSection({ data, saveData, toast }: { data: Record<string, unknown>; saveData: (d: Record<string, unknown>) => void; toast: (m: string) => void }) {
  const inquiries = (data.inquiries || []) as Record<string, string>[];

  function deleteInquiry(id: string) {
    saveData({ ...data, inquiries: inquiries.filter(inq => inq.id !== id) });
    toast('Inquiry deleted');
  }

  return (
    <div style={S.card}>
      <div style={S.cardHeader}><h2 style={S.cardTitle}>All Inquiries ({inquiries.length})</h2></div>
      {inquiries.length === 0 ? <div style={{textAlign:'center',padding:40,color:'#666'}}>No inquiries yet.</div> :
        <table style={S.table}>
          <thead><tr>{['#','Name','Email','Type','Message','Date','Actions'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>{inquiries.map((inq, i) => (
            <tr key={inq.id || i}><td style={S.td}>{i + 1}</td><td style={{...S.td,fontWeight:600,color:'#fff'}}>{inq.name || 'Anonymous'}</td><td style={S.td}>{inq.email || '-'}</td><td style={S.td}><span style={{...S.badge,...S.badgeAmber}}>{inq.type || 'General'}</span></td><td style={{...S.td,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{inq.message || '-'}</td><td style={S.td}>{inq.created_at || '-'}</td><td style={S.td}><button style={{...S.btn,...S.btnDanger,padding:'4px 10px',fontSize:10}} onClick={() => deleteInquiry(inq.id)}>🗑</button></td></tr>
          ))}</tbody>
        </table>
      }
    </div>
  );
}

/* ═══════ 10. ANALYTICS ═══════ */
function AnalyticsSection() {
  return (
    <>
      <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:16,marginBottom:24}}>
        {[{label:'Total Views',num:'12.84M',change:'↑18.6%'},{label:'Subscribers',num:'256K',change:'↑14.2%'},{label:'Watch Time',num:'1.92M',change:'↑22.7%'},{label:'Total Releases',num:'48',change:'↑9.1%'},{label:'Engagement',num:'6.74%',change:'↑8.3%'},{label:'Revenue',num:'₹18.7L',change:'↑16.5%'}].map((s,i) => (
          <div key={i} style={S.statCard}><div style={S.statLabel}>{s.label}</div><div style={S.statNumber}>{s.num}</div><div style={S.statChange}>{s.change}</div></div>
        ))}
      </div>
      <div style={S.grid3}>
        {[['YouTube Views','8.65M'],['Subscribers Growth','256K'],['Watch Time (Hours)','1.92M']].map(([title, num], i) => (
          <div key={i} style={S.card}>
            <div style={S.cardHeader}><h2 style={S.cardTitle}>{title}</h2><span style={{color:'#f59e0b',fontWeight:800,fontSize:22}}>{num}</span></div>
            <div style={S.cardBody}><ChartBars count={30} maxH={160} /></div>
          </div>
        ))}
      </div>
      <div style={{...S.grid2,marginTop:20}}>
        <div style={S.card}>
          <div style={S.cardHeader}><h2 style={S.cardTitle}>🎵 Top Performing Songs</h2></div>
          <div style={S.cardBody}>
            {['Shyam Teri Bansi|1.24M','Radha Rani Meri Hai|1.08M','Hanuman Chalisa|985K','Ram Naam Ki Mahima|842K','Gurjar Rasiya|764K'].map((s, i) => {
              const [name, views] = s.split('|');
              return <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px solid #222'}}><span style={{color:'#f59e0b',fontWeight:700,width:16}}>{i+1}</span><span style={{flex:1,fontSize:13,fontWeight:700}}>{name}</span><span style={{color:'#f59e0b',fontWeight:700}}>{views}</span></div>;
            })}
          </div>
        </div>
        <div style={S.card}>
          <div style={S.cardHeader}><h2 style={S.cardTitle}>Platform-wise Performance</h2></div>
          <div style={S.cardBody}>
            {[['YouTube','8.65M',100],['Facebook','1.45M',17],['Instagram','1.12M',13],['Spotify','620K',7],['JioSaavn','480K',6]].map(([name, views, pct], i) => (
              <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'6px 0'}}><span style={{width:80,fontSize:12}}>{name as string}</span><div style={{flex:1,height:8,background:'#222',borderRadius:4,overflow:'hidden'}}><div style={{height:'100%',background:'#f59e0b',width:`${pct as number}%`,borderRadius:4}} /></div><span style={{fontSize:12,color:'#f59e0b',fontWeight:700}}>{views as string}</span></div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* ═══════ 11. SETTINGS ═══════ */
function SettingsSection({ data, saveData, toast }: { data: Record<string, unknown>; saveData: (d: Record<string, unknown>) => void; toast: (m: string) => void }) {
  const settings = (data.settings || {}) as Record<string, string>;
  const [form, setForm] = useState(settings);

  function handleSave() {
    saveData({ ...data, settings: form });
    toast('Settings saved');
  }

  function updateField(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  return (
    <>
      <div style={S.grid2}>
        <div style={S.card}>
          <div style={S.cardHeader}><h2 style={S.cardTitle}>Company Info</h2></div>
          <div style={S.cardBody}>
            {[['Company Name','company_name'],['Tagline','tagline']].map(([label, key]) => (
              <div key={key} style={S.formGroup}><label style={S.label}>{label}</label><input style={S.input} value={form[key] || ''} onChange={e => updateField(key, e.target.value)} /></div>
            ))}
          </div>
        </div>
        <div style={S.card}>
          <div style={S.cardHeader}><h2 style={S.cardTitle}>Contact Details</h2></div>
          <div style={S.cardBody}>
            {[['Phone','phone'],['Email','email'],['WhatsApp','whatsapp']].map(([label, key]) => (
              <div key={key} style={S.formGroup}><label style={S.label}>{label}</label><input style={S.input} value={form[key] || ''} onChange={e => updateField(key, e.target.value)} /></div>
            ))}
          </div>
        </div>
      </div>
      <div style={S.grid2}>
        <div style={S.card}>
          <div style={S.cardHeader}><h2 style={S.cardTitle}>Social Media Links</h2></div>
          <div style={S.cardBody}>
            {[['YouTube URL','youtube_url'],['Instagram URL','instagram_url'],['Facebook URL','facebook_url']].map(([label, key]) => (
              <div key={key} style={S.formGroup}><label style={S.label}>{label}</label><input style={S.input} value={form[key] || ''} onChange={e => updateField(key, e.target.value)} /></div>
            ))}
          </div>
        </div>
        <div style={S.card}>
          <div style={S.cardHeader}><h2 style={S.cardTitle}>Display Stats</h2></div>
          <div style={S.cardBody}>
            {[['Songs Count','stats_songs'],['Artists Count','stats_artists'],['Videos Count','stats_videos'],['Views Count','stats_views']].map(([label, key]) => (
              <div key={key} style={S.formGroup}><label style={S.label}>{label}</label><input style={S.input} value={form[key] || ''} onChange={e => updateField(key, e.target.value)} /></div>
            ))}
          </div>
        </div>
      </div>
      <div style={{textAlign:'right',marginTop:16}}><button style={{...S.btn,...S.btnPrimary,padding:'12px 28px',fontSize:14}} onClick={handleSave}>Save Settings</button></div>
    </>
  );
}

/* ═══════ Default Data ═══════ */
function getDefaultData(): Record<string, unknown> {
  return {
    settings: {
      company_name: 'InTubeMedia',
      tagline: "India's Devotional, Folk & Rasiya Music Label",
      phone: '+91 72978 97628',
      email: 'contact@intubemedia.com',
      whatsapp: '917297897628',
      address: 'Jaipur, Rajasthan, India',
      youtube_url: 'https://youtube.com/@intubemedia',
      instagram_url: 'https://instagram.com/intubemedia',
      facebook_url: 'https://facebook.com/intubemedia',
      stats_songs: '256+',
      stats_artists: '42+',
      stats_videos: '178+',
      stats_views: '12.8M+',
    },
    banners: [
      { id: '1', title: 'INTUBEMEDIA', subtitle: "YouTube Channel Management System", image: '' }
    ],
    releases: [
      { id: '1', hindi_title: 'श्याम तेरी बंसी पागल कर जाती है', eng_title: 'Shyam Teri Bansi Pagaal Kar Jaati Hai', artist: 'InTubeMedia', label: 'InTubeMedia', image: '', status: 'Published' },
      { id: '2', hindi_title: 'राधा रानी मेरी है', eng_title: 'Radha Rani Meri Hai', artist: 'InTubeMedia', label: 'InTubeMedia', image: '', status: 'Published' },
      { id: '3', hindi_title: 'हनुमान चालीसा', eng_title: 'Hanuman Chalisa', artist: 'InTubeMedia', label: 'InTubeMedia', image: '', status: 'Published' },
      { id: '4', hindi_title: 'राम नाम की महिमा', eng_title: 'Ram Naam Ki Mahima', artist: 'InTubeMedia', label: 'InTubeMedia', image: '', status: 'Published' },
      { id: '5', hindi_title: 'गुर्जर रसिया', eng_title: 'Gurjar Rasiya', artist: 'InTubeMedia', label: 'InTubeMedia', image: '', status: 'Published' },
      { id: '6', hindi_title: 'डीजे रसिया 2024', eng_title: 'DJ Rasiya 2024', artist: 'InTubeMedia', label: 'InTubeMedia', image: '', status: 'Published' },
    ],
    artists: [
      { id: '1', name: 'Bhumika Sharma', role: 'Singer', genre: 'Devotional, Bhajan', image: '' },
      { id: '2', name: 'DG Mawai', role: 'Singer', genre: 'Folk, Rasiya', image: '' },
      { id: '3', name: 'Rashmi Nishad', role: 'Singer', genre: 'Devotional, Bhajan', image: '' },
      { id: '4', name: 'Ajeet Bainsla', role: 'Producer', genre: 'All Genres', image: '' },
    ],
    videos: [
      { id: '1', hindi_title: 'श्याम तेरी बंसी पागल कर जाती है', eng_title: 'Shyam Teri Bansi', youtube_id: '', category: 'Krishna Bhajan', duration: '05:45', views: '1.2M', status: 'Published' },
      { id: '2', hindi_title: 'राधा रानी मेरी है', eng_title: 'Radha Rani Meri Hai', youtube_id: '', category: 'Radha Bhajan', duration: '04:12', views: '856K', status: 'Published' },
      { id: '3', hindi_title: 'हनुमान चालीसा', eng_title: 'Hanuman Chalisa', youtube_id: '', category: 'Hanuman Bhajan', duration: '06:21', views: '2.4M', status: 'Published' },
    ],
    catalogue: [
      { name: 'Krishna Bhajan', hindi: 'कृष्ण भजन', count: 128 },
      { name: 'Radha Bhajan', hindi: 'राधा भजन', count: 102 },
      { name: 'Hanuman Bhajan', hindi: 'हनुमान भजन', count: 96 },
      { name: 'Ram Bhajan', hindi: 'राम भजन', count: 88 },
      { name: 'Shiv Bhajan', hindi: 'शिव भजन', count: 74 },
      { name: 'Gurjar Rasiya', hindi: 'गुर्जर रसिया', count: 111 },
      { name: 'DJ Rasiya', hindi: 'डीजे रसिया', count: 67 },
      { name: 'Folk Songs', hindi: 'लोक गीत', count: 139 },
    ],
    licensing: [],
    inquiries: [],
    distribution: [],
  };
}
