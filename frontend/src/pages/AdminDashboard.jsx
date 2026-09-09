import React, { useEffect, useState } from 'react';
import { api } from '../api';
import RestaurantSettings from '../components/RestaurantSettings';
import SalesDashboard from './SalesDashboard';
import BillingDashboard from './BillingDashboard';

export default function AdminDashboard({ restaurantId }) {
  const [menu, setMenu] = useState([]);
  const [tables, setTables] = useState([]);
  const [restaurant, setRestaurant] = useState(null);
  const [activeSection, setActiveSection] = useState('dashboard');

  const [editingItemId, setEditingItemId] = useState(null);

  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    image_url: '',
  });

  const [newMenuItem, setNewMenuItem] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    image_url: '',
  });

  const [newImageFile, setNewImageFile] = useState(null);
  const [newImagePreview, setNewImagePreview] = useState('');
  const [editImageFile, setEditImageFile] = useState(null);
  const [editImagePreview, setEditImagePreview] = useState('');

  const [tableNumber, setTableNumber] = useState('');

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, [restaurantId]);

  const loadData = async () => {
    try {
      const [restaurantData, menuData, tablesData] =
        await Promise.all([
          api.getRestaurant(restaurantId),
          api.getMenu(restaurantId),
          api.getTables(restaurantId),
        ]);

      setRestaurant(
        restaurantData?.error ? null : restaurantData
      );
      setMenu(menuData);
      setTables(tablesData);
    } catch (err) {
      console.error(err);
      setError('Failed to load admin data.');
    }
  };

  const readImageFile = (file, callback) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5 MB.');
      return;
    }

    const reader = new FileReader();

    reader.onload = () => callback(reader.result);
    reader.onerror = () => setError('Failed to read the image file.');
    reader.readAsDataURL(file);
  };

  const handleNewImageChange = (file) => {
    if (!file) return;

    setError('');
    setMessage('');
    setNewImageFile(file);

    readImageFile(file, (dataUrl) => {
      setNewImagePreview(dataUrl);
      setNewMenuItem((prev) => ({
        ...prev,
        image_url: dataUrl,
      }));
    });
  };

  const removeNewImage = () => {
    setNewImageFile(null);
    setNewImagePreview('');
    setNewMenuItem((prev) => ({
      ...prev,
      image_url: '',
    }));
  };

  const handleEditImageChange = (file) => {
    if (!file) return;

    setError('');
    setMessage('');
    setEditImageFile(file);

    readImageFile(file, (dataUrl) => {
      setEditImagePreview(dataUrl);
      setEditForm((prev) => ({
        ...prev,
        image_url: dataUrl,
      }));
    });
  };

  const removeEditImage = () => {
    setEditImageFile(null);
    setEditImagePreview('');
    setEditForm((prev) => ({
      ...prev,
      image_url: '',
    }));
  };

  const updateItemImage = async (item, file) => {
    if (!file) return;

    readImageFile(file, async (dataUrl) => {
      try {
        setError('');
        setMessage('');

        const updatedItem = await api.updateMenuItem(item.id, {
          name: item.name,
          description: item.description || '',
          price: Number(item.price),
          category: item.category,
          image_url: dataUrl,
        });

        if (updatedItem.error) {
          setError(updatedItem.error);
          return;
        }

        setMenu((prev) =>
          prev.map((menuItem) =>
            menuItem.id === item.id ? updatedItem : menuItem
          )
        );

        setMessage(`Image updated for ${item.name}.`);
      } catch (err) {
        console.error(err);
        setError('Failed to update food image.');
      }
    });
  };

  const deleteItemImage = async (item) => {
    const confirmed = window.confirm(
      `Remove the image from "${item.name}"?`
    );

    if (!confirmed) return;

    try {
      setError('');
      setMessage('');

      const updatedItem = await api.updateMenuItem(item.id, {
        name: item.name,
        description: item.description || '',
        price: Number(item.price),
        category: item.category,
        image_url: null,
      });

      if (updatedItem.error) {
        setError(updatedItem.error);
        return;
      }

      setMenu((prev) =>
        prev.map((menuItem) =>
          menuItem.id === item.id ? updatedItem : menuItem
        )
      );

      setMessage(`Image removed from ${item.name}.`);
    } catch (err) {
      console.error(err);
      setError('Failed to delete food image.');
    }
  };

  const startEditing = (item) => {
    setEditingItemId(item.id);

    setEditForm({
      name: item.name || '',
      description: item.description || '',
      price: item.price || '',
      category: item.category || '',
      image_url: item.image_url || '',
    });

    setEditImageFile(null);
    setEditImagePreview(item.image_url || '');

    setMessage('');
    setError('');
  };

  const cancelEditing = () => {
    setEditingItemId(null);

    setEditForm({
      name: '',
      description: '',
      price: '',
      category: '',
      image_url: '',
    });

    setEditImageFile(null);
    setEditImagePreview('');
  };

  const saveEdit = async (itemId) => {
    try {
      setError('');
      setMessage('');

      const updatedItem = await api.updateMenuItem(itemId, {
        name: editForm.name,
        description: editForm.description,
        price: Number(editForm.price),
        category: editForm.category,
        image_url: editForm.image_url || null,
      });

      if (updatedItem.error) {
        setError(updatedItem.error);
        return;
      }

      setMenu((prev) =>
        prev.map((item) =>
          item.id === itemId ? updatedItem : item
        )
      );

      setEditingItemId(null);
      setEditImageFile(null);
      setEditImagePreview('');
      setMessage('Menu item updated successfully.');
    } catch (err) {
      console.error(err);
      setError('Failed to update menu item.');
    }
  };

  const toggleAvailability = async (item) => {
    try {
      setError('');
      setMessage('');

      const updatedItem = await api.toggleItemAvailability(
        item.id,
        !item.is_available
      );

      if (updatedItem.error) {
        setError(updatedItem.error);
        return;
      }

      setMenu((prev) =>
        prev.map((menuItem) =>
          menuItem.id === item.id ? updatedItem : menuItem
        )
      );

      setMessage(
        `${item.name} is now ${
          updatedItem.is_available ? 'available' : 'unavailable'
        }.`
      );
    } catch (err) {
      console.error(err);
      setError('Failed to update availability.');
    }
  };

  const deleteMenuItem = async (item) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${item.name}"?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setError('');
      setMessage('');

      const result = await api.deleteMenuItem(item.id);

      if (result.error) {
        setError(result.error);
        return;
      }

      setMenu((prev) =>
        prev.filter((menuItem) => menuItem.id !== item.id)
      );

      setMessage('Menu item deleted successfully.');
    } catch (err) {
      console.error(err);
      setError('Failed to delete menu item.');
    }
  };

  const addMenuItem = async () => {
    if (!newMenuItem.name.trim()) {
      setError('Please enter a menu item name.');
      return;
    }

    if (!newMenuItem.price || Number(newMenuItem.price) <= 0) {
      setError('Please enter a valid price.');
      return;
    }

    if (!newMenuItem.category.trim()) {
      setError('Please enter a category.');
      return;
    }

    try {
      setError('');
      setMessage('');

      const item = await api.addMenuItem(restaurantId, {
        name: newMenuItem.name.trim(),
        description: newMenuItem.description.trim(),
        price: Number(newMenuItem.price),
        category: newMenuItem.category.trim(),
        image_url: newMenuItem.image_url.trim() || null,
      });

      if (item.error) {
        setError(item.error);
        return;
      }

      setMenu((prev) =>
        [...prev, item].sort((a, b) => {
          const categoryCompare = a.category.localeCompare(
            b.category
          );

          if (categoryCompare !== 0) {
            return categoryCompare;
          }

          return a.name.localeCompare(b.name);
        })
      );

      setNewMenuItem({
        name: '',
        description: '',
        price: '',
        category: '',
        image_url: '',
      });

      setNewImageFile(null);
      setNewImagePreview('');

      setMessage('Menu item added successfully.');
    } catch (err) {
      console.error(err);
      setError('Failed to add menu item.');
    }
  };

  const addTable = async () => {
    if (!tableNumber.trim()) {
      setError('Please enter a table number.');
      return;
    }

    try {
      setError('');
      setMessage('');

      const newTable = await api.addTable(
        restaurantId,
        Number(tableNumber)
      );

      if (newTable.error) {
        setError(newTable.error);
        return;
      }

      setTables((prev) =>
        [...prev, newTable].sort(
          (a, b) => a.table_number - b.table_number
        )
      );

      setTableNumber('');

      setMessage(
        `Table ${newTable.table_number} created successfully.`
      );
    } catch (err) {
      console.error(err);
      setError('Failed to create table.');
    }
  };

  const openTableMenu = (table) => {
    const url =
      `/r/${restaurantId}/t/${table.table_number}`;

    window.open(url, '_blank');
  };

  const downloadQR = (table) => {
    const link = document.createElement('a');

    link.href = table.qr_image;
    link.download = `table-${table.table_number}-qr.png`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="admin-app">

      <style>{`
        :root {
          --admin-bg: #f5f7f6;
          --admin-card: #ffffff;
          --admin-text: #17201d;
          --admin-muted: #707a76;
          --admin-border: #e4e9e6;
          --admin-brand: #0f5a4f;
          --admin-brand-soft: rgba(15, 90, 79, .09);
          --admin-danger: #c62828;
        }

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: var(--admin-bg);
        }

        .admin-app {
          min-height: 100vh;
          display: flex;
          color: var(--admin-text);
          background: var(--admin-bg);
          font-family:
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            Roboto,
            Arial,
            sans-serif;
        }

        .admin-sidebar {
          position: fixed;
          inset: 0 auto 0 0;
          width: 245px;
          display: flex;
          flex-direction: column;
          padding: 22px 15px;
          background: #102e29;
          color: white;
          z-index: 50;
        }

        .admin-brand {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 5px 10px 25px;
          border-bottom: 1px solid rgba(255,255,255,.10);
        }

        .admin-brand-mark {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,.10);
          font-size: 19px;
        }

        .admin-brand-name {
          font-weight: 850;
          font-size: 14px;
          line-height: 1.2;
        }

        .admin-brand-sub {
          margin-top: 3px;
          color: rgba(255,255,255,.55);
          font-size: 10px;
        }

        .admin-nav {
          display: flex;
          flex-direction: column;
          gap: 5px;
          margin-top: 24px;
        }

        .admin-nav-button {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 11px;
          border: 0;
          border-radius: 11px;
          padding: 11px 12px;
          background: transparent;
          color: rgba(255,255,255,.72);
          text-align: left;
          cursor: pointer;
          font-size: 12px;
          font-weight: 750;
          transition: .15s ease;
        }

        .admin-nav-button:hover {
          background: rgba(255,255,255,.07);
          color: white;
        }

        .admin-nav-button.active {
          background: white;
          color: #173c35;
          box-shadow: 0 5px 15px rgba(0,0,0,.13);
        }

        .admin-nav-icon {
          width: 23px;
          text-align: center;
          font-size: 16px;
        }

        .admin-sidebar-footer {
          margin-top: auto;
          padding: 15px 10px 3px;
          border-top: 1px solid rgba(255,255,255,.10);
        }

        .admin-sidebar-footer-label {
          color: rgba(255,255,255,.45);
          font-size: 9px;
          letter-spacing: 1.2px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .admin-sidebar-footer-name {
          margin-top: 5px;
          color: white;
          font-size: 12px;
          font-weight: 750;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .admin-main {
          width: calc(100% - 245px);
          margin-left: 245px;
          min-width: 0;
        }

        .admin-topbar {
          position: sticky;
          top: 0;
          z-index: 40;
          min-height: 70px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 0 32px;
          background: rgba(255,255,255,.92);
          border-bottom: 1px solid var(--admin-border);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        }

        .admin-top-title {
          font-size: 13px;
          font-weight: 850;
        }

        .admin-top-sub {
          margin-top: 3px;
          color: var(--admin-muted);
          font-size: 10px;
        }

        .admin-top-restaurant {
          display: flex;
          align-items: center;
          gap: 8px;
          max-width: 330px;
          padding: 8px 12px;
          border: 1px solid var(--admin-border);
          border-radius: 999px;
          background: white;
          font-size: 11px;
          font-weight: 750;
          overflow: hidden;
        }

        .admin-top-restaurant-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .admin-status-dot {
          width: 8px;
          height: 8px;
          flex: 0 0 auto;
          border-radius: 50%;
          background: #35a66f;
          box-shadow: 0 0 0 4px rgba(53,166,111,.10);
        }

        .admin-content {
          width: min(1180px, calc(100% - 56px));
          margin: 0 auto;
          padding: 34px 0 70px;
        }

        .admin-overview,
        .admin-page-section {
          width: 100%;
        }

        .admin-section-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 25px;
          margin-bottom: 25px;
        }

        .admin-eyebrow {
          color: var(--admin-brand);
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 1.7px;
          margin-bottom: 7px;
        }

        .admin-section-heading h2 {
          margin: 0;
          font-size: 28px;
          line-height: 1.1;
          letter-spacing: -.6px;
        }

        .admin-section-heading p {
          margin: 7px 0 0;
          color: var(--admin-muted);
          font-size: 12px;
          line-height: 1.5;
        }

        .admin-restaurant-chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          flex: 0 0 auto;
          padding: 9px 13px;
          border-radius: 999px;
          background: white;
          border: 1px solid var(--admin-border);
          font-size: 11px;
          font-weight: 750;
        }

        .admin-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 22px;
        }

        .admin-stat-card {
          min-height: 112px;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 18px;
          background: white;
          border: 1px solid var(--admin-border);
          border-radius: 16px;
          box-shadow: 0 5px 18px rgba(25,48,42,.045);
        }

        .admin-stat-icon {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 13px;
          background: var(--admin-brand-soft);
          color: var(--admin-brand);
          font-size: 18px;
          font-weight: 900;
        }

        .admin-stat-value {
          font-size: 25px;
          line-height: 1;
          font-weight: 900;
        }

        .admin-stat-label {
          margin-top: 5px;
          color: var(--admin-muted);
          font-size: 10px;
          font-weight: 700;
        }

        .admin-quick-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 22px;
        }

        .admin-quick-card {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          min-height: 88px;
          padding: 15px;
          border: 1px solid var(--admin-border);
          border-radius: 16px;
          background: white;
          color: var(--admin-text);
          text-align: left;
          cursor: pointer;
          box-shadow: 0 5px 18px rgba(25,48,42,.04);
          transition: .15s ease;
        }

        .admin-quick-card:hover {
          transform: translateY(-2px);
          border-color: rgba(15,90,79,.25);
          box-shadow: 0 10px 24px rgba(25,48,42,.08);
        }

        .admin-quick-icon {
          width: 39px;
          height: 39px;
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 11px;
          background: var(--admin-brand-soft);
          color: var(--admin-brand);
          font-size: 18px;
          font-weight: 900;
        }

        .admin-quick-card strong,
        .admin-quick-card small {
          display: block;
        }

        .admin-quick-card strong {
          font-size: 12px;
        }

        .admin-quick-card small {
          margin-top: 4px;
          color: var(--admin-muted);
          font-size: 10px;
          line-height: 1.35;
        }

        .admin-arrow {
          margin-left: auto;
          color: var(--admin-brand);
          font-weight: 900;
        }

        .admin-dashboard-panel {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 25px;
          padding: 22px;
          border-radius: 18px;
          background:
            linear-gradient(
              135deg,
              #103e36,
              #1b5148
            );
          color: white;
          box-shadow: 0 12px 28px rgba(16,62,54,.16);
        }

        .admin-panel-kicker {
          color: rgba(255,255,255,.58);
          font-size: 9px;
          letter-spacing: 1.5px;
          font-weight: 900;
        }

        .admin-dashboard-panel h3 {
          margin: 7px 0 0;
          font-size: 19px;
        }

        .admin-dashboard-panel p {
          margin: 6px 0 0;
          color: rgba(255,255,255,.70);
          font-size: 11px;
        }

        .admin-primary {
          flex: 0 0 auto;
          border: none;
          border-radius: 10px;
          min-height: 40px;
          padding: 0 16px;
          background: var(--admin-brand);
          color: white;
          cursor: pointer;
          font-size: 11px;
          font-weight: 850;
          box-shadow: 0 5px 12px rgba(15,90,79,.18);
        }

        .admin-dashboard-panel .admin-primary {
          background: white;
          color: #173c35;
        }

        /* Improve existing legacy sections without changing their logic. */

        .admin-page-section > section {
          margin-top: 0 !important;
        }

        .admin-page-section > section > h2 {
          display: none;
        }

        .admin-page-section input,
        .admin-page-section textarea {
          border: 1px solid #DCE2DF !important;
          border-radius: 9px !important;
          background: #FBFCFB;
          outline: none;
        }

        .admin-page-section input:focus,
        .admin-page-section textarea:focus {
          border-color: var(--admin-brand) !important;
          box-shadow: 0 0 0 3px var(--admin-brand-soft);
        }

        .admin-page-section button {
          border-radius: 9px;
          cursor: pointer;
        }

        @media (max-width: 1000px) {
          .admin-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .admin-quick-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .admin-sidebar {
            position: sticky;
            top: 0;
            width: 100%;
            height: auto;
            min-height: 0;
            padding: 10px 12px;
          }

          .admin-app {
            display: block;
          }

          .admin-brand {
            padding: 2px 5px 10px;
          }

          .admin-brand-sub,
          .admin-sidebar-footer {
            display: none;
          }

          .admin-nav {
            flex-direction: row;
            overflow-x: auto;
            margin-top: 9px;
            padding-bottom: 2px;
          }

          .admin-nav-button {
            width: auto;
            flex: 0 0 auto;
            padding: 9px 12px;
          }

          .admin-main {
            width: 100%;
            margin-left: 0;
          }

          .admin-topbar {
            padding: 0 14px;
            min-height: 58px;
          }

          .admin-content {
            width: calc(100% - 24px);
            padding-top: 22px;
          }

          .admin-section-heading {
            align-items: flex-start;
            flex-direction: column;
          }

          .admin-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .admin-dashboard-panel {
            align-items: flex-start;
            flex-direction: column;
          }
        }

        @media (max-width: 480px) {
          .admin-stats-grid {
            gap: 9px;
          }

          .admin-stat-card {
            min-height: 94px;
            padding: 12px;
            gap: 9px;
          }

          .admin-stat-icon {
            width: 36px;
            height: 36px;
            border-radius: 10px;
            font-size: 15px;
          }

          .admin-stat-value {
            font-size: 21px;
          }

          .admin-section-heading h2 {
            font-size: 24px;
          }

          .admin-top-restaurant {
            max-width: 150px;
          }
        }
      `}</style>

      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-brand-mark">🍽</div>
          <div>
            <div className="admin-brand-name">
              Restaurant Admin
            </div>
            <div className="admin-brand-sub">
              Management Console
            </div>
          </div>
        </div>

        <nav className="admin-nav">
          <button
            className={`admin-nav-button ${
              activeSection === 'dashboard' ? 'active' : ''
            }`}
            onClick={() => setActiveSection('dashboard')}
          >
            <span className="admin-nav-icon">▦</span>
            Dashboard
          </button>

          <button
            className={`admin-nav-button ${
              activeSection === 'menu' ? 'active' : ''
            }`}
            onClick={() => setActiveSection('menu')}
          >
            <span className="admin-nav-icon">🍴</span>
            Menu
          </button>

          <button
            className={`admin-nav-button ${
              activeSection === 'tables' ? 'active' : ''
            }`}
            onClick={() => setActiveSection('tables')}
          >
            <span className="admin-nav-icon">▦</span>
            Tables
          </button>

          <button
            className={`admin-nav-button ${
              activeSection === 'sales' ? 'active' : ''
            }`}
            onClick={() => setActiveSection('sales')}
          >
            <span className="admin-nav-icon">₹</span>
            Sales
          </button>

          <button
            className={`admin-nav-button ${
              activeSection === 'billing' ? 'active' : ''
            }`}
            onClick={() => setActiveSection('billing')}
          >
            <span className="admin-nav-icon">▤</span>
            Billing
          </button>

          <button
            className={`admin-nav-button ${
              activeSection === 'settings' ? 'active' : ''
            }`}
            onClick={() => setActiveSection('settings')}
          >
            <span className="admin-nav-icon">⚙</span>
            Settings
          </button>
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-sidebar-footer-label">
            Restaurant
          </div>
          <div className="admin-sidebar-footer-name">
            {restaurant?.name || 'Your Restaurant'}
          </div>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div>
            <div className="admin-top-title">
              {activeSection === 'dashboard'
                ? 'Dashboard Overview'
                : activeSection === 'menu'
                ? 'Menu Management'
                : activeSection === 'tables'
                ? 'Table Management'
                : activeSection === 'sales'
                ? 'Sales Analytics'
                : activeSection === 'billing'
                ? 'Billing & Orders'
                : 'Restaurant Settings'}
            </div>
            <div className="admin-top-sub">
              Restaurant management
            </div>
          </div>

          <div className="admin-top-restaurant">
            <span className="admin-status-dot" />
            <span className="admin-top-restaurant-name">
              {restaurant?.name || 'Your Restaurant'}
            </span>
          </div>
        </header>

        <main className="admin-content">
          {message && (
            <div
              style={{
                background: '#e8f5e9',
                color: '#2e7d32',
                padding: 12,
                borderRadius: 10,
                marginBottom: 18,
                border: '1px solid #cce8cf',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {message}
            </div>
          )}

          {error && (
            <div
              style={{
                background: '#ffebee',
                color: '#c62828',
                padding: 12,
                borderRadius: 10,
                marginBottom: 18,
                border: '1px solid #f2c7cc',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {error}
            </div>
          )}


        {activeSection === 'dashboard' && (
          <section className="admin-overview">
            <div className="admin-section-heading">
              <div>
                <div className="admin-eyebrow">OVERVIEW</div>
                <h2>Good day, Admin</h2>
                <p>
                  Manage your restaurant menu, tables and
                  customer experience from one place.
                </p>
              </div>

              <div className="admin-restaurant-chip">
                <span className="admin-status-dot" />
                {restaurant?.name || 'Your Restaurant'}
              </div>
            </div>

            <div className="admin-stats-grid">
              <div className="admin-stat-card">
                <div className="admin-stat-icon">🍴</div>
                <div>
                  <div className="admin-stat-value">
                    {menu.length}
                  </div>
                  <div className="admin-stat-label">
                    Menu Items
                  </div>
                </div>
              </div>

              <div className="admin-stat-card">
                <div className="admin-stat-icon">✓</div>
                <div>
                  <div className="admin-stat-value">
                    {menu.filter((item) => item.is_available).length}
                  </div>
                  <div className="admin-stat-label">
                    Available Items
                  </div>
                </div>
              </div>

              <div className="admin-stat-card">
                <div className="admin-stat-icon">▦</div>
                <div>
                  <div className="admin-stat-value">
                    {tables.length}
                  </div>
                  <div className="admin-stat-label">
                    Tables
                  </div>
                </div>
              </div>

              <div className="admin-stat-card">
                <div className="admin-stat-icon">◉</div>
                <div>
                  <div className="admin-stat-value">
                    {new Set(
                      menu.map((item) => item.category).filter(Boolean)
                    ).size}
                  </div>
                  <div className="admin-stat-label">
                    Categories
                  </div>
                </div>
              </div>
            </div>

            <div className="admin-quick-grid">
              <button
                className="admin-quick-card"
                onClick={() => setActiveSection('menu')}
              >
                <span className="admin-quick-icon">＋</span>
                <span>
                  <strong>Add Menu Item</strong>
                  <small>
                    Add a new dish, price and image
                  </small>
                </span>
                <span className="admin-arrow">→</span>
              </button>

              <button
                className="admin-quick-card"
                onClick={() => setActiveSection('tables')}
              >
                <span className="admin-quick-icon">▦</span>
                <span>
                  <strong>Manage Tables</strong>
                  <small>
                    Create tables and manage QR codes
                  </small>
                </span>
                <span className="admin-arrow">→</span>
              </button>

              <button
                className="admin-quick-card"
                onClick={() => setActiveSection('billing')}
              >
                <span className="admin-quick-icon">▤</span>
                <span>
                  <strong>Billing</strong>
                  <small>View orders and generate customer bills</small>
                </span>
                <span className="admin-arrow">→</span>
              </button>

              <button
                className="admin-quick-card"
                onClick={() => setActiveSection('settings')}
              >
                <span className="admin-quick-icon">⚙</span>
                <span>
                  <strong>Restaurant Settings</strong>
                  <small>
                    Update branding and restaurant details
                  </small>
                </span>
                <span className="admin-arrow">→</span>
              </button>

              <button
                className="admin-quick-card"
                onClick={() => setActiveSection('sales')}
              >
                <span className="admin-quick-icon">₹</span>
                <span>
                  <strong>View Sales</strong>
                  <small>
                    Track revenue, orders and top-selling items
                  </small>
                </span>
                <span className="admin-arrow">→</span>
              </button>
            </div>

            <div className="admin-dashboard-panel">
              <div>
                <div className="admin-panel-kicker">
                  MENU STATUS
                </div>
                <h3>
                  {menu.length === 0
                    ? 'Your menu is ready to be created'
                    : `${menu.length} items are currently in your menu`}
                </h3>
                <p>
                  Keep your menu up to date so customers always
                  see the latest dishes and availability.
                </p>
              </div>

              <button
                className="admin-primary"
                onClick={() => setActiveSection('menu')}
              >
                Manage Menu
              </button>
            </div>
          </section>
        )}

        {activeSection === 'billing' && (
          <section className="admin-page-section">
            <BillingDashboard restaurantId={restaurantId} />
          </section>
        )}

        {activeSection === 'settings' && (
          <section className="admin-page-section">
            <div className="admin-section-heading">
              <div>
                <div className="admin-eyebrow">SETTINGS</div>
                <h2>Restaurant Settings</h2>
                <p>
                  Customize how your restaurant appears to
                  customers.
                </p>
              </div>
            </div>

            <RestaurantSettings restaurantId={restaurantId} />
          </section>
        )}

        {activeSection === 'menu' && (
          <section className="admin-page-section">
            <div className="admin-section-heading">
              <div>
                <div className="admin-eyebrow">MANAGEMENT</div>
                <h2>Menu Management</h2>
                <p>
                  Add, edit and control the dishes shown to
                  customers.
                </p>
              </div>

              <button
                className="admin-primary"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              >
                + Add Menu Item
              </button>
            </div>

      <section>
        <h2>Menu Management</h2>

        {/* Add Menu Item */}
        <div
          style={{
            border: '1px solid #ddd',
            borderRadius: 8,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <h3>Add New Menu Item</h3>

          <div style={{ marginBottom: 10 }}>
            <label>Name</label>

            <input
              type="text"
              placeholder="e.g. Chicken Fried Rice"
              value={newMenuItem.name}
              onChange={(e) =>
                setNewMenuItem({
                  ...newMenuItem,
                  name: e.target.value,
                })
              }
              style={{
                display: 'block',
                width: '100%',
                padding: 8,
                marginTop: 4,
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: 10 }}>
            <label>Description</label>

            <textarea
              placeholder="Describe the menu item"
              value={newMenuItem.description}
              onChange={(e) =>
                setNewMenuItem({
                  ...newMenuItem,
                  description: e.target.value,
                })
              }
              style={{
                display: 'block',
                width: '100%',
                padding: 8,
                marginTop: 4,
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: 10 }}>
            <label>Price</label>

            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 180"
              value={newMenuItem.price}
              onChange={(e) =>
                setNewMenuItem({
                  ...newMenuItem,
                  price: e.target.value,
                })
              }
              style={{
                display: 'block',
                width: '100%',
                padding: 8,
                marginTop: 4,
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: 10 }}>
            <label>Category</label>

            <input
              type="text"
              placeholder="e.g. Main Course"
              value={newMenuItem.category}
              onChange={(e) =>
                setNewMenuItem({
                  ...newMenuItem,
                  category: e.target.value,
                })
              }
              style={{
                display: 'block',
                width: '100%',
                padding: 8,
                marginTop: 4,
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: 10 }}>
            <label>Food Image</label>

            <input
              type="text"
              placeholder="Image URL (https://...)"
              value={newImagePreview.startsWith('data:') ? '' : newMenuItem.image_url}
              onChange={(e) => {
                setNewImageFile(null);
                setNewImagePreview('');
                setNewMenuItem({
                  ...newMenuItem,
                  image_url: e.target.value,
                });
              }}
              style={{
                display: 'block',
                width: '100%',
                padding: 8,
                marginTop: 4,
                boxSizing: 'border-box',
              }}
            />

            <div
              style={{
                textAlign: 'center',
                margin: '10px 0',
                color: '#999',
                fontSize: 13,
              }}
            >
              OR
            </div>

            <input
              type="file"
              accept="image/*"
              onChange={(e) =>
                handleNewImageChange(e.target.files?.[0])
              }
              style={{
                display: 'block',
                width: '100%',
                marginTop: 4,
              }}
            />

            {newMenuItem.image_url && (
              <div style={{ marginTop: 12 }}>
                <img
                  src={newMenuItem.image_url}
                  alt="New food preview"
                  style={{
                    width: 180,
                    height: 120,
                    objectFit: 'cover',
                    borderRadius: 8,
                    border: '1px solid #ddd',
                  }}
                />

                <button
                  type="button"
                  onClick={removeNewImage}
                  style={{
                    display: 'block',
                    marginTop: 8,
                  }}
                >
                  Delete Image
                </button>
              </div>
            )}
          </div>

          <button onClick={addMenuItem}>
            Add Menu Item
          </button>
        </div>

        {menu.length === 0 && (
          <p>No menu items found.</p>
        )}

        {menu.map((item) => (
          <div
            key={item.id}
            style={{
              border: '1px solid #ddd',
              borderRadius: 8,
              padding: 16,
              marginBottom: 12,
            }}
          >
            {editingItemId === item.id ? (
              <>
                <h3>Edit Menu Item</h3>

                <div style={{ marginBottom: 10 }}>
                  <label>Name</label>

                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        name: e.target.value,
                      })
                    }
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: 8,
                      marginTop: 4,
                    }}
                  />
                </div>

                <div style={{ marginBottom: 10 }}>
                  <label>Description</label>

                  <textarea
                    value={editForm.description}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        description: e.target.value,
                      })
                    }
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: 8,
                      marginTop: 4,
                    }}
                  />
                </div>

                <div style={{ marginBottom: 10 }}>
                  <label>Price</label>

                  <input
                    type="number"
                    value={editForm.price}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        price: e.target.value,
                      })
                    }
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: 8,
                      marginTop: 4,
                    }}
                  />
                </div>

                <div style={{ marginBottom: 10 }}>
                  <label>Category</label>

                  <input
                    type="text"
                    value={editForm.category}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        category: e.target.value,
                      })
                    }
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: 8,
                      marginTop: 4,
                    }}
                  />
                </div>

                <div style={{ marginBottom: 10 }}>
                  <label>Food Image</label>

                  <input
                    type="text"
                    placeholder="Image URL (https://...)"
                    value={editImagePreview.startsWith('data:') ? '' : editForm.image_url}
                    onChange={(e) => {
                      setEditImageFile(null);
                      setEditImagePreview(e.target.value);
                      setEditForm({
                        ...editForm,
                        image_url: e.target.value,
                      });
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: 8,
                      marginTop: 4,
                      boxSizing: 'border-box',
                    }}
                  />

                  <div
                    style={{
                      textAlign: 'center',
                      margin: '10px 0',
                      color: '#999',
                      fontSize: 13,
                    }}
                  >
                    OR
                  </div>

                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      handleEditImageChange(e.target.files?.[0])
                    }
                    style={{
                      display: 'block',
                      width: '100%',
                    }}
                  />

                  {editForm.image_url && (
                    <div style={{ marginTop: 12 }}>
                      <img
                        src={editForm.image_url}
                        alt="Food preview"
                        style={{
                          width: 180,
                          height: 120,
                          objectFit: 'cover',
                          borderRadius: 8,
                          border: '1px solid #ddd',
                        }}
                      />

                      <button
                        type="button"
                        onClick={removeEditImage}
                        style={{
                          display: 'block',
                          marginTop: 8,
                        }}
                      >
                        Delete Image
                      </button>
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                  }}
                >
                  <button
                    onClick={() =>
                      saveEdit(item.id)
                    }
                  >
                    Save Changes
                  </button>

                  <button
                    onClick={cancelEditing}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <div
                  style={{
                    marginBottom: 14,
                    paddingBottom: 14,
                    borderBottom: '1px solid #eee',
                  }}
                >
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      style={{
                        width: 180,
                        height: 120,
                        objectFit: 'cover',
                        borderRadius: 8,
                        border: '1px solid #ddd',
                        display: 'block',
                        marginBottom: 10,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 180,
                        height: 120,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#f3f3f3',
                        borderRadius: 8,
                        border: '1px solid #ddd',
                        color: '#888',
                        marginBottom: 10,
                      }}
                    >
                      No image
                    </div>
                  )}

                  <label
                    style={{
                      display: 'inline-block',
                      padding: '8px 12px',
                      border: '1px solid #ddd',
                      borderRadius: 8,
                      cursor: 'pointer',
                      background: 'white',
                      fontWeight: 'bold',
                      fontSize: 13,
                    }}
                  >
                    {item.image_url ? 'Change Image' : 'Add Image'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        updateItemImage(item, e.target.files?.[0])
                      }
                      style={{ display: 'none' }}
                    />
                  </label>

                  {item.image_url && (
                    <button
                      type="button"
                      onClick={() => deleteItemImage(item)}
                      style={{
                        marginLeft: 8,
                        padding: '8px 12px',
                        border: '1px solid #ffcdd2',
                        borderRadius: 8,
                        background: '#fff5f5',
                        color: '#c62828',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: 13,
                      }}
                    >
                      Delete Image
                    </button>
                  )}
                </div>

                <h3 style={{ margin: '0 0 6px 0' }}>
                  {item.name}
                </h3>

                <div>₹{item.price}</div>

                <div>{item.category}</div>

                <div style={{ marginTop: 4 }}>
                  Status:{' '}
                  <strong>
                    {item.is_available
                      ? 'Available'
                      : 'Unavailable'}
                  </strong>
                </div>

                {item.description && (
                  <p style={{ color: '#666' }}>
                    {item.description}
                  </p>
                )}

                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    marginTop: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <button
                    onClick={() =>
                      startEditing(item)
                    }
                  >
                    Edit
                  </button>

                  <button
                    onClick={() =>
                      toggleAvailability(item)
                    }
                  >
                    {item.is_available
                      ? 'Mark Unavailable'
                      : 'Mark Available'}
                  </button>

                  <button
                    onClick={() =>
                      deleteMenuItem(item)
                    }
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </section>


          </section>
        )}

        {activeSection === 'sales' && (
          <SalesDashboard restaurantId={restaurantId} />
        )}

        {activeSection === 'tables' && (
          <section className="admin-page-section">
            <div className="admin-section-heading">
              <div>
                <div className="admin-eyebrow">MANAGEMENT</div>
                <h2>Table Management</h2>
                <p>
                  Create tables and manage customer QR access.
                </p>
              </div>
            </div>

      <section style={{ marginTop: 40 }}>
        <h2>Table Management</h2>

        <div
          style={{
            border: '1px solid #ddd',
            borderRadius: 8,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <h3>Add New Table</h3>

          <div
            style={{
              display: 'flex',
              gap: 8,
              maxWidth: 400,
            }}
          >
            <input
              type="number"
              min="1"
              placeholder="Table number"
              value={tableNumber}
              onChange={(e) =>
                setTableNumber(e.target.value)
              }
              style={{
                flex: 1,
                padding: 8,
              }}
            />

            <button onClick={addTable}>
              Add Table
            </button>
          </div>
        </div>

        {tables.length === 0 && (
          <p>No tables found.</p>
        )}

        {tables.map((table) => (
          <div
            key={table.id}
            style={{
              border: '1px solid #ddd',
              borderRadius: 8,
              padding: 16,
              marginBottom: 12,
              display: 'flex',
              gap: 20,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <div>
              {table.qr_image && (
                <img
                  src={table.qr_image}
                  alt={`QR code for Table ${table.table_number}`}
                  style={{
                    width: 180,
                    height: 180,
                    border: '1px solid #ddd',
                    padding: 8,
                    background: 'white',
                  }}
                />
              )}
            </div>

            <div style={{ flex: 1 }}>
              <h3 style={{ margin: '0 0 8px 0' }}>
                Table {table.table_number}
              </h3>

              <div>
                QR URL:
              </div>

              <div
                style={{
                  wordBreak: 'break-all',
                  color: '#555',
                  marginTop: 4,
                }}
              >
                {table.qr_code_url}
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  marginTop: 16,
                  flexWrap: 'wrap',
                }}
              >
                <button
                  onClick={() =>
                    openTableMenu(table)
                  }
                >
                  Open Menu
                </button>

                <button
                  onClick={() =>
                    downloadQR(table)
                  }
                >
                  Download QR
                </button>
              </div>
            </div>
          </div>
        ))}
      </section>

          </section>
        )}

        </main>
      </div>
    </div>
  );
}