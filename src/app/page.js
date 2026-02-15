"use client";
import React, { useEffect, useState } from "react";
import { Home, DollarSign, Mail, Search, Moon, Sun, BarChart, Menu, X } from 'lucide-react';

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

  // debug: show which API base the client will attempt (helpful when env changes)
  if (typeof window !== 'undefined') {
    console.debug("api bases:", API_BASE_DEFAULTS, "-> primary:", API_BASE);
  }

  // THEME: central place for classes and colors used across the page.
  // Edit these values to change styling app-wide.
  const THEME = {
    page: "flex min-h-screen bg-slate-50 dark:bg-[#1C1C1C] text-slate-900 dark:text-slate-100 transition-colors duration-300",
    headerMobile: "md:hidden fixed top-0 left-0 right-0 z-40 bg-white dark:bg-slate-800 border-b dark:border-[#0b2b20] p-3 flex items-center justify-between",
    headerTitle: "font-bold text-base md:text-lg text-slate-900 dark:text-slate-100",
    headerSubtitle: "text-xs text-slate-500 dark:text-slate-400",
    brandTitle: "text-xl font-bold text-blue-600 dark:text-green-400 flex items-center gap-2",
    pageTitle: "text-3xl font-bold text-slate-900 dark:text-slate-100",
    pageSubtitle: "text-slate-500 dark:text-[#B6B6B6] text-sm mt-1",
    bodyText: "text-slate-500 dark:text-[#B6B6B6] text-sm mt-1",
    mutedText: "text-slate-500 dark:text-slate-400",
    sidebarDesktop: "hidden md:block w-64 bg-white dark:bg-[#262626] border-r dark:border-[#0b2b20] p-6 space-y-8",
    sidebarMobilePanelWrap: "fixed inset-y-0 left-0 z-50 w-64 transform md:hidden transition-transform",
    sidebarMobilePanel: "h-full bg-white dark:bg-[#262626] border-r dark:border-[#0b2b20] p-6",
    overlay: "fixed inset-0 bg-black/30 z-40 md:hidden",
    tabSelected: "px-3 py-2 rounded-md bg- dark:bg-[#3A6353] text-white shadow-sm",
    tabDefault: "text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-[#3A6353]",
    tabMobileSelected: "text-blue-600 dark:bg-[#3A6353] font-medium",
    btnPrimary: "bg-[#3A6353] text-white",
    btnPrimaryHover: "hover:bg-[#4D846F]",
    btnPrimaryDark: "dark:bg-[#3A6353] dark:hover:bg-[#4D846F]",
    btnAccentGreen: "bg-[#3A6353] dark:hover:bg-[#4D846F] text-white",
    cardDark: "bg-white dark:bg-[#262626] rounded-2xl shadow-sm border dark:border-[#262626] p-6",
    tableWrapDark: "bg-white dark:bg-[#262626] rounded-2xl shadow-sm border dark:border-[#262626] overflow-hidden",
    tableHeadDark: "bg-slate-50 dark:bg-[#3D3D3D] text-slate-500 dark:text-slate-400 text-sm",
    bodyDivideDark: "divide-y dark:divide-[#262626]",
    cardSmallDark: "bg-white dark:bg-[#262626]",
    inputDark: "bg-white dark:bg-[#262626] dark:border-[#0b2b20] text-slate-900 dark:text-slate-100 rounded-md px-3 py-2",
    soldBadge: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    activeBadge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  };

  // data & UI state
  const [darkMode, setDarkMode] = useState(false); // toggles the `dark` wrapper class
  const [selectedTab, setSelectedTab] = useState('dashboard'); // which tab/page is active
  const [showSidebar, setShowSidebar] = useState(false); // mobile sidebar open/close
  const [expandedIds, setExpandedIds] = useState([]); // expanded rows/cards
  const [properties, setProperties] = useState([]); // properties from DB
  const [customers, setCustomers] = useState([]); // derived customers list
  const [photographers, setPhotographers] = useState([]); // photographers from DB
  const [photographersSource, setPhotographersSource] = useState(null);
  const [photographersError, setPhotographersError] = useState(null);
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

  // Customer edit state
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [showCustomerEditor, setShowCustomerEditor] = useState(false);

  // Fake statistics (placeholder) — will derive from properties if desired
  const [fakeStats, setFakeStats] = useState({ avgIncomePerMonth: 0, avgListingDays: 0 });
  // Watcher/sun times UI state
  const [watcherAddress, setWatcherAddress] = useState("");
  const [watcherLoading, setWatcherLoading] = useState(false);
  const [watcherResult, setWatcherResult] = useState(null);
  const [watcherError, setWatcherError] = useState(null);

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

  // Fetch properties from API and derive customers + simple stats
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

        // derive customers from unique agent names
        const seen = new Map();
        data.forEach(p => {
          const name = (p.agent || "").trim();
          if (!name) return;
          const key = name.toLowerCase();
          if (!seen.has(key)) {
            seen.set(key, { id: seen.size + 1, name, email: "", phone: "", company: "" });
          }
        });
        setCustomers(Array.from(seen.values()));

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

  // Fetch photographers list from API (separate endpoint)
  useEffect(() => {
    // wait until session check completes before fetching photographers
    if (loadingMe) return;
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
          // debug: show which API base returned photographers and how many
          try { console.debug('photographers: loaded', url, Array.isArray(data) ? data.length : typeof data); } catch(e) {}
          // record the successful source for UI visibility
          if (mounted) {
            setPhotographersSource(url);
            setPhotographersError(null);
          }
          // Merge API photographers with any photographers derived from properties
          const apiList = Array.isArray(data) ? data : [];
          setPhotographers(prev => {
            // build map by id (when available) or name lowercase
            const map = new Map();
            prev.forEach(p => {
              const key = p && p.id ? `id:${p.id}` : `name:${(p.name||'').toLowerCase()}`;
              map.set(key, p);
            });
            apiList.forEach(p => {
              const key = p && p.id ? `id:${p.id}` : `name:${(p.name||'').toLowerCase()}`;
              map.set(key, p);
            });
            // also merge any photographers referenced by current properties state
            try {
              (properties || []).forEach(prop => {
                const ph = prop && prop.photographer;
                if (!ph) return;
                const key = ph && ph.id ? `id:${ph.id}` : `name:${(ph.name||'').toLowerCase()}`;
                if (!map.has(key)) map.set(key, ph);
              });
            } catch (e) {
              // ignore if properties not ready
            }
            return Array.from(map.values());
          });
          return;
        } catch (err) {
          lastErr = err;
          console.warn(`Failed to fetch photographers from ${url}:`, err);
        }
      }
      if (lastErr) {
        console.error('Failed to fetch photographers:', lastErr);
        if (mounted) {
          setPhotographersSource(null);
          setPhotographersError(String(lastErr?.message || lastErr));
        }
      }
    };
    fetchPhotographers();
    return () => { mounted = false; };
  }, [ENV_API]);

  // helper to rebuild customers when properties change
  const rebuildCustomersFromProperties = (props) => {
    const seen = new Map();
    props.forEach(p => {
      const name = (p.agent || "").trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, { id: seen.size + 1, name, email: "", phone: "", company: "" });
      }
    });
    setCustomers(Array.from(seen.values()));
  };

  const toggleDarkMode = () => setDarkMode(!darkMode);

  const toggleExpand = (id) => {
    setExpandedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleEmailEscrow = (e, prop) => {
    e.stopPropagation();
    alert(`Emailing escrow for ${prop.address}`);
  };

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
      const res = await fetch(`${API_BASE}/photographers`, { method: 'POST', headers, body: JSON.stringify(photogForm) });
      if (!res.ok) {
        const txt = await res.text().catch(()=>null);
        throw new Error(txt || `Create photog failed ${res.status}`);
      }
      const created = await res.json();
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
      const res = await fetch(`${API_BASE}/photographers/${id}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error(`Delete failed ${res.status}`);
      setPhotographers(prev => prev.filter(p => p.id !== id));
      // also clear photographer reference from properties in state
      setProperties(prev => prev.map(pr => pr.photographer_id === id ? { ...pr, photographer_id: null, photographer: null } : pr));
    } catch (err) {
      console.error('Failed to delete photographer', err);
      alert('Failed to delete photographer');
    }
  };

  // Customer editor helpers
  const openEditCustomer = (c) => {
    // create a shallow copy so editing doesn't mutate list until saved
    setEditingCustomer({ ...c });
    setShowCustomerEditor(true);
  };

  const closeEditCustomer = () => {
    setEditingCustomer(null);
    setShowCustomerEditor(false);
  };

  const handleCustomerChange = (e) => {
    const { name, value } = e.target;
    setEditingCustomer(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveCustomer = (e) => {
    e.preventDefault();
    if (!editingCustomer || !editingCustomer.name || !editingCustomer.name.trim()) return alert('Name is required');
    // Update customers list locally
    setCustomers(prev => prev.map(c => (c.id === editingCustomer.id ? { ...c, ...editingCustomer } : c)));
    // Also update properties that referenced this customer by name (best-effort)
    setProperties(prev => prev.map(p => (p.agent && p.agent.toLowerCase() === editingCustomer.name.toLowerCase() ? { ...p, agent: editingCustomer.name } : p)));
    closeEditCustomer();
  };

  const handleDeleteCustomer = (id) => {
    if (!confirm('Delete this customer? This will clear the agent field on any matching properties.')) return;
    const c = customers.find(x => x.id === id);
    if (c) {
      // clear agent references from properties
      setProperties(prev => prev.map(p => (p.agent && p.agent.toLowerCase() === (c.name || '').toLowerCase() ? { ...p, agent: '' } : p)));
      setCustomers(prev => prev.filter(x => x.id !== id));
    }
  };

  // Login handler: receive token in response, store in localStorage and fetch /me with Authorization header
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: loginForm.name, password: loginForm.password }),
        credentials: 'include'
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        alert(err?.detail || "Login failed");
        return;
      }
      const body = await res.json();
      if (body.access_token) {
        // persist token and immediately verify with /me
        console.debug('login: received token', body.access_token && body.access_token.slice(0,8) + '...');
        localStorage.setItem("access_token", body.access_token);
        const me = await fetch(`${API_BASE}/me`, { headers: { "Authorization": `Bearer ${body.access_token}` }, credentials: 'include' });
        if (me.ok) setCurrentUser(await me.json());
        else console.warn('GET /me after login returned', me.status);
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
      const res = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: regForm.name, email: regForm.email, password: regForm.password })
      });
      if (!res.ok) {
        const err = await res.json().catch(()=>null);
        alert(err?.detail || "Register failed");
        return;
      }
      const body = await res.json();
      if (body.access_token) {
        localStorage.setItem("access_token", body.access_token);
        const me = await fetch(`${API_BASE}/me`, { headers: { "Authorization": `Bearer ${body.access_token}` }});
        if (me.ok) setCurrentUser(await me.json());
        setShowRegister(false);
        return;
      }
      // fallback: try to auto-login if backend didn't return token
      const loginRes = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: regForm.name, password: regForm.password })
      });
      if (!loginRes.ok) {
        alert("Created user but auto-login failed. Try logging in manually.");
        setShowRegister(false);
        return;
      }
      const loginBody = await loginRes.json();
      if (loginBody.access_token) {
        localStorage.setItem("access_token", loginBody.access_token);
        const me = await fetch(`${API_BASE}/me`, { headers: { "Authorization": `Bearer ${loginBody.access_token}` }});
        if (me.ok) setCurrentUser(await me.json());
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
      const res = await fetch(`${API_BASE}/properties`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        if (res.status === 401) return alert("You must be logged in to create a property.");
        throw new Error(`Create failed: ${res.status}`);
      }
      const created = await res.json();
      const newProp = {
        id: created.id,
        address: created.address || payload.address,
        status: created.status || payload.status,
        price: typeof created.price === 'number' ? created.price : parseFloat(created.price) || payload.price,
        agent: created.agent || payload.agent
      };
      setProperties(prev => [newProp, ...prev]);
      rebuildCustomersFromProperties([newProp, ...properties]);
      setShowForm(false);
    } catch (err) {
      console.error("Failed to create property:", err);
      alert("Failed to create property. See console for details.");
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
          <h1 className="text-3xl font-bold text-center mb-4 text-[rgb(58,99,83)]">Green Tree</h1>
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
              <button type="submit" className="bg-[#3A6353] text-white px-4 py-2 rounded-md">Sign in</button>
              <div className="text-xs text-slate-500">Session: 1 hour</div>
            </div>
          </form>

          <div className="mt-6 text-center">
            <button onClick={() => setShowRegister(true)} className="text-sm text-blue-600 underline">Create account</button>
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
            <div className={THEME.headerSubtitle}>{selectedTab === 'dashboard' ? 'Dashboard' : selectedTab === 'customers' ? 'Customers' : selectedTab === 'photographers' ? 'Photographers' : 'Statistics'}</div>
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
            <Home size={24} /> Green Tree
          </h1>

          {/* Navigation links (Dashboard / Customers / Statistics / Watcher) */}
          <nav className="space-y-4">
            {/* Dashboard link: uses THEME.tabSelected when active, otherwise THEME.tabDefault */}
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); setSelectedTab('dashboard'); }}
              className={`flex items-center gap-3 ${selectedTab === 'dashboard' ? THEME.tabSelected : THEME.tabDefault}`}
            >
              <Home size={20}/> Dashboard
            </a>

            {/* Customers link */}
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); setSelectedTab('customers'); }}
              className={`flex items-center gap-3 ${selectedTab === 'customers' ? THEME.tabSelected : THEME.tabDefault}`}
            >
              <DollarSign size={20}/> Customers
            </a>

            {/* Photographers link */}
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); setSelectedTab('photographers'); }}
              className={`flex items-center gap-3 ${selectedTab === 'photographers' ? THEME.tabSelected : THEME.tabDefault}`}
            >
              <Menu size={20}/> Photographers
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
              <Search size={20}/> Watcher
            </a>
            
            {/* Dark mode toggle button (in sidebar for convenience) */}
            <button 
              onClick={toggleDarkMode}
              className="flex items-center gap-3 w-full text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-green-400 transition"
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
                <Home size={20} /> Green Tree
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
                onClick={(e) => { e.preventDefault(); setSelectedTab('customers'); setShowSidebar(false); }}
                className={`flex items-center gap-3 ${selectedTab === 'customers' ? THEME.tabMobileSelected : THEME.tabDefault}`}
              >
                <DollarSign size={18}/> Customers
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
                <Search size={18}/> Watcher
              </a>

              {/* Mobile dark mode toggle */}
              <button
                onClick={() => { toggleDarkMode(); setShowSidebar(false); }}
                className="flex items-center gap-3 w-full text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-green-400 transition mt-4"
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
                {selectedTab === 'dashboard' ? 'Main Dashboard' : selectedTab === 'customers' ? 'Customer Database' : selectedTab === 'photographers' ? 'Photographers' : 'Statistics'}
              </h2>
              <p className={THEME.pageSubtitle}>
                {selectedTab === 'dashboard'
                  ? `Welcome, ${currentUser?.name || loginForm.name || 'Guest'}. Manage your real estate photography escrow.`
                  : selectedTab === 'customers'
                  ? 'Example customer records. Will be connected to MySQL later.'
                  : selectedTab === 'photographers'
                  ? 'Manage photographers who shoot your properties.'
                  : 'Summary statistics (fake data for now).'}
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
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold text-[rgb(58,99,83)]">READY TO BILL</p>
                  <p className="text-3xl font-bold mt-2">${fakeStats.avgIncomePerMonth.toLocaleString()}</p>
                </div>
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
                    {properties.map((prop) => (
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
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${prop.status === 'Sold' ? THEME.soldBadge : THEME.activeBadge}`}>
                              {prop.status}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            {/* Email button shown only for Sold items. Uses THEME.btnAccentGreen */}
                            {prop.status === 'Sold' && (
                              <button
                                onClick={(e) => handleEmailEscrow(e, prop)}
                                className={`${THEME.btnAccentGreen} px-4 py-1 rounded-md text-sm`}
                              >
                                Email Escrow
                              </button>
                            )}
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
                                    onClick={(e) => { e.stopPropagation(); }}
                                    className={`px-4 py-2 ${THEME.btnPrimary} ${THEME.btnPrimaryDark} text-white rounded-md text-sm`}
                                  >
                                    View
                                  </button>

                                  {/* Email action uses neutral bg for contrast in dark mode */}
                                  <button
                                    onClick={(e) => handleEmailEscrow(e, prop)}
                                    className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-md text-sm flex items-center gap-2"
                                  >
                                    <Mail size={16} /> Email Escrow
                                  </button>
                                </div>
                              </div>
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
                {properties.map(prop => (
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
                        <div className={`px-2 py-1 rounded-full text-xs font-bold ${prop.status === 'Sold' ? THEME.soldBadge : THEME.activeBadge}`}>{prop.status}</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 mt-2">${prop.price.toFixed(2)}</div>
                      </div>
                    </div>

                    {/* Expanded mobile actions */}
                    {expandedIds.includes(prop.id) && (
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); }}
                          className={`flex-1 px-3 py-2 ${THEME.btnPrimary} ${THEME.btnPrimaryDark} text-white rounded-md text-sm`}
                        >
                          View
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEmailEscrow(e, prop); }}
                          className="flex-1 px-3 py-2 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-md text-sm"
                        >
                          Email Escrow
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </>
          )}

          {/* CUSTOMERS */}
          {/* Customers view uses THEME.cardDark for consistent panel styling */}
          {selectedTab === 'customers' && !loading && (
            <>
              {/* Desktop table (hidden on mobile) */}
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
                    {customers.map(c => (
                      <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                        <td className="p-4 font-medium">{c.name}</td>
                        <td className="p-4 text-slate-600 dark:text-slate-300">{c.email}</td>
                        <td className="p-4 text-slate-600 dark:text-slate-300">{c.phone}</td>
                        <td className="p-4 text-slate-600 dark:text-slate-300">{c.company}</td>
                        <td className="p-4 text-right">
                          <div className="inline-flex gap-2">
                            {/* Edit button uses THEME.btnPrimary */}
                            <button
                              onClick={() => openEditCustomer(c)}
                              className={`px-3 py-1 ${THEME.btnPrimary} ${THEME.btnPrimaryDark} text-white rounded-md text-sm`}
                            >
                              Edit
                            </button>
                            {/* Delete button with clear red visual */}
                            <button
                              onClick={() => handleDeleteCustomer(c.id)}
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

              {/* Mobile customer cards */}
              <div className="md:hidden space-y-4">
                {customers.map(c => (
                  <article key={c.id} className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm border border-slate-200 dark:border-[#0b2b20]">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{c.company}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-slate-500 dark:text-slate-400">{c.phone}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{c.email}</div>
                      </div>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <button onClick={() => openEditCustomer(c)} className={`flex-1 px-3 py-2 ${THEME.btnPrimary} ${THEME.btnPrimaryDark} text-white rounded-md text-sm`}>Edit</button>
                      <button onClick={() => handleDeleteCustomer(c.id)} className="flex-1 px-3 py-2 bg-red-500 text-white rounded-md text-sm">Delete</button>
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

          {/* Grid of stat cards; THEME.cardDark keeps consistent look with other panels */}
          {selectedTab === 'statistics' && !loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className={THEME.cardDark}>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold">AVG INCOME / MONTH</p>
                <p className="text-4xl font-bold mt-3">${fakeStats.avgIncomePerMonth.toLocaleString()}</p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Sample average monthly income (computed from properties)</p>
              </div>

              <div className={THEME.cardDark}>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold">AVG LISTING TIME</p>
                <p className="text-4xl font-bold mt-3">{fakeStats.avgListingDays} days</p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Average time a listing stays active (placeholder)</p>
              </div>

              <div className={THEME.cardDark}>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold">NOTES</p>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">These statistics are derived from properties in the DB. Add more fields to compute richer metrics.</p>
              </div>
            </div>
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

      {/* CUSTOMER EDITOR MODAL */}
      {showCustomerEditor && editingCustomer && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          onClick={closeEditCustomer}
        >
          <div className="absolute inset-0 bg-black/40" />
          <form
            onSubmit={handleSaveCustomer}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md shadow-lg z-10"
          >
            <h3 className="text-xl font-bold mb-4">Edit Customer</h3>

            <label className="block mb-2 text-sm">
              <span className="text-slate-600 dark:text-slate-300">Name</span>
              <input
                name="name"
                value={editingCustomer.name}
                onChange={handleCustomerChange}
                className={`mt-1 block w-full ${THEME.inputDark}`}
                required
              />
            </label>

            <label className="block mb-2 text-sm">
              <span className="text-slate-600 dark:text-slate-300">Email</span>
              <input
                name="email"
                value={editingCustomer.email}
                onChange={handleCustomerChange}
                className={`mt-1 block w-full ${THEME.inputDark}`}
              />
            </label>

            <label className="block mb-2 text-sm">
              <span className="text-slate-600 dark:text-slate-300">Phone</span>
              <input
                name="phone"
                value={editingCustomer.phone}
                onChange={handleCustomerChange}
                className={`mt-1 block w-full ${THEME.inputDark}`}
              />
            </label>

            <label className="block mb-4 text-sm">
              <span className="text-slate-600 dark:text-slate-300">Company</span>
              <input
                name="company"
                value={editingCustomer.company}
                onChange={handleCustomerChange}
                className={`mt-1 block w-full ${THEME.inputDark}`}
              />
            </label>

            <div className="flex justify-between items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (confirm("Delete this customer?")) {
                    handleDeleteCustomer(editingCustomer.id);
                    closeEditCustomer();
                  }
                }}
                className="px-4 py-2 rounded-md bg-red-500 text-white"
              >
                Delete
              </button>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeEditCustomer}
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
    </div>
  );
}