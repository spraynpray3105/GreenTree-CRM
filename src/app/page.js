"use client";
import React, { useEffect, useState } from "react";
import { Home, TreeDeciduous, DollarSign, Mail, Search, Moon, Sun, BarChart, Menu, X, MessageSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  // API base: prefer NEXT_PUBLIC_API_BASE when explicitly set (override),
  // otherwise try local dev first then the deployed host as fallback.
  const ENV_API = process.env.NEXT_PUBLIC_API_BASE;
  const API_BASE_DEFAULTS = [
    ENV_API, // could be undefined
    "https://greentree-crm.onrender.com",
    // local dev backend (some developers run on port 10000)
    "http://localhost:10000",
    "http://localhost:8000",
  ].filter(Boolean);
  // primary API base used for single-endpoint code paths (legacy code uses API_BASE)
  const API_BASE = API_BASE_DEFAULTS[0];

  // Helper wrapper that tries each API base in API_BASE_DEFAULTS in order until one succeeds.
  // endpoint: string starting with '/' (e.g. '/login') or without it. options: method, headers, body, credentials, expectJson
  const apiFetch = async (endpoint, options = {}) => {
    const { method = 'GET', headers = {}, body = null, credentials = 'include', expectJson = true } = options || {};
    const token = localStorage.getItem('access_token');
    const hdrs = { ...(headers || {}) };
    if (token && !hdrs['Authorization']) hdrs['Authorization'] = `Bearer ${token}`;
    if (body && !(body instanceof FormData) && !hdrs['Content-Type']) hdrs['Content-Type'] = 'application/json';

    let lastErr = null;
    for (const base of API_BASE_DEFAULTS) {
      const baseUrl = base.replace(/\/$/, '');
      const url = endpoint.startsWith('/') ? `${baseUrl}${endpoint}` : `${baseUrl}/${endpoint}`;
      try {
        const res = await fetch(url, { method, headers: hdrs, body: (hdrs['Content-Type'] === 'application/json' && body && !(body instanceof FormData)) ? JSON.stringify(body) : body, credentials });
        if (!res.ok) {
          const txt = await res.text().catch(()=>null);
          throw new Error(txt || `${res.status} ${res.statusText}`);
        }
        return expectJson ? await res.json() : await res.text();
      } catch (err) {
        lastErr = err;
        console.warn('apiFetch failed for', url, err);
      }
    }
    throw lastErr || new Error('apiFetch: all bases failed');
  };

  // debug: show which API base the client will attempt (helpful when env changes)
  if (typeof window !== 'undefined') {
    console.debug("api bases:", API_BASE_DEFAULTS, "-> primary:", API_BASE);
  }

  // THEME: central place for classes and colors used across the page.
  // We'll build the THEME object below after darkMode state so it can return
  // light-mode variants when requested. See getTheme() further down.

  // data & UI state
  const [darkMode, setDarkMode] = useState(false); // toggles the `dark` wrapper class
  // initialize darkMode from localStorage or system preference on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('theme');
      if (stored === 'dark') { setDarkMode(true); return; }
      if (stored === 'light') { setDarkMode(false); return; }
      // fallback to system preference
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        setDarkMode(true);
      } else {
        setDarkMode(false);
      }
    } catch (e) {
      // ignore
    }
  }, []);
  const [selectedTab, setSelectedTab] = useState('dashboard'); // which tab/page is active
  const [showSidebar, setShowSidebar] = useState(false); // mobile sidebar open/close
  const [expandedIds, setExpandedIds] = useState([]); // expanded rows/cards
  const [properties, setProperties] = useState([]); // properties from DB
  const [agents, setAgents] = useState([]); // agents from backend or derived from properties
  const [photographers, setPhotographers] = useState([]); // photographers from DB
  const [photographersSource, setPhotographersSource] = useState(null);
  const [photographersError, setPhotographersError] = useState(null);
  const [photographersRefreshCounter, setPhotographersRefreshCounter] = useState(0);
  const [aiSummaries, setAiSummaries] = useState({}); // map propertyId -> {summary, indicator, status, sold_date, confidence}
  const [aiSyncing, setAiSyncing] = useState(false);

  // Build a THEME object that returns light or dark variants depending on darkMode.
  const getTheme = (isDark) => ({
    // Light-mode values are unchanged. Dark-mode values use the project's
    // historical custom greys/blacks and avoid visible borders to preserve
    // the original look you requested.
    page: isDark ? "flex min-h-screen bg-[#1C1C1C] text-slate-100 transition-colors duration-300" : "flex min-h-screen bg-white text-slate-900 transition-colors duration-300",
    headerMobile: isDark ? "md:hidden fixed top-0 left-0 right-0 z-40 bg-[#1C1C1C] p-3 flex items-center justify-between" : "md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b p-3 flex items-center justify-between",
    headerTitle: isDark ? "font-bold text-base md:text-lg text-slate-100" : "font-bold text-base md:text-lg text-slate-900",
    headerSubtitle: isDark ? "text-xs text-slate-400" : "text-xs text-slate-500",
  brandTitle: isDark ? "text-xl font-bold text-green-300 flex items-center gap-2" : "text-xl font-bold text-green-400 flex items-center gap-2",
  pageTitle: isDark ? "text-3xl font-bold text-slate-100" : "text-3xl font-bold text-slate-900",
  pageSubtitle: isDark ? "text-slate-300 text-sm mt-1" : "text-slate-600 text-sm mt-1",
  bodyText: isDark ? "text-slate-300 text-sm mt-1" : "text-slate-700 text-sm mt-1",
  mutedText: isDark ? "text-slate-400" : "text-slate-600",
    sidebarDesktop: isDark ? "hidden md:block w-64 bg-[#262626] p-6 space-y-8" : "hidden md:block w-64 bg-white border-r p-6 space-y-8",
    sidebarMobilePanelWrap: "fixed inset-y-0 left-0 z-50 w-64 transform md:hidden transition-transform",
    sidebarMobilePanel: isDark ? "h-full bg-[#262626] p-6" : "h-full bg-white border-r p-6",
    overlay: "fixed inset-0 bg-black/30 z-40 md:hidden",
  tabSelected: "px-3 py-2 rounded-md bg-green-400 dark:bg-[#3A6353] text-white shadow-sm",
  tabDefault: isDark ? "text-slate-400 hover:text-[#3A6353]" : "text-slate-500 hover:text-green-400",
  tabMobileSelected: isDark ? "text-green-300 font-medium" : "text-green-400 font-medium",
  btnPrimary: "bg-green-400 text-white",
  btnPrimaryHover: "hover:bg-green-500",
  btnPrimaryDark: "dark:bg-[#3A6353] dark:hover:bg-[#4D846F]",
  btnAccentGreen: "bg-green-400 hover:bg-green-500 dark:hover:bg-[#4D846F] text-white",
    // Card and table styles: use dark greys and remove borders in dark mode
  cardDark: isDark ? "bg-[#262626] rounded-2xl shadow-sm p-6" : "bg-white rounded-2xl shadow-sm border border-slate-200 p-6",
  tableWrapDark: isDark ? "bg-[#262626] rounded-2xl shadow-sm overflow-hidden" : "bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden",
  tableHeadDark: isDark ? "bg-[#262626] text-slate-400 text-sm" : "bg-slate-50 text-slate-600 text-sm",
    bodyDivideDark: isDark ? "divide-y" : "divide-y",
    cardSmallDark: isDark ? "bg-[#262626]" : "bg-white",
  inputDark: isDark ? "bg-[#1C1C1C] text-slate-100 rounded-md px-3 py-2" : "bg-white text-slate-900 rounded-md px-3 py-2 border border-slate-200",
    soldBadge: isDark ? "bg-green-900/30 text-green-400" : "bg-green-100 text-green-700",
    pendingBadge: isDark ? "bg-amber-900/30 text-amber-400" : "bg-amber-100 text-amber-700",
    activeBadge: isDark ? "bg-red-900/30 text-red-400" : "bg-red-100 text-red-700",
  });

  const THEME = getTheme(darkMode);

  // persist theme choice when toggled
  const toggleDarkMode = () => {
    setDarkMode(d => {
      const next = !d;
      try { localStorage.setItem('theme', next ? 'dark' : 'light'); } catch(e) {}
      return next;
    });
  };
  const [loading, setLoading] = useState(true); // global loading indicator
  const [serverError, setServerError] = useState(null);

  // AUTH state: currentUser and login/register forms
  const [currentUser, setCurrentUser] = useState(null); // populated from /me
  const [loadingMe, setLoadingMe] = useState(true); // whether we're checking session on load
  const [loginForm, setLoginForm] = useState({ name: "", password: "" });
  const [showRegister, setShowRegister] = useState(false); // toggle register modal
  const [regForm, setRegForm] = useState({ name: "", email: "", password: "" });

  // Form state (add shoot)
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    address: "",
    status: "Active",
    price: "",
    agent: "",
    photographer_id: "",
    company: ""
  });

  // Photographers simple add form UI
  const [showPhotogForm, setShowPhotogForm] = useState(false);
  const [photogForm, setPhotogForm] = useState({ name: "", email: "", phone: "", company: "" });

  // Agent edit state
  const [editingAgent, setEditingAgent] = useState(null);
  const [showAgentEditor, setShowAgentEditor] = useState(false);

  // Fake statistics (placeholder) — will derive from properties if desired
  const [fakeStats, setFakeStats] = useState({ avgIncomePerMonth: 0, avgListingDays: 0 });
  // Timeseries stats for dashboard chart
  const [statsData, setStatsData] = useState([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState(null);

  // Derived monetary metric: total unpaid (estimated value of unsold listings)
  const totalUnpaid = Array.isArray(properties)
    ? properties.reduce((sum, p) => {
        const status = (p.status || '').toString().toLowerCase();
        // treat anything not sold as unpaid / floating
        if (status === 'sold') return sum;
        const price = Number(p.price || 0);
        return sum + (isNaN(price) ? 0 : price);
      }, 0)
    : 0;
  // Derived stats for report rendering (used in Statistics tab and report)
  const statsParsed = Array.isArray(statsData) ? statsData.map(s => ({
    date: s.date,
    shoots: Number(s.shoots_count ?? s.shoots ?? 0),
    income: Number(s.income_total ?? s.income ?? 0)
  })) : [];
  const statsDays = statsParsed.length || 30;
  const statsTotalShoots = statsParsed.reduce((sum, p) => sum + (p.shoots || 0), 0);
  const statsTotalIncome = statsParsed.reduce((sum, p) => sum + (p.income || 0), 0);
  const statsAvgShootsPerDay = statsDays ? (statsTotalShoots / statsDays) : 0;
  const statsAvgIncomePerShoot = statsTotalShoots ? (statsTotalIncome / statsTotalShoots) : 0;
  // Watcher/sun times UI state
  const [watcherAddress, setWatcherAddress] = useState("");
  const [watcherLoading, setWatcherLoading] = useState(false);
  const [watcherResult, setWatcherResult] = useState(null);
  const [watcherError, setWatcherError] = useState(null);

  // Listings menu state (left of main): search + sort
  const [listingSearch, setListingSearch] = useState("");
  const [listingSort, setListingSort] = useState("newest"); // newest | price_asc | price_desc

  // Next.js router for navigation to property detail pages
  const router = useRouter();

  // Responsive: auto-close mobile sidebar when switching to desktop
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setShowSidebar(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // On mount: try to get token from localStorage and fetch /me with Authorization header
  useEffect(() => {
    let mounted = true;
    const checkMe = async () => {
      setLoadingMe(true);
      try {
        const token = localStorage.getItem("access_token");

        // If there's no token in localStorage, skip the Authorization check to avoid
        // triggering a 401 on first load. If you rely on cookie-based sessions, set
        // the token (or adjust this logic to call /me with credentials: 'include').
        if (!token) {
          if (mounted) setCurrentUser(null);
          return;
        }

        const headers = { "Authorization": `Bearer ${token}` };
        // include credentials in case server uses cookies as a fallback
        const res = await fetch(`${API_BASE}/me`, { headers, credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (mounted) setCurrentUser(data);
        } else {
          if (mounted) setCurrentUser(null);
        }
      } catch (err) {
        if (mounted) setCurrentUser(null);
      } finally {
        if (mounted) setLoadingMe(false);
      }
    };
    checkMe();
    return () => { mounted = false; };
  }, []);

  // Fetch properties from API and derive agents + simple stats
  useEffect(() => {
    let mounted = true;
    const fetchProperties = async () => {
  setLoading(true);
  setServerError(null);
  try {
      // Try a sequence of candidate bases to tolerate environment differences.
      const token = localStorage.getItem("access_token");
      const headers = token ? { "Authorization": `Bearer ${token}` } : {};
      let data = null;
      let lastErr = null;
      for (const base of API_BASE_DEFAULTS) {
        const url = `${base.replace(/\/$/, "")}/properties`;
        try {
          const res = await fetch(url, { headers });
          if (!res.ok) {
            const txt = await res.text().catch(()=>null);
            throw new Error(txt || `${res.status} ${res.statusText}`);
          }
          data = await res.json();
          // success — stop trying further candidates
          break;
        } catch (err) {
          lastErr = err;
          console.warn(`Failed to fetch properties from ${url}:`, err);
          // try next candidate
        }
      }
      if (!data) {
        throw lastErr || new Error('Failed to fetch properties from any configured API base');
      }
        if (!mounted) return;
        const propsArr = Array.isArray(data) ? data : [];
        setProperties(propsArr);
        // merge any photographers embedded on returned properties into photographers list
        try {
          const embedded = [];
          propsArr.forEach(prop => {
            if (prop && prop.photographer) embedded.push(prop.photographer);
          });
          if (embedded.length) {
            setPhotographers(prev => {
              const map = new Map();
              prev.forEach(p => {
                const key = p && p.id ? `id:${p.id}` : `name:${(p.name||'').toLowerCase()}`;
                map.set(key, p);
              });
              embedded.forEach(p => {
                const key = p && p.id ? `id:${p.id}` : `name:${(p.name||'').toLowerCase()}`;
                if (!map.has(key)) map.set(key, p);
              });
              return Array.from(map.values());
            });
          }
        } catch (e) {
          // ignore merge errors
        }

  // if photographers are present on returned properties, keep them in sync lightly
  // (we also fetch photographers separately below)

        // derive agents from unique agent names as a lightweight fallback when no agents table exists
        const seen = new Map();
        data.forEach(p => {
          const name = (p.agent || "").trim();
          if (!name) return;
          const key = name.toLowerCase();
          if (!seen.has(key)) {
            seen.set(key, { id: seen.size + 1, name, email: "", phone: "", company: "" });
          }
        });
        // prefer agents from the dedicated agents endpoint (fetched separately). If that is empty, use this derived list.
        setAgents(prev => (prev && prev.length ? prev : Array.from(seen.values())));

        // derive simple stats for display
        const totalIncome = data.reduce((s, p) => s + (p.price || 0), 0);
        const avgIncome = data.length ? Math.round(totalIncome / data.length) : 0;
        const avgDays = 18; // placeholder
        setFakeStats({ avgIncomePerMonth: avgIncome, avgListingDays: avgDays });
      } catch (err) {
        console.error("Failed to load properties:", err);
        if (mounted) setServerError(String(err?.message || err) || 'Failed to fetch properties');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchProperties();
    return () => { mounted = false; };
  }, [ENV_API, loadingMe]);

  // Fetch photographers list from API (separate endpoint). Only fetch when the
  // photographers tab is visible to avoid unnecessary requests and to keep
  // the list fresh when the user navigates to the tab.
  useEffect(() => {
    if (loadingMe) return;
    if (selectedTab !== 'photographers') return;
    let mounted = true;
    const fetchPhotographers = async () => {
      let lastErr = null;
      for (const base of API_BASE_DEFAULTS) {
        const url = `${base.replace(/\/$/, "")}/photographers`;
        try {
          const token = localStorage.getItem("access_token");
          const headers = token ? { "Authorization": `Bearer ${token}` } : {};
          const res = await fetch(url, { headers });
          if (!res.ok) {
            lastErr = new Error(`${res.status} ${res.statusText}`);
            continue;
          }
          const data = await res.json();
          if (!mounted) return;
          try { console.debug('photographers: loaded', url, Array.isArray(data) ? data.length : typeof data); } catch(e) {}
          if (mounted) {
            setPhotographersSource(url);
            setPhotographersError(null);
          }
          const apiList = Array.isArray(data) ? data : [];
          // Merge API photographers with any photographers derived from properties
          setPhotographers(prev => {
            const map = new Map();
            (prev || []).forEach(p => {
              const key = p && p.id ? `id:${p.id}` : `name:${(p.name||'').toLowerCase()}`;
              map.set(key, p);
            });
            apiList.forEach(p => {
              const key = p && p.id ? `id:${p.id}` : `name:${(p.name||'').toLowerCase()}`;
              map.set(key, p);
            });
            try {
              (properties || []).forEach(prop => {
                const ph = prop && prop.photographer;
                if (!ph) return;
                const key = ph && ph.id ? `id:${ph.id}` : `name:${(ph.name||'').toLowerCase()}`;
                if (!map.has(key)) map.set(key, ph);
              });
            } catch (e) {}
            const merged = Array.from(map.values());
            // if merged is empty but we have properties with embedded photographers, build fallback
            if (merged.length === 0 && Array.isArray(properties) && properties.length > 0) {
              const seen = new Map();
              properties.forEach(p => {
                const ph = p.photographer;
                if (!ph) return;
                const key = ph && ph.id ? `id:${ph.id}` : `name:${(ph.name||'').toLowerCase()}`;
                if (!seen.has(key)) seen.set(key, ph);
              });
              return Array.from(seen.values());
            }
            return merged;
          });
          return;
        } catch (err) {
          lastErr = err;
          console.warn(`Failed to fetch photographers from ${url}:`, err);
        }
      }
      if (lastErr && mounted) {
        console.error('Failed to fetch photographers:', lastErr);
        setPhotographersSource(null);
        setPhotographersError(String(lastErr?.message || lastErr));
        // fallback: build photographers list from embedded properties (if any)
        try {
          const seen = new Map();
          (properties || []).forEach(p => {
            const ph = p.photographer;
            if (!ph) return;
            const key = ph && ph.id ? `id:${ph.id}` : `name:${(ph.name||'').toLowerCase()}`;
            if (!seen.has(key)) seen.set(key, ph);
          });
          const fallback = Array.from(seen.values());
          if (fallback.length) setPhotographers(fallback);
        } catch (e) {
          // ignore
        }
      }
    };
    fetchPhotographers();
    return () => { mounted = false; };
  }, [ENV_API, loadingMe, selectedTab, photographersRefreshCounter]);

  // Fetch agents from API (separate endpoint). This powers the Agents tab and the agent editor.
  useEffect(() => {
    if (loadingMe) return; // wait for auth check
    let mounted = true;
    const fetchAgents = async () => {
      let lastErr = null;
      for (const base of API_BASE_DEFAULTS) {
        const url = `${base.replace(/\/$/, "")}/agents`;
        try {
          const token = localStorage.getItem("access_token");
          const headers = token ? { "Authorization": `Bearer ${token}` } : {};
          const res = await fetch(url, { headers });
          if (!res.ok) {
            lastErr = new Error(`${res.status} ${res.statusText}`);
            continue;
          }
          const data = await res.json();
          if (!mounted) return;
          setAgents(Array.isArray(data) ? data : []);
          return;
        } catch (err) {
          lastErr = err;
          console.warn(`Failed to fetch agents from ${url}:`, err);
        }
      }
      if (mounted) console.warn('Agents fetch failed:', lastErr);
    };
    fetchAgents();
    return () => { mounted = false; };
  }, [ENV_API, loadingMe]);

  // Fetch timeseries statistics for dashboard chart
  useEffect(() => {
    let mounted = true;
    const fetchStats = async () => {
      setStatsLoading(true);
      let lastErr = null;
      for (const base of API_BASE_DEFAULTS) {
        const url = `${base.replace(/\/$/, "")}/stats/summary?days=30`;
        try {
          const token = localStorage.getItem("access_token");
          const headers = token ? { "Authorization": `Bearer ${token}` } : {};
          const res = await fetch(url, { headers });
          if (!res.ok) {
            lastErr = new Error(`${res.status} ${res.statusText}`);
            continue;
          }
          const data = await res.json();
          if (!mounted) return;
          setStatsData(Array.isArray(data) ? data : []);
          setStatsError(null);
          setStatsLoading(false);
          return;
        } catch (err) {
          lastErr = err;
          console.warn(`Failed to fetch stats from ${url}:`, err);
        }
      }
      if (mounted) {
        setStatsData([]);
        setStatsError(String(lastErr?.message || lastErr));
        setStatsLoading(false);
      }
    };
    fetchStats();
    return () => { mounted = false; };
  }, [ENV_API]);

  // helper to rebuild agents (fallback) when properties change
  const rebuildAgentsFromProperties = (props) => {
    const seen = new Map();
    props.forEach(p => {
      const name = (p.agent || "").trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, { id: seen.size + 1, name, email: "", phone: "", company: "" });
      }
    });
    setAgents(prev => (prev && prev.length ? prev : Array.from(seen.values())));
  };

  // --- Agents CRUD helpers (frontend) ---
  const openEditAgent = (a) => {
    // keep a copy and store original name to update properties when renamed
    setEditingAgent({ ...a, _origName: a?.name });
    setShowAgentEditor(true);
  };

  const closeEditAgent = () => {
    setEditingAgent(null);
    setShowAgentEditor(false);
  };

  const handleAgentChange = (e) => {
    const { name, value } = e.target;
    setEditingAgent(prev => ({ ...(prev || {}), [name]: value }));
  };

  const handleSaveAgent = async (e) => {
    e && e.preventDefault && e.preventDefault();
    if (!editingAgent) return;
    const token = localStorage.getItem('access_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    try {
      if (editingAgent.id) {
        // update (try all API bases)
        const updated = await apiFetch(`/agents/${editingAgent.id}`, { method: 'PATCH', body: { name: editingAgent.name, email: editingAgent.email, phone: editingAgent.phone, company: editingAgent.company } });
        setAgents(prev => prev.map(a => a.id === updated.id ? updated : a));
        // update properties that referenced the original agent name
        if (editingAgent._origName && editingAgent._origName !== updated.name) {
          setProperties(prev => prev.map(p => (p.agent && p.agent.toLowerCase() === (editingAgent._origName||'').toLowerCase() ? { ...p, agent: updated.name } : p)));
        }
      } else {
        // create (try all API bases)
        const created = await apiFetch('/agents', { method: 'POST', body: { name: editingAgent.name, email: editingAgent.email, phone: editingAgent.phone, company: editingAgent.company } });
        setAgents(prev => [created, ...prev]);
      }
      closeEditAgent();
    } catch (err) {
      console.error('Failed to save agent', err);
      alert('Failed to save agent: ' + String(err?.message || err));
    }
  };

  const handleDeleteAgent = async (id) => {
    if (!confirm('Delete this agent? This will clear the agent name on any matching properties.')) return;
    const token = localStorage.getItem('access_token');
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    try {
      await apiFetch(`/agents/${id}`, { method: 'DELETE', headers });
      const removed = agents.find(a => a.id === id);
      setAgents(prev => prev.filter(a => a.id !== id));
      if (removed && removed.name) {
        setProperties(prev => prev.map(p => (p.agent && p.agent.toLowerCase() === (removed.name||'').toLowerCase() ? { ...p, agent: '' } : p)));
      }
    } catch (err) {
      console.error('Failed to delete agent', err);
      alert('Failed to delete agent');
    }
  };

 

  const toggleExpand = (id) => {
    setExpandedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Generate a printable report in a new window and trigger print (user can Save as PDF)
  const generateReport = () => {
    try {
      const parsed = Array.isArray(statsData) ? statsData.map(s => ({ date: s.date, shoots: Number(s.shoots_count ?? s.shoots ?? 0), income: Number(s.income_total ?? s.income ?? 0) })) : [];
      const days = parsed.length || 30;
      const totalShoots = parsed.reduce((sum, p) => sum + (p.shoots || 0), 0);
      const totalIncome = parsed.reduce((sum, p) => sum + (p.income || 0), 0);
      const avgShootsPerDay = days ? (totalShoots / days) : 0;
      const avgIncomePerShoot = totalShoots ? (totalIncome / totalShoots) : 0;
      const totalProperties = Array.isArray(properties) ? properties.length : 0;
      const soldCount = Array.isArray(properties) ? properties.filter(p => (p.status || '').toLowerCase() === 'sold').length : 0;
      const soldPercent = totalProperties ? Math.round((soldCount / totalProperties) * 100) : 0;
      const photographersCount = Array.isArray(photographers) ? photographers.length : 0;
      const unpaidTotal = totalUnpaid || 0;

      const title = 'Company Metrics Report';
      const now = new Date().toLocaleString();

      // build HTML report (simple table + summary). Keep styles inline for printing.
      const html = `
        <html>
          <head>
            <title>${title}</title>
            <meta charset="utf-8" />
            <style>
              body { font-family: 'Roboto', -apple-system, system-ui, 'Segoe UI', Arial, 'Helvetica Neue'; color: #111827; padding: 24px; }
              h1 { font-size: 20px; margin-bottom: 6px }
              .muted { color: #6b7280; font-size: 12px }
              .grid { display: flex; gap: 18px; flex-wrap: wrap; margin-bottom: 18px }
              .card { border: 1px solid #e6e6e6; padding: 12px; border-radius: 8px; min-width: 140px }
              table { width: 100%; border-collapse: collapse; margin-top: 12px }
              th, td { padding: 8px 6px; border: 1px solid #eee; text-align: left }
              .right { text-align: right }
              @media print { .no-print { display: none } }
            </style>
          </head>
          <body>
            <div class="no-print" style="margin-bottom:12px"><strong>${title}</strong> — Generated: ${now}</div>
            <h1>${title}</h1>
            <div class="muted">Summary of company metrics and timeseries data</div>

            <div class="grid">
              <div class="card"><div class="muted">Total shoots (last ${days} days)</div><div style="font-size:18px;font-weight:700;margin-top:6px">${totalShoots}</div></div>
              <div class="card"><div class="muted">Avg shoots / day</div><div style="font-size:18px;font-weight:700;margin-top:6px">${avgShootsPerDay.toFixed(1)}</div></div>
              <div class="card"><div class="muted">Total income (last ${days} days)</div><div style="font-size:18px;font-weight:700;margin-top:6px">$${Math.round(totalIncome).toLocaleString()}</div></div>
              <div class="card"><div class="muted">Avg income / shoot</div><div style="font-size:18px;font-weight:700;margin-top:6px">$${avgIncomePerShoot.toFixed(0)}</div></div>
              <div class="card"><div class="muted">Listings sold %</div><div style="font-size:18px;font-weight:700;margin-top:6px">${soldPercent}%</div></div>
              <div class="card"><div class="muted">Total properties</div><div style="font-size:18px;font-weight:700;margin-top:6px">${totalProperties}</div></div>
              <div class="card"><div class="muted">Photographers</div><div style="font-size:18px;font-weight:700;margin-top:6px">${photographersCount}</div></div>
              <div class="card"><div class="muted">Total unpaid</div><div style="font-size:18px;font-weight:700;margin-top:6px">$${Math.round(unpaidTotal).toLocaleString()}</div></div>
            </div>

            <h2 style="margin-top:12px">Timeseries</h2>
            <div class="muted">Date | Shoots | Income</div>
            <table>
              <thead><tr><th>Date</th><th class="right">Shoots</th><th class="right">Income</th></tr></thead>
              <tbody>
                ${parsed.map(p => `<tr><td>${p.date}</td><td class="right">${p.shoots}</td><td class="right">$${p.income.toFixed(2)}</td></tr>`).join('')}
              </tbody>
            </table>

            <div style="margin-top:18px" class="muted">End of report</div>
            <script>window.onload = function(){ window.focus(); setTimeout(()=>{ window.print(); }, 300); };</script>
          </body>
        </html>
      `;

      const w = window.open('', '_blank');
      if (!w) {
        alert('Unable to open new window. Please allow popups for this site to generate the report.');
        return;
      }
      w.document.write(html);
      w.document.close();
    } catch (err) {
      alert('Failed to generate report: ' + String(err?.message || err));
    }
  };

  // Derived listing collections used by the left-menu and dashboard
  const filteredListings = (properties || []).filter(p => {
    try {
      return String(p.address || "").toLowerCase().includes(listingSearch.toLowerCase());
    } catch (e) { return false; }
  });

  const sortedListings = filteredListings.slice().sort((a, b) => {
    if (listingSort === 'price_asc') return (Number(a.price || 0) - Number(b.price || 0));
    if (listingSort === 'price_desc') return (Number(b.price || 0) - Number(a.price || 0));
    // newest - sort by id desc as a simple proxy
    return (Number(b.id || 0) - Number(a.id || 0));
  });

  const dashboardProperties = (properties || []).filter(p => {
    const status = (p.status || '').toString().toLowerCase();
    const paid = ('paid' in p) ? !!p.paid : false;
    return (status === 'pending' || status === 'sold') && !paid;
  });

  // Email escrow action removed — simplified dashboard actions.

  const openForm = () => {
    setForm({ address: "", status: "Active", price: "", agent: "" });
    setShowForm(true);
  };

  const closeForm = () => setShowForm(false);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  // Photographer CRUD helpers (frontend)
  const handlePhotogFormChange = (e) => {
    const { name, value } = e.target;
    setPhotogForm(prev => ({ ...prev, [name]: value }));
  };

  const handleCreatePhotographer = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('access_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    try {
      const created = await apiFetch('/photographers', { method: 'POST', body: photogForm });
      setPhotographers(prev => [created, ...prev]);
      setPhotogForm({ name: '', email: '', phone: '', company: '' });
      setShowPhotogForm(false);
    } catch (err) {
      console.error('Failed to create photographer', err);
      alert('Failed to create photographer. See console.');
    }
  };

  const handleDeletePhotographer = async (id) => {
    if (!confirm('Delete this photographer?')) return;
    const token = localStorage.getItem('access_token');
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    try {
      await apiFetch(`/photographers/${id}`, { method: 'DELETE', headers });
      setPhotographers(prev => prev.filter(p => p.id !== id));
      // also clear photographer reference from properties in state
      setProperties(prev => prev.map(pr => pr.photographer_id === id ? { ...pr, photographer_id: null, photographer: null } : pr));
    } catch (err) {
      console.error('Failed to delete photographer', err);
      alert('Failed to delete photographer');
    }
  };

  

  // Login handler: receive token in response, store in localStorage and fetch /me with Authorization header
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      let body = null;
      try {
        body = await apiFetch('/login', { method: 'POST', body: { name: loginForm.name, password: loginForm.password }, credentials: 'include' });
      } catch (err) {
        // apiFetch already logged failures; surface message to user
        alert(String(err?.message || err) || 'Login failed');
        return;
      }
      if (body.access_token) {
        // persist token and immediately verify with /me
        console.debug('login: received token', body.access_token && body.access_token.slice(0,8) + '...');
        localStorage.setItem("access_token", body.access_token);
        try {
          const me = await apiFetch('/me');
          setCurrentUser(me);
        } catch (err) {
          console.warn('GET /me after login returned error', err);
        }
      } else {
        alert("Login succeeded but no token returned");
      }
    } catch (err) {
      console.error("Login error", err);
      alert("Login error");
    }
  };

  // Register handler: create user, get token from response (backend now returns it), store and set user
  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      let body = null;
      try {
        body = await apiFetch('/register', { method: 'POST', body: { name: regForm.name, email: regForm.email, password: regForm.password } });
      } catch (err) {
        alert(String(err?.message || err) || 'Register failed');
        return;
      }
      if (body && body.access_token) {
        localStorage.setItem("access_token", body.access_token);
        try { const me = await apiFetch('/me'); if (me) setCurrentUser(me); } catch(e) { }
        setShowRegister(false);
        return;
      }
      // fallback: try to auto-login if backend didn't return token
      try {
        const loginBody = await apiFetch('/login', { method: 'POST', body: { name: regForm.name, password: regForm.password } });
        if (loginBody && loginBody.access_token) {
          localStorage.setItem("access_token", loginBody.access_token);
          try { const me = await apiFetch('/me'); if (me) setCurrentUser(me); } catch(e) {}
        } else {
          alert("Created user but auto-login failed. Try logging in manually.");
        }
      } catch (err) {
        alert('Created user but auto-login failed. Try logging in manually.');
      }
      setShowRegister(false);
    } catch (err) {
      console.error("Register error", err);
      alert("Register error");
    }
  };

  // Logout: clear token and local state
  const handleLogout = async () => {
    localStorage.removeItem("access_token");
    setCurrentUser(null);
  };

  // POST new property to API and update local state (include credentials so server can validate auth)
  const handleAddProperty = async (e) => {
    e.preventDefault();
    if (!form.address.trim()) return alert("Address is required");
    const token = localStorage.getItem("access_token");
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const payload = {
      address: form.address.trim(),
      status: form.status,
      price: parseFloat(form.price) || 0,
      agent: form.agent.trim(),
      photographer_id: form.photographer_id ? (isNaN(Number(form.photographer_id)) ? null : Number(form.photographer_id)) : null,
      company: form.company || null
    };

    try {
      const created = await apiFetch('/properties', { method: 'POST', body: payload });
      const newProp = {
        id: created.id,
        address: created.address || payload.address,
        status: created.status || payload.status,
        price: typeof created.price === 'number' ? created.price : parseFloat(created.price) || payload.price,
        agent: created.agent || payload.agent
      };
      setProperties(prev => [newProp, ...prev]);
  rebuildAgentsFromProperties([newProp, ...properties]);
      setShowForm(false);
    } catch (err) {
      console.error("Failed to create property:", err);
      alert("Failed to create property. See console for details.");
    }
  };

  // AI sync: request backend to analyze properties and return summaries
  const handleAiSync = async () => {
    setAiSyncing(true);
    setAiSummaries({});
    try {
      const token = localStorage.getItem('access_token');
      const headers = token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
      let data = null;
      let lastErr = null;
      for (const base of API_BASE_DEFAULTS) {
        const url = `${base.replace(/\/$/, "")}/ai/sync`;
        try {
          const res = await fetch(url, { method: 'POST', headers });
          if (!res.ok) {
            const txt = await res.text().catch(()=>null);
            throw new Error(txt || `${res.status} ${res.statusText}`);
          }
          data = await res.json();
          break;
        } catch (err) {
          lastErr = err;
          console.warn('AI sync failed for', url, err);
        }
      }
      if (!data) throw lastErr || new Error('AI sync failed');
      // data is expected to be mapping of propertyId -> summary object
      setAiSummaries(data || {});
      alert('AI sync complete — summaries updated.');
    } catch (err) {
      console.error('AI sync error', err);
      console.error('AI sync failed, attempting local fallback for testing');
      // Local fallback generator: synthesize basic summaries from properties so devs can test UI without the remote API.
      try {
        const fallback = {};
        (properties || []).forEach(p => {
          const id = p.id || String(Math.random()).slice(2,8);
          const status = (p.status || '').toString().toLowerCase();
          const indicator = status === 'sold' ? 'SOLD' : (status === 'pending' ? 'PENDING' : 'ACTIVE');
          const price = Number(p.price || 0);
          const summary = `${p.address || 'Unknown address'} — ${indicator === 'SOLD' ? 'Appears sold' : (indicator === 'PENDING' ? 'Possibly pending' : 'Active listing')}. ${price ? 'List price: $' + price.toLocaleString() + '.' : ''}`;
          fallback[id] = {
            summary,
            indicator,
            status: indicator,
            sold_date: null,
            confidence: 0.25, // low confidence because this is a heuristic fallback
            _local_fallback: true
          };
        });
        setAiSummaries(fallback);
        alert('AI sync: remote service unreachable — populated local fallback summaries (test-only).');
      } catch (ferr) {
        console.error('Local AI fallback error', ferr);
        alert('AI sync failed: ' + String(err?.message || err));
      }
    } finally {
      setAiSyncing(false);
    }
  };

  // helper to update login/register form fields
  const updateLoginForm = (e) => setLoginForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const updateRegForm = (e) => setRegForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  // If we are still checking session, show minimal blank/loading
  if (loadingMe) {
    return <div className="min-h-screen flex items-center justify-center">Checking session...</div>;
  }

  // If not authenticated show centered simple login UI with "Create account" option
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#1C1C1C]">
        <div className="w-full max-w-md p-8 bg-white dark:bg-slate-800 rounded-lg shadow-lg">
          <h1 className="text-3xl font-bold text-center mb-4 text-green-400">Green Tree</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 text-center mb-6">Log in once per hour to keep your session active.</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Username</label>
              <input name="name" value={loginForm.name} onChange={updateLoginForm} className="w-full px-3 py-2 border rounded-md" required />
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1">Password</label>
              <input type="password" name="password" value={loginForm.password} onChange={updateLoginForm} className="w-full px-3 py-2 border rounded-md" required />
            </div>

            <div className="flex items-center justify-between">
              <button type="submit" className="bg-green-400 hover:bg-green-500 text-white px-4 py-2 rounded-md">Sign in</button>
              <div className="text-xs text-slate-500">Session: 1 hour</div>
            </div>
          </form>

          <div className="mt-6 text-center">
            <button onClick={() => setShowRegister(true)} className="text-sm text-green-400 hover:text-green-400 underline">Create account</button>
          </div>
        </div>

        {/* REGISTER MODAL (simple overlay) */}
        {showRegister && (
          <div className="fixed inset-0 flex items-center justify-center z-50" onClick={() => setShowRegister(false)}>
            <div className="absolute inset-0 bg-black/40" />
            <form onClick={(e) => e.stopPropagation()} onSubmit={handleRegister} className="relative bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md shadow-lg z-10">
              <h3 className="text-xl font-bold mb-4">Create account</h3>

              <label className="block mb-2 text-sm">
                <span className="text-slate-600 dark:text-slate-300">Username</span>
                <input name="name" value={regForm.name} onChange={updateRegForm} className={`mt-1 block w-full ${THEME.inputDark}`} required />
              </label>

              <label className="block mb-2 text-sm">
                <span className="text-slate-600 dark:text-slate-300">Email (optional)</span>
                <input name="email" value={regForm.email} onChange={updateRegForm} className={`mt-1 block w-full ${THEME.inputDark}`} />
              </label>

              <label className="block mb-4 text-sm">
                <span className="text-slate-600 dark:text-slate-300">Password</span>
                <input type="password" name="password" value={regForm.password} onChange={updateRegForm} className={`mt-1 block w-full ${THEME.inputDark}`} required />
              </label>

              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowRegister(false)} className="px-4 py-2 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100">Cancel</button>
                <button type="submit" className={`px-4 py-2 rounded-md ${THEME.btnPrimary} ${THEME.btnPrimaryDark} text-white`}>Create</button>
              </div>

              <div className="clear-both" />
            </form>
          </div>
        )}
      </div>
    );
  }

  // --- existing app UI (dashboard) renders here when authenticated ---
  return (
    // Wrapper toggles 'dark' class based on state so Tailwind dark: utilities apply
    <div className={`${darkMode ? 'dark' : ''}`}>
      {/* Page container: controls page background, text color and overall layout */}
      <div className={THEME.page}>

        {/* MOBILE HEADER */}
        {/* Header visible on small screens (md:hidden). Contains menu button, title and actions */}
        <header className={THEME.headerMobile}>
          {/* Menu button opens mobile sidebar */}
          <button
            onClick={() => setShowSidebar(true)}
            className="p-2 rounded-md text-slate-700 dark:text-slate-200"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>

          {/* Center area contains app title and current page subtitle */}
            <div className="text-center">
            {/* Header title (uses THEME.headerTitle for typography) */}
              <div className={THEME.headerTitle}>Green Tree</div>
            {/* Small subtitle showing current selected tab */}
            <div className={THEME.headerSubtitle}>
              {selectedTab === 'dashboard' ? 'Dashboard' : selectedTab === 'agents' ? 'Agents' : selectedTab === 'listings' ? 'Listings' : selectedTab === 'photographers' ? 'Photographers' : selectedTab === 'statistics' ? 'Statistics' : selectedTab === 'watcher' ? 'Watcher' : ''}
            </div>
          </div>

          {/* Right area: dark mode toggle and primary add button */}
          <div className="flex items-center gap-2">
            {/* Dark mode toggle: small icon button */}
            <button onClick={toggleDarkMode} className="p-2 rounded-md text-slate-700 dark:text-slate-200">
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Primary action button: uses THEME.btnPrimary + THEME.btnPrimaryDark */}
            <button onClick={openForm} className={`${THEME.btnPrimary} ${THEME.btnPrimaryDark} px-3 py-1 rounded-md text-sm`}>+ Add</button>
          </div>
        </header>

        {/* SIDEBAR - desktop */}
        {/* Permanent left navigation for md+ screens. THEME.sidebarDesktop sets width, background and padding */}
        <aside className={THEME.sidebarDesktop}>
          {/* Branding/title at top of sidebar */}
          <h1 className={THEME.brandTitle}>
            <TreeDeciduous size={24} className="text-green-400 mr-1" />
            Green Tree
          </h1>

          {/* Navigation links (Dashboard / Agents / Statistics / Watcher) */}
          <nav className="space-y-4">
            {/* Dashboard link: uses THEME.tabSelected when active, otherwise THEME.tabDefault */}
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); setSelectedTab('dashboard'); }}
              className={`flex items-center gap-3 ${selectedTab === 'dashboard' ? THEME.tabSelected : THEME.tabDefault}`}
            >
              <Home size={20}/> Dashboard
            </a>

            {/* Agents link */}
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); setSelectedTab('agents'); }}
              className={`flex items-center gap-3 ${selectedTab === 'agents' ? THEME.tabSelected : THEME.tabDefault}`}
            >
              <DollarSign size={20}/> Agents
            </a>

            {/* Photographers link */}
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); setSelectedTab('photographers'); }}
              className={`flex items-center gap-3 ${selectedTab === 'photographers' ? THEME.tabSelected : THEME.tabDefault}`}
            >
              <Menu size={20}/> Photographers
            </a>

            {/* Listings link */}
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); setSelectedTab('listings'); }}
              className={`flex items-center gap-3 ${selectedTab === 'listings' ? THEME.tabSelected : THEME.tabDefault}`}
            >
              <Search size={20}/> Listings
            </a>

            {/* AI Assistant link - routes to its own page */}
            <a
              href="/ai-assistant"
              onClick={(e) => { e.preventDefault(); router.push('/ai-assistant'); }}
              className={`flex items-center gap-3 ${THEME.tabDefault}`}
            >
              <MessageSquare size={20}/> AI Assistant
            </a>

            {/* Statistics link */}
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); setSelectedTab('statistics'); }}
              className={`flex items-center gap-3 ${selectedTab === 'statistics' ? THEME.tabSelected : THEME.tabDefault}`}
            >
              <BarChart size={20}/> Statistics
            </a>

            {/* Static "Watcher" link */}
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); setSelectedTab('watcher'); }}
              className={`flex items-center gap-3 ${selectedTab === 'watcher' ? THEME.tabSelected : THEME.tabDefault}`}
            >
              <Sun size={20}/> Watcher
            </a>
            
            {/* Dark mode toggle button (in sidebar for convenience) */}
            <button 
              onClick={toggleDarkMode}
              className="flex items-center gap-3 w-full text-slate-500 dark:text-slate-400 hover:text-green-400 dark:hover:text-[#3A6353] transition"
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              {darkMode ? 'Light Mode' : 'Dark Mode'}
            </button>
          </nav>
        </aside>

        {/* SIDEBAR - mobile off-canvas */}
        {/* Off-canvas wrapper: THEME.sidebarMobilePanelWrap controls position & transition.
            We toggle translate-x classes to show/hide */}
        <div className={`${THEME.sidebarMobilePanelWrap} ${showSidebar ? 'translate-x-0' : '-translate-x-full'}`} aria-hidden={!showSidebar}>
          {/* Panel contents with same branding and nav as desktop, optimized for mobile */}
          <div className={THEME.sidebarMobilePanel}>
            {/* Top row: brand + close button */}
            <div className="flex items-center justify-between mb-6">
              <h2 className={THEME.brandTitle}>
                <TreeDeciduous size={20} className="text-green-400 mr-1" />
                Green Tree
              </h2>
              {/* Close button hides the panel */}
              <button onClick={() => setShowSidebar(false)} className="p-2 rounded-md text-slate-700 dark:text-slate-200"><X /></button>
            </div>

            {/* Mobile navigation (same links, but closing the panel after selecting) */}
            <nav className="space-y-4">
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); setSelectedTab('dashboard'); setShowSidebar(false); }}
                className={`flex items-center gap-3 ${selectedTab === 'dashboard' ? THEME.tabMobileSelected : THEME.tabDefault}`}
              >
                <Home size={18}/> Dashboard
              </a>

              <a
                href="#"
                onClick={(e) => { e.preventDefault(); setSelectedTab('agents'); setShowSidebar(false); }}
                className={`flex items-center gap-3 ${selectedTab === 'agents' ? THEME.tabMobileSelected : THEME.tabDefault}`}
              >
                <DollarSign size={18}/> Agents
              </a>

              <a
                href="#"
                onClick={(e) => { e.preventDefault(); setSelectedTab('listings'); setShowSidebar(false); }}
                className={`flex items-center gap-3 ${selectedTab === 'listings' ? THEME.tabMobileSelected : THEME.tabDefault}`}
              >
                <Search size={18}/> Listings
              </a>

                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); setSelectedTab('photographers'); setShowSidebar(false); }}
                  className={`flex items-center gap-3 ${selectedTab === 'photographers' ? THEME.tabMobileSelected : THEME.tabDefault}`}
                >
                  <Menu size={18}/> Photographers
                </a>

              <a
                href="#"
                onClick={(e) => { e.preventDefault(); setSelectedTab('statistics'); setShowSidebar(false); }}
                className={`flex items-center gap-3 ${selectedTab === 'statistics' ? THEME.tabMobileSelected : THEME.tabDefault}`}
              >
                <BarChart size={18}/> Statistics
              </a>

              <a
                href="#"
                onClick={(e) => { e.preventDefault(); setSelectedTab('watcher'); setShowSidebar(false); }}
                className={`flex items-center gap-3 ${selectedTab === 'watcher' ? THEME.tabMobileSelected : THEME.tabDefault}`}
              >
                <Sun size={18}/> Watcher
              </a>

              {/* Mobile dark mode toggle */}
              <button
                onClick={() => { toggleDarkMode(); setShowSidebar(false); }}
                className="flex items-center gap-3 w-full text-slate-500 dark:text-slate-400 hover:text-green-400 dark:hover:text-[#3A6353] transition mt-4"
              >
                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                {darkMode ? 'Light Mode' : 'Dark Mode'}
              </button>
            </nav>
          </div>
        </div>

        {/* Overlay shown when mobile sidebar is open (clicking it closes the sidebar) */}
        {showSidebar && (
          <div
            onClick={() => setShowSidebar(false)}
            className={THEME.overlay}
            aria-hidden="true"
          />
        )}

        {/* MAIN CONTENT */}
        {/* Main area stretches to fill remaining width (flex-1). Padding adjusts on md+ */}
        <main className="flex-1 p-4 md:p-10 pt-20 md:pt-10">
          {/* Desktop header/top controls (hidden on mobile via hidden md:flex) */}
          <div className="hidden md:flex justify-between items-center mb-10">
            <div>
              {/* Page title and subtitle use THEME.pageTitle / THEME.pageSubtitle */}
              <h2 className={THEME.pageTitle}>
                {selectedTab === 'dashboard' ? 'Main Dashboard' : selectedTab === 'agents' ? 'Agent Directory' : selectedTab === 'listings' ? 'Listings' : selectedTab === 'photographers' ? 'Photographers' : selectedTab === 'statistics' ? 'Statistics' : selectedTab === 'watcher' ? 'Watcher' : ''}
              </h2>
              <p className={THEME.pageSubtitle}>
                {selectedTab === 'dashboard'
                  ? `Welcome, ${currentUser?.name || loginForm.name || 'Guest'}. Manage your real estate photography escrow.`
                  : selectedTab === 'agents'
                  ? 'Manage agents and their contact information.'
                  : selectedTab === 'listings'
                  ? 'Search and browse listings.'
                  : selectedTab === 'photographers'
                  ? 'Manage photographers who shoot your properties.'
                  : selectedTab === 'statistics'
                  ? 'Summary statistics (fake data for now).'
                  : 'Find best times and lighting for shoots.'}
              </p>
            </div>

            {/* Primary action button on the top-right for dashboard */}
            {selectedTab === 'dashboard' ? (
              <button
                onClick={openForm}
                className={`${THEME.btnPrimary} ${THEME.btnPrimaryDark} px-6 py-2 rounded-lg font-medium`}
              >
                + Add New Client
              </button>
            ) : selectedTab === 'agents' ? (
              <button
                onClick={() => { setEditingAgent({ name: '', email: '', phone: '', company: '' }); setShowAgentEditor(true); }}
                className={`${THEME.btnPrimary} ${THEME.btnPrimaryDark} px-6 py-2 rounded-lg font-medium`}
              >
                + Add Agent
              </button>
            ) : null}
          </div>

          {/* Loading indicator shown while fetching DB data */}
          {loading && <div className="p-4 text-center text-slate-600 dark:text-slate-300">Loading...</div>}

          {/* DASHBOARD TABLE (desktop) */}
          {selectedTab === 'dashboard' && !loading && (
            <>
              {/* Small stats cards row (hidden on mobile). THEME.cardDark controls visual style */}
              <div className="hidden md:grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                <div className={THEME.cardDark}>
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold text-green-400">READY TO BILL</p>
                  <p className="text-3xl font-bold mt-2">${fakeStats.avgIncomePerMonth.toLocaleString()}</p>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Expected to be invoiced / billed.</p>
                </div>

                <div className={THEME.cardDark}>
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold text-green-400">TOTAL UNPAID</p>
                  <p className="text-3xl font-bold mt-2">${totalUnpaid.toLocaleString()}</p>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Estimated value of unsold / unpaid listings.</p>
                </div>
              </div>

              {/* Listings panel moved to its own Listings tab. Use the Listings tab in the sidebar to view/search listings. */}

              {/* Timeseries: Average shoots vs income (last 30 days) */}
              <div className={THEME.cardDark + " mb-6"}>
                <h3 className="font-semibold mb-2">Shoots & Sales (last 30 days)</h3>
                {statsLoading ? (
                  <div className="text-sm text-slate-500">Loading stats…</div>
                ) : statsError ? (
                  <div className="text-sm text-red-500">{statsError}</div>
                ) : (!statsData || statsData.length === 0) ? (
                  <div className="text-sm text-slate-500">No statistics available yet.</div>
                ) : (
                  (() => {
                    // prepare ordered timeseries
                    const parsed = statsData
                      .map(s => ({ date: s.date, shoots: Number(s.shoots_count ?? s.shoots ?? 0), income: Number(s.income_total ?? s.income ?? 0) }))
                      .sort((a,b) => a.date.localeCompare(b.date));
                    const n = parsed.length;
                    const viewW = 600, viewH = 120, pad = 20;
                    const innerW = viewW - pad * 2, innerH = viewH - pad * 2;

                    // Build points as arrays to allow smoothing and axis ticks
                    const buildPoints = (values) => {
                      const min = Math.min(...values);
                      const max = Math.max(...values);
                      const range = max === min ? 1 : (max - min);
                      return values.map((v, i) => {
                        const x = pad + (i / Math.max(1, n - 1)) * innerW;
                        const y = pad + innerH - ((v - min) / range) * innerH;
                        return { x, y, v };
                      });
                    };

                    // Convert array of points to a smooth SVG path using Catmull-Rom -> Bezier
                    const pointsToPath = (pts) => {
                      if (!pts || pts.length === 0) return '';
                      if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
                      const path = [];
                      const p = (i) => pts[Math.max(0, Math.min(pts.length - 1, i))];
                      path.push(`M ${pts[0].x} ${pts[0].y}`);
                      for (let i = 0; i < pts.length - 1; i++) {
                        const p0 = p(i - 1);
                        const p1 = p(i);
                        const p2 = p(i + 1);
                        const p3 = p(i + 2);
                        // Catmull-Rom to Bezier conversion
                        const cp1x = p1.x + (p2.x - p0.x) / 6;
                        const cp1y = p1.y + (p2.y - p0.y) / 6;
                        const cp2x = p2.x - (p3.x - p1.x) / 6;
                        const cp2y = p2.y - (p3.y - p1.y) / 6;
                        path.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`);
                      }
                      return path.join(' ');
                    };

                    const pointsToAreaPath = (pts) => {
                      if (!pts || pts.length === 0) return '';
                      const linePath = pointsToPath(pts);
                      // close area to bottom-right and bottom-left
                      const rightBottom = `${pad + innerW} ${pad + innerH}`;
                      const leftBottom = `${pad} ${pad + innerH}`;
                      return `${linePath} L ${rightBottom} L ${leftBottom} Z`;
                    };

                    const shootsVals = parsed.map(p => p.shoots);
                    const incomeVals = parsed.map(p => p.income);
                    const shootsPts = buildPoints(shootsVals);
                    const incomePts = buildPoints(incomeVals);
                    const shootsPath = pointsToPath(shootsPts);
                    const incomePath = pointsToPath(incomePts);
                    const shootsArea = pointsToAreaPath(shootsPts);
                    const incomeArea = pointsToAreaPath(incomePts);

                    // Y-axis ticks (min, mid, max) for shoots and income
                    const sMin = Math.min(...shootsVals);
                    const sMax = Math.max(...shootsVals);
                    const sRange = sMax === sMin ? 1 : (sMax - sMin);
                    const sTicks = [sMax, Math.round((sMax + sMin) / 2), sMin].map(v => ({ label: v, y: pad + innerH - (((v - sMin) / sRange) * innerH) }));

                    const iMin = Math.min(...incomeVals);
                    const iMax = Math.max(...incomeVals);
                    const iRange = iMax === iMin ? 1 : (iMax - iMin);
                    const iTicks = [iMax, Math.round((iMax + iMin) / 2), iMin].map(v => ({ label: `$${v}`, y: pad + innerH - (((v - iMin) / iRange) * innerH) }));

                    return (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <div className="text-xs text-slate-500 mb-2">Shoots (count)</div>
                            <div className="w-full h-36 bg-slate-50 dark:bg-[#111] rounded p-2">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="w-3 h-3 rounded-full" style={{ background: '#2563eb' }} />
                                  <div className="text-sm font-medium">Shoots</div>
                                </div>
                                <div className="text-xs text-slate-500">Count</div>
                              </div>
                              <svg viewBox={`0 0 ${viewW} ${viewH}`} className="w-full h-full">
                                {/* grid lines & labels */}
                                {sTicks.map((t, idx) => (
                                  <g key={`s-t-${idx}`}>
                                    <line x1={pad} x2={pad + innerW} y1={t.y} y2={t.y} stroke="rgba(0,0,0,0.06)" />
                                    <text x={2} y={t.y + 4} fontSize="10" fill="#6b7280">{t.label}</text>
                                  </g>
                                ))}

                                {/* area */}
                                <path d={shootsArea} fill="rgba(37,99,235,0.08)" stroke="none" />
                                {/* smoothed line */}
                                <path d={shootsPath} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                              </svg>
                            </div>
                          </div>

                          <div>
                            <div className="text-xs text-slate-500 mb-2">Sales (income)</div>
                            <div className="w-full h-36 bg-slate-50 dark:bg-[#111] rounded p-2">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="w-3 h-3 rounded-full" style={{ background: '#16a34a' }} />
                                  <div className="text-sm font-medium">Sales</div>
                                </div>
                                <div className="text-xs text-slate-500">USD</div>
                              </div>
                              <svg viewBox={`0 0 ${viewW} ${viewH}`} className="w-full h-full">
                                {iTicks.map((t, idx) => (
                                  <g key={`i-t-${idx}`}>
                                    <line x1={pad} x2={pad + innerW} y1={t.y} y2={t.y} stroke="rgba(0,0,0,0.06)" />
                                    <text x={2} y={t.y + 4} fontSize="10" fill="#6b7280">{t.label}</text>
                                  </g>
                                ))}

                                <path d={incomeArea} fill="rgba(16,163,74,0.06)" stroke="none" />
                                <path d={incomePath} fill="none" stroke="#16a34a" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                              </svg>
                            </div>
                          </div>
                        </div>

                        <div className="text-xs text-slate-500">X axis: last {n} days (left = oldest). Values are scaled to chart height.</div>
                      </div>
                    );
                  })()
                )}
              </div>

              {/* Table wrapper (THEME.tableWrapDark provides background, rounding, overflow) */}
              <div className={THEME.tableWrapDark}>
                <table className="w-full">
                  {/* Table head (THEME.tableHeadDark adjusts color in dark mode) */}
                  <thead className={THEME.tableHeadDark}>
                    <tr>
                      <th className="p-4 text-left font-medium">Address</th>
                      <th className="p-4 text-left font-medium">Status</th>
                      <th className="p-4 text-right">Action</th>
                    </tr>
                  </thead>

                  {/* Table body: THEME.bodyDivideDark controls row dividers */}
                  <tbody className={THEME.bodyDivideDark}>
                    {dashboardProperties.map((prop) => (
                      <React.Fragment key={prop.id}>
                        {/* Row: clicking toggles expansion. hover:bg classes provide feedback */}
                        <tr
                          onClick={() => toggleExpand(prop.id)}
                          className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition cursor-pointer"
                          aria-expanded={expandedIds.includes(prop.id)}
                        >
                          <td className="p-4 font-medium">{prop.address}</td>
                          <td className="p-4">
                            {/* Status badge uses THEME.soldBadge or THEME.activeBadge */}
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${prop.status === 'Sold' ? THEME.soldBadge : (prop.status === 'Pending' ? THEME.pendingBadge : THEME.activeBadge)}`}>
                              {prop.status}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            {/* Quick actions simplified — no Email Escrow button to keep dashboard focused */}
                            <div className="text-xs text-slate-500">{prop.status === 'Sold' ? 'Ready to bill' : ''}</div>
                          </td>
                        </tr>

                        {/* Expanded details row shown when ID is in expandedIds */}
                        {expandedIds.includes(prop.id) && (
                          <tr key={`${prop.id}-details`} className="bg-slate-50 dark:bg-slate-800">
                            <td colSpan="3" className="p-4 text-sm text-slate-700 dark:text-slate-300">
                              {/* Details layout splits into price, agent and actions */}
                              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">Price</p>
                                  <p className="font-medium">${prop.price.toFixed(2)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">Agent</p>
                                  <p className="font-medium">{prop.agent}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                  {/* View button uses THEME.btnPrimary */}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); router.push(`/property/${prop.id}`); }}
                                    className={`px-4 py-2 ${THEME.btnPrimary} ${THEME.btnPrimaryDark} text-white rounded-md text-sm`}
                                  >
                                    View
                                  </button>

                                  {/* Removed Email Escrow action here to simplify workflow. */}
                                </div>
                              </div>
                              {/* AI summary (if available) */}
                              {(() => {
                                const s = (aiSummaries && (aiSummaries[prop.id] || aiSummaries[String(prop.id)])) || null;
                                if (!s) return null;
                                const indicator = (s.indicator || s.status || '').toString().toUpperCase();
                                return (
                                  <div className="mt-3 border-t pt-3 text-sm text-slate-700 dark:text-slate-300">
                                    <div className="text-xs text-slate-500">AI Summary</div>
                                    <div className="mt-1">{s.summary || s.preview || JSON.stringify(s)}</div>
                                    {indicator ? (
                                      <div className={`mt-2 inline-block px-2 py-1 rounded-full text-xs font-bold ${indicator === 'SOLD' ? THEME.soldBadge : (indicator === 'PENDING' ? THEME.pendingBadge : THEME.activeBadge)}`}>
                                        {`INDICATES ${indicator}`}
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })()}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* DASHBOARD CARDS (mobile) */}
              <div className="md:hidden space-y-4">
                {dashboardProperties.map(prop => (
                  <article
                    key={prop.id}
                    onClick={() => toggleExpand(prop.id)}
                    className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm border border-slate-200 dark:border-[#0b2b20]"
                  >
                    {/* Top row: address + agent on the left, status + price on the right */}
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">{prop.address}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{prop.agent}</div>
                      </div>
                      <div className="text-right">
                        <div className={`px-2 py-1 rounded-full text-xs font-bold ${prop.status === 'Sold' ? THEME.soldBadge : (prop.status === 'Pending' ? THEME.pendingBadge : THEME.activeBadge)}`}>{prop.status}</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 mt-2">${prop.price.toFixed(2)}</div>
                      </div>
                    </div>

                    {/* AI snippet for mobile card */}
                    {(() => {
                      const s = (aiSummaries && (aiSummaries[prop.id] || aiSummaries[String(prop.id)])) || null;
                      if (!s) return null;
                      const indicator = (s.indicator || s.status || '').toString().toUpperCase();
                      return (
                        <div className="mt-3 text-sm text-slate-700 dark:text-slate-300">
                          <div className="text-xs text-slate-500">AI</div>
                          <div className="mt-1">{s.summary || s.preview || ''}</div>
                          {indicator ? (
                            <div className={`mt-2 inline-block px-2 py-1 rounded-full text-xs font-bold ${indicator === 'SOLD' ? THEME.soldBadge : (indicator === 'PENDING' ? THEME.pendingBadge : THEME.activeBadge)}`}>{`INDICATES ${indicator}`}</div>
                          ) : null}
                        </div>
                      );
                    })()}
                    {/* Expanded mobile actions */}
                    {expandedIds.includes(prop.id) && (
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); router.push(`/property/${prop.id}`); }}
                          className={`flex-1 px-3 py-2 ${THEME.btnPrimary} ${THEME.btnPrimaryDark} text-white rounded-md text-sm`}
                        >
                          View
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </>
          )}

          {/* AGENTS */}
          {selectedTab === 'agents' && !loading && (
            <>
              <div className={THEME.cardDark + " mb-10 hidden md:block"}>
                <table className="w-full">
                  <thead className={THEME.cardDark}>
                    <tr>
                      <th className="p-4 text-left font-medium">Name</th>
                      <th className="p-4 text-left font-medium">Email</th>
                      <th className="p-4 text-left font-medium">Phone</th>
                      <th className="p-4 text-left font-medium">Company</th>
                      <th className="p-4 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-slate-700">
                    {agents.map(a => (
                      <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                        <td className="p-4 font-medium">{a.name}</td>
                        <td className="p-4 text-slate-600 dark:text-slate-300">{a.email}</td>
                        <td className="p-4 text-slate-600 dark:text-slate-300">{a.phone}</td>
                        <td className="p-4 text-slate-600 dark:text-slate-300">{a.company}</td>
                        <td className="p-4 text-right">
                          <div className="inline-flex gap-2">
                            <button
                              onClick={() => openEditAgent(a)}
                              className={`px-3 py-1 ${THEME.btnPrimary} ${THEME.btnPrimaryDark} text-white rounded-md text-sm`}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteAgent(a.id)}
                              className="px-3 py-1 bg-red-500 text-white rounded-md text-sm"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden space-y-4">
                {agents.map(a => (
                  <article key={a.id} className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm border border-slate-200 dark:border-[#0b2b20]">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium">{a.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{a.company}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-slate-500 dark:text-slate-400">{a.phone}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{a.email}</div>
                      </div>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <button onClick={() => openEditAgent(a)} className={`flex-1 px-3 py-2 ${THEME.btnPrimary} ${THEME.btnPrimaryDark} text-white rounded-md text-sm`}>Edit</button>
                      <button onClick={() => handleDeleteAgent(a.id)} className="flex-1 px-3 py-2 bg-red-500 text-white rounded-md text-sm">Delete</button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}

          {/* PHOTOGRAPHERS */}
          {selectedTab === 'photographers' && !loading && (
            <>
              <div className={THEME.cardDark + " mb-6"}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold">Photographers</h3>
                    {/* status line: shows where photographers were loaded from or errors */}
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {photographersError ? (
                        <span className="text-red-500">Failed to load photographers: {photographersError}</span>
                      ) : photographersSource ? (
                        <span>Loaded {photographers.length} from {photographersSource}</span>
                      ) : (
                        <span>Not loaded yet</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowPhotogForm(!showPhotogForm)} className={`px-3 py-1 rounded-md ${THEME.btnPrimary} ${THEME.btnPrimaryDark} text-white`}>{showPhotogForm ? 'Close' : '+ Add Photographer'}</button>
                  </div>
                </div>

                {showPhotogForm && (
                  <form onSubmit={handleCreatePhotographer} className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                    <input name="name" placeholder="Name" value={photogForm.name} onChange={handlePhotogFormChange} className={`${THEME.inputDark} p-2`} required />
                    <input name="email" placeholder="Email" value={photogForm.email} onChange={handlePhotogFormChange} className={`${THEME.inputDark} p-2`} />
                    <input name="phone" placeholder="Phone" value={photogForm.phone} onChange={handlePhotogFormChange} className={`${THEME.inputDark} p-2`} />
                    <div className="flex gap-2">
                      <input name="company" placeholder="Company" value={photogForm.company} onChange={handlePhotogFormChange} className={`${THEME.inputDark} p-2 flex-1`} />
                      <button type="submit" className={`px-4 py-2 rounded-md ${THEME.btnPrimary} ${THEME.btnPrimaryDark} text-white`}>Save</button>
                    </div>
                  </form>
                )}

                <div className="overflow-x-auto">
                  {(!photographers || photographers.length === 0) && (
                    <div className="p-4 text-sm text-slate-500">No photographers found. {photographersError ? <span className="text-red-500">Error: {photographersError}</span> : null}
                      <div className="mt-2">
                        <button onClick={() => setPhotographersRefreshCounter(c => c + 1)} className={`px-3 py-1 rounded-md ${THEME.btnPrimary} ${THEME.btnPrimaryDark} text-white`}>Retry</button>
                      </div>
                    </div>
                  )}
                  <table className="w-full">
                    <thead className={THEME.tableHeadDark}>
                      <tr>
                        <th className="p-4 text-left font-medium">Name</th>
                        <th className="p-4 text-left font-medium">Email</th>
                        <th className="p-4 text-left font-medium">Phone</th>
                        <th className="p-4 text-left font-medium">Company</th>
                        <th className="p-4 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-slate-700">
                      {photographers.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                          <td className="p-4 font-medium">{p.name}</td>
                          <td className="p-4 text-slate-600 dark:text-slate-300">{p.email}</td>
                          <td className="p-4 text-slate-600 dark:text-slate-300">{p.phone}</td>
                          <td className="p-4 text-slate-600 dark:text-slate-300">{p.company}</td>
                          <td className="p-4 text-right">
                            <div className="inline-flex gap-2">
                              <button onClick={() => handleDeletePhotographer(p.id)} className="px-3 py-1 bg-red-500 text-white rounded-md text-sm">Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* mobile list */}
              <div className="md:hidden space-y-4">
                {photographers.map(p => (
                  <article key={p.id} className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm border border-slate-200 dark:border-[#0b2b20]">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{p.company}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-slate-500 dark:text-slate-400">{p.phone}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{p.email}</div>
                      </div>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <button onClick={() => handleDeletePhotographer(p.id)} className="flex-1 px-3 py-2 bg-red-500 text-white rounded-md text-sm">Delete</button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}

          {/* STATISTICS */}
          {/* WATCHER (sun times) */}
          {selectedTab === 'watcher' && !loading && (
            <div className="mb-6">
              <div className={THEME.cardDark}>
                <h3 className="font-semibold mb-3">Sun times / Best windows for photography</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                  <input
                    placeholder="Enter an address (e.g. 123 Main St, City, State)"
                    value={watcherAddress}
                    onChange={(e) => setWatcherAddress(e.target.value)}
                    className={`${THEME.inputDark} p-2 col-span-2`}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        // trigger calculation (simple loop over bases like other fetchers)
                        if (!watcherAddress || !watcherAddress.trim()) return alert('Please enter an address');
                        setWatcherLoading(true);
                        setWatcherResult(null);
                        setWatcherError(null);
                        let lastErr = null;
                        for (const base of API_BASE_DEFAULTS) {
                          const url = `${base.replace(/\/$/, '')}/sun?address=${encodeURIComponent(watcherAddress)}`;
                          try {
                            const res = await fetch(url);
                            if (!res.ok) {
                              lastErr = new Error(`${res.status} ${res.statusText}`);
                              continue;
                            }
                            const data = await res.json();
                            setWatcherResult(data);
                            setWatcherError(null);
                            break;
                          } catch (err) {
                            lastErr = err;
                          }
                        }
                        if (!watcherResult && lastErr) setWatcherError(String(lastErr.message || lastErr));
                        setWatcherLoading(false);
                      }}
                      className={`px-4 py-2 rounded-md ${THEME.btnPrimary} ${THEME.btnPrimaryDark} text-white`}
                    >
                      {watcherLoading ? 'Working…' : 'Calculate'}
                    </button>
                    <button onClick={() => { setWatcherAddress(''); setWatcherResult(null); setWatcherError(null); }} className="px-4 py-2 rounded-md bg-slate-200 dark:bg-slate-700">Clear</button>
                  </div>
                </div>

                <div>
                  {watcherError && <div className="text-red-500">Error: {watcherError}</div>}
                  {watcherResult && (
                    <div className="mt-3 text-sm text-slate-700 dark:text-slate-300 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                        {/* Lighting Intelligence card */}
                        <div className="col-span-1 bg-white dark:bg-[#262626] rounded-lg p-4 shadow-sm border dark:border-[#262626]">
                          <h4 className="font-semibold mb-2">Lighting Intelligence</h4>
                          <div className="flex items-center gap-4">
                            {/* Compass */}
                            <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-[#333] flex items-center justify-center relative border">
                              <div className="w-0 h-0 border-l-4 border-r-4 border-b-10 border-l-transparent border-r-transparent border-b-yellow-400 absolute" style={{ transform: `rotate(${(watcherResult.times?.azimuth_deg ?? 0)}deg)` }} />
                            </div>
                            <div>
                              <div className="text-xs text-slate-500">Front-Facing Direction</div>
                              <div className="font-medium">{watcherResult.times?.front_facing || 'Unknown'}</div>
                              <div className="text-xs text-slate-500 mt-2">Peak Exterior Light</div>
                              <div className="font-medium">{watcherResult.times?.golden_hour || watcherResult.times?.sunrise || '—'}</div>
                            </div>
                          </div>
                          <div className="mt-3 text-xs text-amber-700">{watcherResult.times?.shadow_warning}</div>
                        </div>

                        {/* Raw coordinates & times summary */}
                        <div className="col-span-2 bg-white dark:bg-[#262626] rounded-lg p-4 shadow-sm border dark:border-[#262626]">
                          <div><strong>Address:</strong> {watcherResult.address}</div>
                          <div><strong>Coordinates:</strong> {watcherResult.latitude}, {watcherResult.longitude}</div>
                          <div className="mt-2">
                            <strong>Times:</strong>
                            <ul className="list-disc ml-6 mt-1">
                              {Object.entries(watcherResult.times || {}).map(([k,v]) => (
                                <li key={k}><strong>{k}:</strong> {String(v)}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
                  {/* Listings tab: full-page search/sort/list view */}
                  {selectedTab === 'listings' && !loading && (
                    <div className="mb-6">
                      <div className={`${THEME.cardDark} relative`}>
                        <h3 className="font-semibold mb-3">Listings — Search & Browse</h3>

                        {/* Sync AI button pinned to the top-right corner of the card */}
                        <div className="absolute right-4 top-4">
                          <button onClick={handleAiSync} className={`${THEME.btnPrimary} px-3 py-2 rounded-md`}>
                            {aiSyncing ? 'Syncing…' : 'Sync AI'}
                          </button>
                        </div>

                        <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                          <input placeholder="Search address or agent" value={listingSearch} onChange={(e) => setListingSearch(e.target.value)} className={`${THEME.inputDark} p-2 col-span-2`} />
                          <select value={listingSort} onChange={(e) => setListingSort(e.target.value)} className={`${THEME.inputDark} p-2`}>
                            <option value="newest">Newest</option>
                            <option value="price_asc">Price ↑</option>
                            <option value="price_desc">Price ↓</option>
                          </select>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className={THEME.tableHeadDark}>
                              <tr>
                                <th className="p-4 text-left font-medium">Address</th>
                                <th className="p-4 text-left font-medium">Status</th>
                                <th className="p-4 text-left font-medium">Price</th>
                                <th className="p-4 text-left font-medium">Paid</th>
                                <th className="p-4 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className={THEME.bodyDivideDark}>
                              {sortedListings.map(l => (
                                <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                                  <td className="p-4 font-medium">
                                    {l.address}
                                    {(() => {
                                      const s = (aiSummaries && (aiSummaries[l.id] || aiSummaries[String(l.id)])) || null;
                                      if (!s) return null;
                                      const indicator = (s.indicator || s.status || '').toString().toUpperCase();
                                      return (
                                        <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                                          <div className="text-xs text-slate-500">AI</div>
                                          <div className="mt-1">{s.summary || s.preview || ''}</div>
                                          {indicator ? (
                                            <div className={`mt-1 inline-block px-2 py-1 rounded-full text-xs font-bold ${indicator === 'SOLD' ? THEME.soldBadge : (indicator === 'PENDING' ? THEME.pendingBadge : THEME.activeBadge)}`}>{`INDICATES ${indicator}`}</div>
                                          ) : null}
                                        </div>
                                      );
                                    })()}
                                  </td>
                                  <td className="p-4"> <span className={`px-3 py-1 rounded-full text-xs font-bold ${l.status === 'Sold' ? THEME.soldBadge : (l.status === 'Pending' ? THEME.pendingBadge : THEME.activeBadge)}`}>{l.status}</span></td>
                                  <td className="p-4">${Number(l.price || 0).toFixed(2)}</td>
                                  <td className="p-4">{l.paid ? 'Yes' : 'No'}</td>
                                  <td className="p-4 text-right"><button onClick={() => router.push(`/property/${l.id}`)} className={`${THEME.btnPrimary} px-3 py-1 rounded-md`}>View</button></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Grid of stat cards; THEME.cardDark keeps consistent look with other panels */}
          {selectedTab === 'statistics' && !loading && (
            <>
              <div className="flex justify-end mb-4">
                <button onClick={generateReport} className={`${THEME.btnPrimary} px-3 py-2 rounded-md`}>Generate PDF Report</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className={THEME.cardDark}>
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold">Total shoots (last {statsParsed.length || 30} days)</p>
                  <p className="text-3xl font-bold mt-3">{statsTotalShoots}</p>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Count of completed photo shoots recorded in the statistics table.</p>
                </div>

                <div className={THEME.cardDark}>
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold">Avg shoots / day</p>
                  <p className="text-3xl font-bold mt-3">{statsAvgShootsPerDay.toFixed(1)}</p>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Average shoots per day over the selected window.</p>
                </div>

                <div className={THEME.cardDark}>
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold">Total income (last {statsParsed.length || 30} days)</p>
                  <p className="text-3xl font-bold mt-3">${Math.round(statsTotalIncome).toLocaleString()}</p>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Revenue collected for shoots in the period.</p>
                </div>

                <div className={THEME.cardDark}>
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold">Avg income per shoot</p>
                  <p className="text-3xl font-bold mt-3">${statsAvgIncomePerShoot.toFixed(0)}</p>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Total income divided by total shoots (useful for pricing decisions).</p>
                </div>

                <div className={THEME.cardDark}>
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold">Listings sold %</p>
                  <p className="text-3xl font-bold mt-3">{(properties?.length ? Math.round((properties.filter(p => (p.status || '').toLowerCase() === 'sold').length / properties.length) * 100) : 0)}%</p>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Percent of properties marked Sold (from current properties data).</p>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* FORM MODAL (Add Shoot) */}
      {showForm && (
        // Backdrop + centered form modal
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          onClick={closeForm}
        >
          {/* translucent background overlay */}
          <div className="absolute inset-0 bg-black/40" />
          {/* Actual form card: clicking inside should not close modal (stopPropagation used in JSX above) */}
          <form
            onSubmit={handleAddProperty}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md shadow-lg z-10"
          >
            <h3 className="text-xl font-bold mb-4">Add New Shoot</h3>

            {/* Form fields: each labeled block groups a field and label */}
            <label className="block mb-2 text-sm">
              <span className="text-slate-600 dark:text-slate-300">Address</span>
              <input
                name="address"
                value={form.address}
                onChange={handleFormChange}
                className={`mt-1 block w-full ${THEME.inputDark}`}
                required
              />
            </label>

            <label className="block mb-2 text-sm">
              <span className="text-slate-600 dark:text-slate-300">Status</span>
              <select
                name="status"
                value={form.status}
                onChange={handleFormChange}
                className={`mt-1 block w-full ${THEME.inputDark}`}
              >
                <option>Active</option>
                <option>Pending</option>
                <option>Sold</option>
              </select>
            </label>

            <label className="block mb-2 text-sm">
              <span className="text-slate-600 dark:text-slate-300">Price</span>
              <input
                name="price"
                value={form.price}
                onChange={handleFormChange}
                type="number"
                step="0.01"
                className={`mt-1 block w-full ${THEME.inputDark}`}
              />
            </label>

            <label className="block mb-4 text-sm">
              <span className="text-slate-600 dark:text-slate-300">Agent</span>
              <input
                name="agent"
                value={form.agent}
                onChange={handleFormChange}
                className={`mt-1 block w-full ${THEME.inputDark}`}
              />
            </label>

            <label className="block mb-2 text-sm">
              <span className="text-slate-600 dark:text-slate-300">Company</span>
              <input
                name="company"
                value={form.company}
                onChange={handleFormChange}
                className={`mt-1 block w-full ${THEME.inputDark}`}
              />
            </label>

            <label className="block mb-4 text-sm">
              <span className="text-slate-600 dark:text-slate-300">Photographer</span>
              <select name="photographer_id" value={form.photographer_id || ''} onChange={handleFormChange} className={`mt-1 block w-full ${THEME.inputDark}`}>
                <option value="">(none)</option>
                {photographers.map(p => (
                  <option key={p.id} value={p.id}>{p.name}{p.company ? ` — ${p.company}` : ''}</option>
                ))}
              </select>
            </label>

            {/* Form actions: cancel and submit */}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={closeForm}
                className="px-4 py-2 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`px-4 py-2 rounded-md ${THEME.btnPrimary} ${THEME.btnPrimaryDark} text-white`}
              >
                Add
              </button>
            </div>
          </form>
        </div>
      )}

      {/* AGENT EDITOR MODAL */}
      {showAgentEditor && editingAgent && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          onClick={closeEditAgent}
        >
          <div className="absolute inset-0 bg-black/40" />
          <form
            onSubmit={handleSaveAgent}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md shadow-lg z-10"
          >
            <h3 className="text-xl font-bold mb-4">Edit Agent</h3>

            <label className="block mb-2 text-sm">
              <span className="text-slate-600 dark:text-slate-300">Name</span>
              <input
                name="name"
                value={editingAgent.name}
                onChange={handleAgentChange}
                className={`mt-1 block w-full ${THEME.inputDark}`}
                required
              />
            </label>

            <label className="block mb-2 text-sm">
              <span className="text-slate-600 dark:text-slate-300">Email</span>
              <input
                name="email"
                value={editingAgent.email}
                onChange={handleAgentChange}
                className={`mt-1 block w-full ${THEME.inputDark}`}
              />
            </label>

            <label className="block mb-2 text-sm">
              <span className="text-slate-600 dark:text-slate-300">Phone</span>
              <input
                name="phone"
                value={editingAgent.phone}
                onChange={handleAgentChange}
                className={`mt-1 block w-full ${THEME.inputDark}`}
              />
            </label>

            <label className="block mb-4 text-sm">
              <span className="text-slate-600 dark:text-slate-300">Company</span>
              <input
                name="company"
                value={editingAgent.company}
                onChange={handleAgentChange}
                className={`mt-1 block w-full ${THEME.inputDark}`}
              />
            </label>

            <div className="flex justify-between items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (confirm("Delete this agent?")) {
                    handleDeleteAgent(editingAgent.id);
                    closeEditAgent();
                  }
                }}
                className="px-4 py-2 rounded-md bg-red-500 text-white"
              >
                Delete
              </button>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeEditAgent}
                  className="px-4 py-2 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 rounded-md ${THEME.btnPrimary} ${THEME.btnPrimaryDark} text-white`}
                >
                  Save
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
      {/* Fixed theme toggle button in bottom-left (persistent). Visible across pages. */}
      <button
        onClick={toggleDarkMode}
        aria-label="Toggle color theme"
        className="fixed left-4 bottom-4 z-50 p-3 rounded-full bg-white border border-slate-200 text-slate-700 shadow-md hover:bg-green-50 dark:bg-[#1C1C1C] dark:border-slate-700 dark:text-slate-200 dark:hover:bg-[#122016]"
      >
        {darkMode ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    </div>
  );
}