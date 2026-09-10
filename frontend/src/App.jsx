import React from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  useParams,
} from 'react-router-dom';

import CustomerMenu from './pages/CustomerMenu';
import KitchenDashboard from './pages/KitchenDashboard';
import AdminDashboard from './pages/AdminDashboard';

function HomePage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        boxSizing: 'border-box',
        fontFamily: 'Arial, sans-serif',
        background: '#f8f9fa',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '600px',
          textAlign: 'center',
          background: '#ffffff',
          padding: '40px 28px',
          borderRadius: '16px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.08)',
          boxSizing: 'border-box',
        }}
      >
        <h1
          style={{
            margin: '0 0 12px',
            fontSize: '32px',
          }}
        >
          QR Restaurant
        </h1>

        <p
          style={{
            margin: '0',
            color: '#666',
            lineHeight: '1.6',
          }}
        >
          Digital restaurant ordering and management system.
        </p>
      </div>
    </div>
  );
}

function CustomerMenuRoute() {
  const { restaurantId, tableId } = useParams();

  return (
    <CustomerMenu
      restaurantId={restaurantId}
      tableId={tableId}
    />
  );
}

function KitchenDashboardRoute() {
  const { restaurantId } = useParams();

  return (
    <KitchenDashboard
      restaurantId={restaurantId}
    />
  );
}

function AdminDashboardRoute() {
  const { restaurantId } = useParams();

  return (
    <AdminDashboard
      restaurantId={restaurantId}
    />
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<HomePage />}
        />

        <Route
          path="/r/:restaurantId/t/:tableId"
          element={<CustomerMenuRoute />}
        />

        <Route
          path="/kitchen/:restaurantId"
          element={<KitchenDashboardRoute />}
        />

        <Route
          path="/admin/:restaurantId"
          element={<AdminDashboardRoute />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;