"use client";
import React, { useState, useEffect } from 'react';
import { Home, DollarSign, Mail, Search, Moon, Sun, BarChart, Menu, X } from 'lucide-react';

export default function Dashboard() {
  // API base (change if needed)
  const API_BASE = "https://greentree-crm.onrender.com";

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
  const [loading, setLoading] = useState(true); // global loading indicator

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
    agent: ""
  });

  // Customer edit state
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [showCustomerEditor, setShowCustomerEditor] = useState(false);

  // Fake statistics (placeholder) — will derive from properties if desired
  const [fakeStats, setFakeStats] = useState({ avgIncomePerMonth: 0, avgListingDays: 0 });

  // Responsive: auto-close mobile sidebar when switching to desktop
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setShowSidebar(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // On mount: check session (/me). credentials: 'include' so httpOnly cookie is sent.
  useEffect(() => {
    let mounted = true;
    const checkMe = async () => {
      setLoadingMe(true);
      try {
        const res = await fetch(`${API_BASE}/me`, { credentials: 'include' });
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
    const fetchProperties = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/properties`);
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const data = await res.json();
        // normalize DB entries
        const normalized = data.map(p => ({
          id: p.id,
          address: p.address || "",
          status: p.status || "Active",
          price: typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0,
          agent: p.agent || ""
        }));
        setProperties(normalized);

        // derive customers from unique agent names
        const seen = new Map();
        normalized.forEach(p => {
          const name = (p.agent || "").trim();
          if (!name) return;
          const key = name.toLowerCase();
          if (!seen.has(key)) {
            seen.set(key, { id: seen.size + 1, name, email: "", phone: "", company: "" });
          }
        });
        setCustomers(Array.from(seen.values()));

        // derive simple stats for display
        const totalIncome = normalized.reduce((s, p) => s + (p.price || 0), 0);
        const avgIncome = normalized.length ? Math.round(totalIncome / normalized.length) : 0;
        const avgDays = 18; // placeholder
        setFakeStats({ avgIncomePerMonth: avgIncome, avgListingDays: avgDays });
      } catch (err) {
        console.error("Failed to load properties:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProperties();
  }, []);

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

  // Login handler (sends credentials and relies on httpOnly cookie set by server)
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: loginForm.name, password: loginForm.password })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        alert(err?.detail || "Login failed");
        return;
      }
      // refresh session user
      const me = await fetch(`${API_BASE}/me`, { credentials: 'include' });
      if (me.ok) {
        const data = await me.json();
        setCurrentUser(data);
      }
    } catch (err) {
      console.error("Login error", err);
      alert("Login error");
    }
  };

  // Register handler: creates user then auto-logins so cookie is set
  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      // create user
      const res = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: regForm.name, email: regForm.email, password: regForm.password })
      });
      if (!res.ok) {
        const err = await res.json().catch(()=>null);
        alert(err?.detail || "Register failed");
        return;
      }

      // auto-login to receive httpOnly cookie
      const loginRes = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: regForm.name, password: regForm.password })
      });
      if (!loginRes.ok) {
        alert("Created user but auto-login failed. Try logging in manually.");
        setShowRegister(false);
        return;
      }

      // fetch /me and set user state
      const me = await fetch(`${API_BASE}/me`, { credentials: 'include' });
      if (me.ok) {
        setCurrentUser(await me.json());
      }
      setShowRegister(false);
    } catch (err) {
      console.error("Register error", err);
      alert("Register error");
    }
  };

  // POST new property to API and update local state (include credentials so server can validate auth)
  const handleAddProperty = async (e) => {
    e.preventDefault();
    if (!form.address.trim()) return alert("Address is required");
    const payload = {
      address: form.address.trim(),
      status: form.status,
      price: parseFloat(form.price) || 0,
      agent: form.agent.trim()
    };

    try {
      const res = await fetch(`${API_BASE}/properties`, {
        method: "POST",
        credentials: "include", // ensure cookie is sent
        headers: { "Content-Type": "application/json" },
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
            <div className={THEME.headerSubtitle}>{selectedTab === 'dashboard' ? 'Dashboard' : selectedTab === 'customers' ? 'Customers' : 'Statistics'}</div>
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

            {/* Statistics link */}
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); setSelectedTab('statistics'); }}
              className={`flex items-center gap-3 ${selectedTab === 'statistics' ? THEME.tabSelected : THEME.tabDefault}`}
            >
              <BarChart size={20}/> Statistics
            </a>

            {/* Static "Watcher" link */}
            <a href="#" className={`flex items-center gap-3 ${THEME.tabDefault}`}><Search size={20}/> Watcher</a>
            
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
                onClick={(e) => { e.preventDefault(); setSelectedTab('statistics'); setShowSidebar(false); }}
                className={`flex items-center gap-3 ${selectedTab === 'statistics' ? THEME.tabMobileSelected : THEME.tabDefault}`}
              >
                <BarChart size={18}/> Statistics
              </a>

              <a href="#" className={`flex items-center gap-3 ${THEME.tabDefault}`}><Search size={18}/> Watcher</a>

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
                {selectedTab === 'dashboard' ? 'Main Dashboard' : selectedTab === 'customers' ? 'Customer Database' : 'Statistics'}
              </h2>
              <p className={THEME.pageSubtitle}>
                {selectedTab === 'dashboard'
                  ? 'Manage your real estate photography escrow.'
                  : selectedTab === 'customers'
                  ? 'Example customer records. Will be connected to MySQL later.'
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

          {/* STATISTICS */}
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