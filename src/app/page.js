"use client";
import React, { useState, useEffect } from 'react';
import { Home, DollarSign, Mail, Search, Moon, Sun, BarChart, Menu, X } from 'lucide-react';

export default function Dashboard() {
  const [darkMode, setDarkMode] = useState(false);
  const [expandedIds, setExpandedIds] = useState([]); // track expanded rows/cards
  const [properties, setProperties] = useState([
    { id: 1, address: "123 Maple Ave", status: "Active", price: 450, agent: "Sarah Smith" },
    { id: 2, address: "888 Ocean Blvd", status: "Sold", price: 600, agent: "John Doe" },
    { id: 3, address: "45 Pine St", status: "Pending", price: 350, agent: "Sarah Smith" },
  ]);

  const [customers, setCustomers] = useState([
    { id: 1, name: "Sarah Smith", email: "sarah@example.com", phone: "555-1234", company: "Sarah Photo" },
    { id: 2, name: "John Doe", email: "john@example.com", phone: "555-5678", company: "JD Real Estate" },
    { id: 3, name: "Acme Rentals", email: "contact@acmerentals.com", phone: "555-9012", company: "Acme Rentals" },
  ]);

  // UI state
  const [selectedTab, setSelectedTab] = useState('dashboard');
  const [showSidebar, setShowSidebar] = useState(false); // mobile sidebar

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

  // Fake statistics (placeholder)
  const fakeStats = {
    avgIncomePerMonth: 4200,
    avgListingDays: 18
  };

  // Responsive: auto-close mobile sidebar when switching to desktop
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setShowSidebar(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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

  const handleAddProperty = (e) => {
    e.preventDefault();
    if (!form.address.trim()) return alert("Address is required");
    const priceNum = parseFloat(form.price) || 0;
    const newId = properties.length ? Math.max(...properties.map(p => p.id)) + 1 : 1;
    const agentName = form.agent.trim() || "Unknown";
    const newProp = {
      id: newId,
      address: form.address.trim(),
      status: form.status,
      price: priceNum,
      agent: agentName
    };

    setProperties(prev => [newProp, ...prev]);

    if (form.agent.trim()) {
      const exists = customers.some(c => c.name.toLowerCase() === agentName.toLowerCase());
      if (!exists) {
        const newCustomerId = customers.length ? Math.max(...customers.map(c => c.id)) + 1 : 1;
        const newCustomer = {
          id: newCustomerId,
          name: agentName,
          email: "",
          phone: "",
          company: ""
        };
        setCustomers(prev => [newCustomer, ...prev]);
      }
    }

    setShowForm(false);
  };

  // Customer editing handlers
  const openEditCustomer = (customer) => {
    setEditingCustomer({ ...customer });
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
    if (!editingCustomer || !editingCustomer.name.trim()) return alert("Customer name is required");
    setCustomers(prev => prev.map(c => c.id === editingCustomer.id ? {
      ...c,
      name: editingCustomer.name.trim(),
      email: (editingCustomer.email || "").trim(),
      phone: (editingCustomer.phone || "").trim(),
      company: (editingCustomer.company || "").trim()
    } : c));
    closeEditCustomer();
  };

  const handleDeleteCustomer = (customerId) => {
    if (!confirm("Delete this customer?")) return;
    setCustomers(prev => prev.filter(c => c.id !== customerId));
  };

  return (
    <div className={`${darkMode ? 'dark' : ''}`}>
      <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-300">

        {/* MOBILE HEADER */}
        <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white dark:bg-slate-800 border-b dark:border-slate-700 p-3 flex items-center justify-between">
          <button
            onClick={() => setShowSidebar(true)}
            className="p-2 rounded-md text-slate-700 dark:text-slate-200"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div className="text-center">
            <div className="font-bold">Green Tree</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{selectedTab === 'dashboard' ? 'Dashboard' : selectedTab === 'customers' ? 'Customers' : 'Statistics'}</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleDarkMode} className="p-2 rounded-md text-slate-700 dark:text-slate-200">
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button onClick={openForm} className="bg-blue-600 text-white px-3 py-1 rounded-md text-sm">+ Add</button>
          </div>
        </header>

        {/* SIDEBAR - desktop */}
        <aside className="hidden md:block w-64 bg-white dark:bg-slate-800 border-r dark:border-slate-700 p-6 space-y-8">
          <h1 className="text-xl font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2">
            <Home size={24} /> Green Tree
          </h1>
          <nav className="space-y-4">
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); setSelectedTab('dashboard'); }}
              className={`flex items-center gap-3 ${selectedTab === 'dashboard'
                ? 'px-3 py-2 rounded-md bg-gradient-to-r from-blue-600 to-green-500 text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-blue-600'}`}

            >
              <Home size={20}/> Dashboard
            </a>

            <a
              href="#"
              onClick={(e) => { e.preventDefault(); setSelectedTab('customers'); }}
              className={`flex items-center gap-3 ${selectedTab === 'customers'
                ? 'px-3 py-2 rounded-md bg-gradient-to-r from-blue-600 to-green-500 text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-blue-600'}`}

            >
              <DollarSign size={20}/> Customers
            </a>

            <a
              href="#"
              onClick={(e) => { e.preventDefault(); setSelectedTab('statistics'); }}
              className={`flex items-center gap-3 ${selectedTab === 'statistics'
                ? 'px-3 py-2 rounded-md bg-gradient-to-r from-blue-600 to-green-500 text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-blue-600'}`}

            >
              <BarChart size={20}/> Statistics
            </a>

            <a href="#" className="flex items-center gap-3 text-slate-500 dark:text-slate-400 hover:text-blue-600"><Search size={20}/> Watcher</a>
            
            {/* DARK MODE TOGGLE BUTTON */}
            <button 
              onClick={toggleDarkMode}
              className="flex items-center gap-3 w-full text-slate-500 dark:text-slate-400 hover:text-blue-600 transition"
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              {darkMode ? 'Light Mode' : 'Dark Mode'}
            </button>
          </nav>
        </aside>

        {/* SIDEBAR - mobile off-canvas */}
        <div className={`fixed inset-y-0 left-0 z-50 w-64 transform md:hidden transition-transform ${showSidebar ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="h-full bg-white dark:bg-slate-800 border-r dark:border-slate-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2">
                <Home size={20} /> Green Tree
              </h2>
              <button onClick={() => setShowSidebar(false)} className="p-2 rounded-md text-slate-700 dark:text-slate-200"><X /></button>
            </div>

            <nav className="space-y-4">
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); setSelectedTab('dashboard'); setShowSidebar(false); }}
                className={`flex items-center gap-3 ${selectedTab === 'dashboard' ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-slate-500 dark:text-slate-400 hover:text-blue-600'}`}
              >
                <Home size={18}/> Dashboard
              </a>

              <a
                href="#"
                onClick={(e) => { e.preventDefault(); setSelectedTab('customers'); setShowSidebar(false); }}
                className={`flex items-center gap-3 ${selectedTab === 'customers' ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-slate-500 dark:text-slate-400 hover:text-blue-600'}`}
              >
                <DollarSign size={18}/> Customers
              </a>

              <a
                href="#"
                onClick={(e) => { e.preventDefault(); setSelectedTab('statistics'); setShowSidebar(false); }}
                className={`flex items-center gap-3 ${selectedTab === 'statistics' ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-slate-500 dark:text-slate-400 hover:text-blue-600'}`}
              >
                <BarChart size={18}/> Statistics
              </a>

              <a href="#" className="flex items-center gap-3 text-slate-500 dark:text-slate-400 hover:text-blue-600"><Search size={18}/> Watcher</a>

              <button
                onClick={() => { toggleDarkMode(); setShowSidebar(false); }}
                className="flex items-center gap-3 w-full text-slate-500 dark:text-slate-400 hover:text-blue-600 transition mt-4"
              >
                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                {darkMode ? 'Light Mode' : 'Dark Mode'}
              </button>
            </nav>
          </div>
          {/* overlay */}
          {showSidebar && <div onClick={() => setShowSidebar(false)} className="fixed inset-0 bg-black/30" />}
        </div>

        {/* MAIN CONTENT */}
        <main className="flex-1 p-4 md:p-10 pt-20 md:pt-10">
          {/* Desktop header kept above inside main on md+ */}
          <div className="hidden md:flex justify-between items-center mb-10">
            <div>
              <h2 className="text-3xl font-bold">
                {selectedTab === 'dashboard' ? 'Main Dashboard' : selectedTab === 'customers' ? 'Customer Database' : 'Statistics'}
              </h2>
              <p className="text-slate-500 dark:text-slate-400">
                {selectedTab === 'dashboard'
                  ? 'Manage your real estate photography escrow.'
                  : selectedTab === 'customers'
                  ? 'Example customer records. Will be connected to MySQL later.'
                  : 'Summary statistics (fake data for now).'}
              </p>
            </div>

            {selectedTab === 'dashboard' ? (
              <button
                onClick={openForm}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700"
              >
                + Add New Shoot
              </button>
            ) : null}
          </div>

          {/* DASHBOARD TABLE (desktop) */}
          {selectedTab === 'dashboard' && (
            <>
              <div className="hidden md:grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold text-green-600">READY TO BILL</p>
                  <p className="text-3xl font-bold mt-2">$600.00</p>
                </div>
              </div>

              <div className="hidden md:block bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 text-sm">
                    <tr>
                      <th className="p-4 text-left font-medium">Address</th>
                      <th className="p-4 text-left font-medium">Status</th>
                      <th className="p-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-slate-700">
                    {properties.map((prop) => (
                      <React.Fragment key={prop.id}>
                        <tr
                          onClick={() => toggleExpand(prop.id)}
                          className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition cursor-pointer"
                          aria-expanded={expandedIds.includes(prop.id)}
                        >
                          <td className="p-4 font-medium">{prop.address}</td>
                          <td className="p-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                              prop.status === 'Sold' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            }`}>
                              {prop.status}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            {prop.status === 'Sold' && (
                              <button
                                onClick={(e) => handleEmailEscrow(e, prop)}
                                className="bg-green-600 text-white px-4 py-1 rounded-md text-sm"
                              >
                                Email Escrow
                              </button>
                            )}
                          </td>
                        </tr>

                        {expandedIds.includes(prop.id) && (
                          <tr key={`${prop.id}-details`} className="bg-slate-50 dark:bg-slate-800">
                            <td colSpan="3" className="p-4 text-sm text-slate-700 dark:text-slate-300">
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
                                  <button
                                    onClick={(e) => { e.stopPropagation(); }}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm"
                                  >
                                    View
                                  </button>
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
                    className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm border border-slate-200 dark:border-slate-700"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">{prop.address}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{prop.agent}</div>
                      </div>
                      <div className="text-right">
                        <div className={`px-2 py-1 rounded-full text-xs font-bold ${prop.status === 'Sold' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>{prop.status}</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 mt-2">${prop.price.toFixed(2)}</div>
                      </div>
                    </div>

                    {expandedIds.includes(prop.id) && (
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); }}
                          className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md text-sm"
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
          {selectedTab === 'customers' && (
            <>
              {/* Desktop table */}
              <div className="hidden md:block bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 text-sm">
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
                            <button
                              onClick={() => openEditCustomer(c)}
                              className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm"
                            >
                              Edit
                            </button>
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

              {/* Mobile cards */}
              <div className="md:hidden space-y-4">
                {customers.map(c => (
                  <article key={c.id} className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm border border-slate-200 dark:border-slate-700">
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
                      <button onClick={() => openEditCustomer(c)} className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md text-sm">Edit</button>
                      <button onClick={() => handleDeleteCustomer(c.id)} className="flex-1 px-3 py-2 bg-red-500 text-white rounded-md text-sm">Delete</button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}

          {/* STATISTICS */}
          {selectedTab === 'statistics' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold">AVG INCOME / MONTH</p>
                <p className="text-4xl font-bold mt-3">${fakeStats.avgIncomePerMonth.toLocaleString()}</p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Sample average monthly income (fake data)</p>
              </div>

              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold">AVG LISTING TIME</p>
                <p className="text-4xl font-bold mt-3">{fakeStats.avgListingDays} days</p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Average time a listing stays active (fake data)</p>
              </div>

              <div className="md:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold">NOTES</p>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">These statistics are placeholders. We'll hook real analytics / DB queries later to populate accurate metrics.</p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* FORM MODAL (Add Shoot) */}
      {showForm && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          onClick={closeForm}
        >
          <div className="absolute inset-0 bg-black/40" />
          <form
            onSubmit={handleAddProperty}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md shadow-lg z-10"
          >
            <h3 className="text-xl font-bold mb-4">Add New Shoot</h3>

            <label className="block mb-2 text-sm">
              <span className="text-slate-600 dark:text-slate-300">Address</span>
              <input
                name="address"
                value={form.address}
                onChange={handleFormChange}
                className="mt-1 block w-full rounded-md border px-3 py-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                required
              />
            </label>

            <label className="block mb-2 text-sm">
              <span className="text-slate-600 dark:text-slate-300">Status</span>
              <select
                name="status"
                value={form.status}
                onChange={handleFormChange}
                className="mt-1 block w-full rounded-md border px-3 py-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
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
                className="mt-1 block w-full rounded-md border px-3 py-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
            </label>

            <label className="block mb-4 text-sm">
              <span className="text-slate-600 dark:text-slate-300">Agent</span>
              <input
                name="agent"
                value={form.agent}
                onChange={handleFormChange}
                className="mt-1 block w-full rounded-md border px-3 py-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
            </label>

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
                className="px-4 py-2 rounded-md bg-blue-600 text-white"
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
                className="mt-1 block w-full rounded-md border px-3 py-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                required
              />
            </label>

            <label className="block mb-2 text-sm">
              <span className="text-slate-600 dark:text-slate-300">Email</span>
              <input
                name="email"
                value={editingCustomer.email}
                onChange={handleCustomerChange}
                className="mt-1 block w-full rounded-md border px-3 py-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
            </label>

            <label className="block mb-2 text-sm">
              <span className="text-slate-600 dark:text-slate-300">Phone</span>
              <input
                name="phone"
                value={editingCustomer.phone}
                onChange={handleCustomerChange}
                className="mt-1 block w-full rounded-md border px-3 py-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
            </label>

            <label className="block mb-4 text-sm">
              <span className="text-slate-600 dark:text-slate-300">Company</span>
              <input
                name="company"
                value={editingCustomer.company}
                onChange={handleCustomerChange}
                className="mt-1 block w-full rounded-md border px-3 py-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
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
                  className="px-4 py-2 rounded-md bg-blue-600 text-white"
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