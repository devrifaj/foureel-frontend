import { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { getTasks } from '../api';

const TEAM = [
  { name: 'Paolo', role: 'Creative Dir.', ini: 'P', avClass: 'av-P' },
  { name: 'Lex', role: 'Editor', ini: 'L', avClass: 'av-L' },
  { name: 'Rick', role: 'Accounts', ini: 'R', avClass: 'av-R' },
  { name: 'Ray', role: 'Strategy', ini: 'Ra', avClass: 'av-Ra' },
  { name: 'Boy', role: 'Owner', ini: 'B', avClass: 'av-B' },
];

/** SVG nav icons — matches 4reel-dashboard.html */
const NavIcons = {
  home: (
    <svg className="nav-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 1.5L1 7v8h5v-5h4v5h5V7z" />
    </svg>
  ),
  agenda: (
    <svg className="nav-icon" viewBox="0 0 16 16" aria-hidden>
      <rect x="1" y="3" width="14" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 1v4M11 1v4M1 7h14" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  klanten: (
    <svg className="nav-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <circle cx="6" cy="5" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M1 14c0-3 2.2-5 5-5s5 2 5 5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M11 7c1.1.4 2 1.5 2 2.8" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M13.5 6a2.5 2.5 0 010 5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  ),
  taken: (
    <svg className="nav-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <rect x="1" y="2" width="4" height="12" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="6" y="2" width="4" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="2" width="4" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  archief: (
    <svg className="nav-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <rect x="1" y="1" width="14" height="4" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 5v9a1 1 0 001 1h10a1 1 0 001-1V5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M6 9h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  workspace: (
    <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <rect x="1" y="1" width="6" height="6" rx="1" />
      <rect x="9" y="1" width="6" height="6" rx="1" />
      <rect x="1" y="9" width="6" height="6" rx="1" />
      <path d="M9 12h6M12 9v6" />
    </svg>
  ),
  pulse: (
    <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <path d="M1 8h2l2-5 2 10 2-7 2 4 2-2h2" />
    </svg>
  ),
};

const NAV_SECTIONS = [
  {
    labelKey: 'navStudio',
    labelStyle: undefined,
    items: [
      { id: 'home', iconKey: 'home', labelKey: 'home' },
      { id: 'agenda', iconKey: 'agenda', labelKey: 'agenda' },
    ],
  },
  {
    labelKey: 'navBeheer',
    items: [
      { id: 'klanten', iconKey: 'klanten', labelKey: 'klanten' },
      { id: 'taken', iconKey: 'taken', labelKey: 'taken', badge: true },
      { id: 'archief', iconKey: 'archief', labelKey: 'archief' },
    ],
  },
  {
    labelKey: 'navEditors',
    labelStyle: { marginTop: '4px' },
    items: [
      { id: 'workspace', iconKey: 'workspace', labelKey: 'workspace' },
      { id: 'pulse', iconKey: 'pulse', labelKey: 'pulse', pulseAccent: true },
    ],
  },
];

const NAV_TO = {
  home: '/',
  agenda: '/agenda',
  klanten: '/klanten',
  taken: '/taken',
  archief: '/archief',
  workspace: '/workspace',
  pulse: '/pulse',
};

export default function Dashboard() {
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const { logout } = useAuth();
  const { lang, setLang, t } = useLang();

  const { data: tasks = [] } = useQuery({ queryKey: ['tasks'], queryFn: getTasks });
  const openCount = tasks.filter((task) => task.column !== 'klaar').length;

  return (
    <div className="dashboard-shell">
      <nav id="sidebar" aria-label="Studio navigatie">
        <div className="sidebar-brand">
          <div className="brand-logo">
            <div className="brand-mark">
              <svg viewBox="0 0 18 18" aria-hidden>
                <path
                  fill="white"
                  d="M3 3h5v5H3zm7 0h5v5h-5zm0 7h5v5h-5zM3 13l2.5-2.5L8 13l-2.5 2.5z"
                />
              </svg>
            </div>
            <span className="brand-name">4REEL</span>
          </div>
          <div className="brand-sub">{t('brandSub')}</div>
        </div>

        <div className="sidebar-nav">
          {NAV_SECTIONS.map((section) => (
            <div key={section.labelKey}>
              <div className="nav-section-label" style={section.labelStyle}>
                {t(section.labelKey)}
              </div>
              {section.items.map((item) => (
                <NavLink
                  key={item.id}
                  to={NAV_TO[item.id]}
                  end={item.id === 'home'}
                  className={({ isActive }) =>
                    `nav-item${isActive ? ' active' : ''}${item.pulseAccent ? ' nav-item--pulse' : ''}`
                  }
                >
                  {NavIcons[item.iconKey]}
                  {t(item.labelKey)}
                  {item.badge && openCount > 0 ? (
                    <span className="nav-badge">{openCount}</span>
                  ) : null}
                </NavLink>
              ))}
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="lang-toggle">
            <button
              type="button"
              className={`lang-btn${lang === 'nl' ? ' active' : ''}`}
              onClick={() => setLang('nl')}
            >
              NL
            </button>
            <button
              type="button"
              className={`lang-btn${lang === 'en' ? ' active' : ''}`}
              onClick={() => setLang('en')}
            >
              EN
            </button>
          </div>
          <div className="nav-section-label sidebar-team-heading">{t('team')}</div>
          {TEAM.map((m) => (
            <div key={m.name} className="team-member-pill" title={`${m.name} — ${m.role}`}>
              <div className={`avatar ${m.avClass}`}>{m.ini}</div>
              {m.name} · {m.role}
            </div>
          ))}
          <button type="button" className="sidebar-logout" onClick={() => setLogoutModalOpen(true)}>
            {t('logout')}
          </button>
        </div>
      </nav>

      {logoutModalOpen && (
        <div className="modal-overlay open" onClick={() => setLogoutModalOpen(false)}>
          <div className="modal" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{t('logoutConfirmTitle')}</div>
              <button type="button" className="modal-close" onClick={() => setLogoutModalOpen(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '14px', color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>
                {t('logoutConfirmBody')}
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setLogoutModalOpen(false)}>
                {t('cancel')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setLogoutModalOpen(false);
                  logout();
                }}
              >
                {t('logout')}
              </button>
            </div>
          </div>
        </div>
      )}

      <main id="main">
        <Outlet />
      </main>
    </div>
  );
}
