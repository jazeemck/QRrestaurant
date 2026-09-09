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