import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api';

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatDate(dateString) {
  if (!dateString) return '-';

  const date = new Date(dateString);

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function SalesDashboard({ restaurantId }) {
  const today = getLocalDateString();

  const [selectedDate, setSelectedDate] = useState(today);

  const [summary, setSummary] = useState({
    total_orders: 0,
    items_sold: 0,
    total_revenue: 0,
    average_order_value: 0,
  });

  const [salesItems, setSalesItems] = useState([]);
  const [topItems, setTopItems] = useState([]);
  const [dailySales, setDailySales] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ==================================================
  // DATE RANGE
  // ==================================================

  const dateRange = useMemo(() => {
    const end = new Date(`${selectedDate}T00:00:00`);

    const start = new Date(end);
    start.setDate(start.getDate() - 6);

    return {
      from: getLocalDateString(start),
      to: selectedDate,
    };
  }, [selectedDate]);

  // ==================================================
  // LOAD SALES DATA
  // ==================================================

  useEffect(() => {
    let cancelled = false;

    async function loadSales() {
      setLoading(true);
      setError('');

      try {
        const [
          summaryData,
          itemsData,
          topItemsData,
          dailyData,
        ] = await Promise.all([
          api.getSalesSummary(
            restaurantId,
            selectedDate
          ),

          api.getSalesItems(
            restaurantId,
            selectedDate
          ),

          api.getTopSellingItems(
            restaurantId,
            selectedDate,
            5
          ),

          api.getDailySales(
            restaurantId,
            dateRange.from,
            dateRange.to
          ),
        ]);

        if (cancelled) return;

        setSummary({
          total_orders: Number(
            summaryData?.total_orders || 0
          ),
          items_sold: Number(
            summaryData?.items_sold || 0
          ),
          total_revenue: Number(
            summaryData?.total_revenue || 0
          ),
          average_order_value: Number(
            summaryData?.average_order_value || 0
          ),
        });

        setSalesItems(
          Array.isArray(itemsData)
            ? itemsData
            : []
        );

        setTopItems(
          Array.isArray(topItemsData)
            ? topItemsData
            : []
        );

        setDailySales(
          Array.isArray(dailyData)
            ? dailyData
            : []
        );
      } catch (err) {
        console.error(
          'Error loading sales:',
          err
        );

        if (!cancelled) {
          setError(
            'Unable to load sales data. Please try again.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSales();

    return () => {
      cancelled = true;
    };
  }, [
    restaurantId,
    selectedDate,
    dateRange.from,
    dateRange.to,
  ]);

  // ==================================================
  // QUICK DATE BUTTONS
  // ==================================================

  function setToday() {
    setSelectedDate(today);
  }

  function setYesterday() {
    const date = new Date();
    date.setDate(date.getDate() - 1);

    setSelectedDate(
      getLocalDateString(date)
    );
  }

  // ==================================================
  // LOADING
  // ==================================================

  if (loading) {
    return (
      <div className="sales-page">
        <style>{styles}</style>

        <div className="sales-loading">
          <div className="loading-spinner" />

          <p>Loading sales...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sales-page">
      <style>{styles}</style>

      {/* ============================================
          HEADER
      ============================================ */}

      <div className="sales-header">
        <div>
          <div className="sales-eyebrow">
            ANALYTICS
          </div>

          <h1>Sales</h1>

          <p>
            Track your restaurant's completed
            orders, revenue, and best-selling
            items.
          </p>
        </div>

        <div className="date-control">
          <label htmlFor="sales-date">
            Sales date
          </label>

          <input
            id="sales-date"
            type="date"
            value={selectedDate}
            max={today}
            onChange={(event) =>
              setSelectedDate(
                event.target.value
              )
            }
          />
        </div>
      </div>

      {/* ============================================
          QUICK DATE FILTERS
      ============================================ */}

      <div className="date-filters">
        <button
          className={
            selectedDate === today
              ? 'date-filter active'
              : 'date-filter'
          }
          onClick={setToday}
        >
          Today
        </button>

        <button
          className={
            selectedDate ===
            getLocalDateString(
              new Date(
                new Date().setDate(
                  new Date().getDate() - 1
                )
              )
            )
              ? 'date-filter active'
              : 'date-filter'
          }
          onClick={setYesterday}
        >
          Yesterday
        </button>
      </div>

      {/* ============================================
          ERROR
      ============================================ */}

      {error && (
        <div className="error-banner">
          <span>!</span>

          <div>
            <strong>Something went wrong</strong>

            <p>{error}</p>
          </div>
        </div>
      )}

      {/* ============================================
          SUMMARY CARDS
      ============================================ */}

      <div className="summary-grid">
        <div className="summary-card">
          <div className="summary-icon revenue-icon">
            ₹
          </div>

          <div className="summary-content">
            <span>Total revenue</span>

            <strong>
              {formatCurrency(
                summary.total_revenue
              )}
            </strong>

            <small>
              Completed orders only
            </small>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon orders-icon">
            #
          </div>

          <div className="summary-content">
            <span>Completed orders</span>

            <strong>
              {summary.total_orders}
            </strong>

            <small>
              Orders completed
            </small>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon items-icon">
            ×
          </div>

          <div className="summary-content">
            <span>Items sold</span>

            <strong>
              {summary.items_sold}
            </strong>

            <small>
              Total quantity sold
            </small>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon average-icon">
            ↗
          </div>

          <div className="summary-content">
            <span>Average order</span>

            <strong>
              {formatCurrency(
                summary.average_order_value
              )}
            </strong>

            <small>
              Revenue per order
            </small>
          </div>
        </div>
      </div>

      {/* ============================================
          MAIN CONTENT
      ============================================ */}

      <div className="sales-columns">
        {/* ==========================================
            TOP SELLING ITEMS
        ========================================== */}

        <section className="sales-card">
          <div className="section-header">
            <div>
              <h2>Top-selling items</h2>

              <p>
                Most ordered items for{' '}
                {formatDate(selectedDate)}
              </p>
            </div>

            <div className="section-badge">
              Top 5
            </div>
          </div>

          {topItems.length === 0 ? (
            <EmptyState
              icon="◇"
              title="No item sales"
              message="There are no completed item sales for this date."
            />
          ) : (
            <div className="top-items-list">
              {topItems.map(
                (item, index) => (
                  <div
                    className="top-item"
                    key={item.menu_item_id}
                  >
                    <div className="rank">
                      {index + 1}
                    </div>

                    <div className="item-info">
                      <strong>
                        {item.name}
                      </strong>

                      <span>
                        {item.category ||
                          'Uncategorized'}
                      </span>
                    </div>

                    <div className="item-quantity">
                      <strong>
                        {item.quantity_sold}
                      </strong>

                      <span>sold</span>
                    </div>

                    <div className="item-revenue">
                      {formatCurrency(
                        item.revenue
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </section>

        {/* ==========================================
            DAILY SALES
        ========================================== */}

        <section className="sales-card">
          <div className="section-header">
            <div>
              <h2>Sales history</h2>

              <p>
                Daily performance over the last
                7 days
              </p>
            </div>

            <div className="section-badge">
              7 days
            </div>
          </div>

          {dailySales.length === 0 ? (
            <EmptyState
              icon="▱"
              title="No sales history"
              message="No completed sales were found in this period."
            />
          ) : (
            <div className="history-table-wrapper">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Orders</th>
                    <th>Items</th>
                    <th>Revenue</th>
                  </tr>
                </thead>

                <tbody>
                  {dailySales.map(
                    (day) => (
                      <tr
                        key={
                          day.sales_date
                        }
                      >
                        <td>
                          <strong>
                            {formatDate(
                              day.sales_date
                            )}
                          </strong>
                        </td>

                        <td>
                          {day.order_count}
                        </td>

                        <td>
                          {day.item_count}
                        </td>

                        <td className="revenue-cell">
                          {formatCurrency(
                            day.revenue
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* ============================================
          ITEM SALES
      ============================================ */}

      <section className="sales-card item-sales-card">
        <div className="section-header">
          <div>
            <h2>Item sales</h2>

            <p>
              Detailed item performance for{' '}
              {formatDate(selectedDate)}
            </p>
          </div>

          <div className="section-badge">
            {salesItems.length} items
          </div>
        </div>

        {salesItems.length === 0 ? (
          <EmptyState
            icon="◌"
            title="No completed sales"
            message="Once orders are completed, item-level sales will appear here."
          />
        ) : (
          <div className="history-table-wrapper">
            <table className="sales-table detailed-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Quantity sold</th>
                  <th>Revenue</th>
                </tr>
              </thead>

              <tbody>
                {salesItems.map(
                  (item, index) => (
                    <tr
                      key={
                        item.menu_item_id
                      }
                    >
                      <td className="number-cell">
                        {index + 1}
                      </td>

                      <td>
                        <strong>
                          {item.name}
                        </strong>
                      </td>

                      <td>
                        <span className="category-pill">
                          {item.category ||
                            'Uncategorized'}
                        </span>
                      </td>

                      <td>
                        <strong>
                          {item.quantity_sold}
                        </strong>
                      </td>

                      <td className="revenue-cell">
                        {formatCurrency(
                          item.revenue
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ============================================
          SALES INFORMATION
      ============================================ */}

      <div className="sales-note">
        <div className="note-icon">i</div>

        <div>
          <strong>
            Sales are based on completed orders
          </strong>

          <p>
            Active and cancelled orders are not
            included in revenue, order counts, or
            item sales.
          </p>
        </div>
      </div>
    </div>
  );
}

// ==================================================
// EMPTY STATE
// ==================================================

function EmptyState({
  icon,
  title,
  message,
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        {icon}
      </div>

      <strong>{title}</strong>

      <p>{message}</p>
    </div>
  );
}

// ==================================================
// STYLES
// ==================================================

const styles = `
  .sales-page {
    min-height: 100%;
    padding: 32px;
    background:
      radial-gradient(
        circle at top right,
        rgba(99, 102, 241, 0.05),
        transparent 30%
      ),
      #f7f8fa;
    color: #17191c;
  }

  .sales-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 18px;
  }

  .sales-eyebrow {
    margin-bottom: 7px;
    color: #6b7280;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.14em;
  }

  .sales-header h1 {
    margin: 0;
    font-size: 32px;
    line-height: 1.1;
    letter-spacing: -0.03em;
  }

  .sales-header p {
    margin: 9px 0 0;
    color: #69707d;
    font-size: 14px;
  }

  .date-control {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .date-control label {
    color: #6b7280;
    font-size: 11px;
    font-weight: 700;
  }

  .date-control input {
    min-width: 175px;
    padding: 11px 13px;
    border: 1px solid #dfe3e8;
    border-radius: 10px;
    background: white;
    color: #17191c;
    font: inherit;
    outline: none;
    cursor: pointer;
  }

  .date-control input:focus {
    border-color: #9ca3af;
    box-shadow:
      0 0 0 3px rgba(107, 114, 128, 0.1);
  }

  .date-filters {
    display: flex;
    gap: 7px;
    margin-bottom: 22px;
  }

  .date-filter {
    padding: 8px 14px;
    border: 1px solid #e1e4e8;
    border-radius: 8px;
    background: white;
    color: #626975;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: 0.18s ease;
  }

  .date-filter:hover {
    border-color: #bfc4ca;
    color: #17191c;
  }

  .date-filter.active {
    border-color: #17191c;
    background: #17191c;
    color: white;
  }

  .error-banner {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 20px;
    padding: 14px 16px;
    border: 1px solid #f1c8c8;
    border-radius: 12px;
    background: #fff6f6;
  }

  .error-banner > span {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #17191c;
    color: white;
    font-size: 12px;
    font-weight: 800;
  }

  .error-banner strong {
    font-size: 13px;
  }

  .error-banner p {
    margin: 3px 0 0;
    color: #737982;
    font-size: 12px;
  }

  .summary-grid {
    display: grid;
    grid-template-columns:
      repeat(4, minmax(0, 1fr));
    gap: 14px;
    margin-bottom: 18px;
  }

  .summary-card {
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 126px;
    padding: 20px;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.96);
    box-shadow:
      0 3px 12px rgba(20, 25, 35, 0.035);
  }

  .summary-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 42px;
    width: 42px;
    height: 42px;
    border: 1px solid #e4e6e9;
    border-radius: 11px;
    background: #f8f9fa;
    color: #202328;
    font-size: 17px;
    font-weight: 800;
  }

  .summary-content {
    min-width: 0;
  }

  .summary-content span {
    display: block;
    margin-bottom: 6px;
    color: #6f7680;
    font-size: 12px;
    font-weight: 600;
  }

  .summary-content strong {
    display: block;
    font-size: 24px;
    line-height: 1.15;
    letter-spacing: -0.025em;
  }

  .summary-content small {
    display: block;
    margin-top: 6px;
    color: #9aa0a8;
    font-size: 10px;
  }

  .sales-columns {
    display: grid;
    grid-template-columns:
      minmax(0, 1fr)
      minmax(0, 1fr);
    gap: 18px;
    margin-bottom: 18px;
  }

  .sales-card {
    overflow: hidden;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    background: white;
    box-shadow:
      0 3px 12px rgba(20, 25, 35, 0.035);
  }

  .section-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 15px;
    padding: 20px 20px 17px;
    border-bottom: 1px solid #eef0f2;
  }

  .section-header h2 {
    margin: 0;
    font-size: 16px;
    letter-spacing: -0.015em;
  }

  .section-header p {
    margin: 5px 0 0;
    color: #858b94;
    font-size: 11px;
  }

  .section-badge {
    flex-shrink: 0;
    padding: 6px 9px;
    border: 1px solid #e4e6e9;
    border-radius: 7px;
    background: #fafafa;
    color: #6d737b;
    font-size: 10px;
    font-weight: 800;
  }

  .top-items-list {
    padding: 4px 20px;
  }

  .top-item {
    display: grid;
    grid-template-columns:
      30px
      minmax(0, 1fr)
      60px
      82px;
    align-items: center;
    gap: 10px;
    min-height: 67px;
    border-bottom: 1px solid #f0f1f3;
  }

  .top-item:last-child {
    border-bottom: 0;
  }

  .rank {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 7px;
    background: #f2f3f5;
    color: #5d636b;
    font-size: 11px;
    font-weight: 800;
  }

  .item-info {
    min-width: 0;
  }

  .item-info strong {
    display: block;
    overflow: hidden;
    color: #202328;
    font-size: 12px;
    font-weight: 750;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .item-info span {
    display: block;
    margin-top: 4px;
    overflow: hidden;
    color: #979da5;
    font-size: 10px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .item-quantity {
    text-align: right;
  }

  .item-quantity strong {
    display: block;
    font-size: 13px;
  }

  .item-quantity span {
    display: block;
    margin-top: 2px;
    color: #969ca4;
    font-size: 9px;
  }

  .item-revenue {
    color: #22252a;
    font-size: 12px;
    font-weight: 750;
    text-align: right;
  }

  .history-table-wrapper {
    width: 100%;
    overflow-x: auto;
  }

  .sales-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }

  .sales-table th {
    padding: 12px 18px;
    border-bottom: 1px solid #eceef0;
    background: #fafbfb;
    color: #858b94;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.05em;
    text-align: left;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .sales-table td {
    padding: 14px 18px;
    border-bottom: 1px solid #f0f1f3;
    color: #565d66;
    white-space: nowrap;
  }

  .sales-table tbody tr:last-child td {
    border-bottom: 0;
  }

  .sales-table tbody tr:hover {
    background: #fafbfc;
  }

  .sales-table td strong {
    color: #202328;
    font-weight: 700;
  }

  .revenue-cell {
    color: #202328 !important;
    font-weight: 750;
  }

  .number-cell {
    width: 40px;
    color: #9aa0a8 !important;
  }

  .category-pill {
    display: inline-block;
    padding: 4px 8px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    background: #fafafa;
    color: #777e87;
    font-size: 9px;
    font-weight: 700;
  }

  .item-sales-card {
    margin-bottom: 18px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 190px;
    padding: 25px;
    text-align: center;
  }

  .empty-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    margin-bottom: 12px;
    border: 1px solid #e4e6e9;
    border-radius: 10px;
    background: #fafafa;
    color: #8b9199;
    font-size: 16px;
  }

  .empty-state strong {
    font-size: 13px;
  }

  .empty-state p {
    max-width: 290px;
    margin: 5px 0 0;
    color: #969ca4;
    font-size: 11px;
    line-height: 1.5;
  }

  .sales-note {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 14px 16px;
    border: 1px solid #e4e6e9;
    border-radius: 11px;
    background: #fbfbfc;
  }

  .note-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 21px;
    width: 21px;
    height: 21px;
    border: 1px solid #d9dce0;
    border-radius: 50%;
    color: #737981;
    font-size: 10px;
    font-weight: 800;
  }

  .sales-note strong {
    display: block;
    color: #555b64;
    font-size: 11px;
  }

  .sales-note p {
    margin: 3px 0 0;
    color: #9298a0;
    font-size: 10px;
    line-height: 1.5;
  }

  .sales-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    color: #747a83;
  }

  .sales-loading p {
    margin-top: 12px;
    font-size: 12px;
  }

  .loading-spinner {
    width: 25px;
    height: 25px;
    border: 2px solid #e4e6e9;
    border-top-color: #202328;
    border-radius: 50%;
    animation: sales-spin 0.8s linear infinite;
  }

  @keyframes sales-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 1100px) {
    .summary-grid {
      grid-template-columns:
        repeat(2, minmax(0, 1fr));
    }

    .sales-columns {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 700px) {
    .sales-page {
      padding: 20px 14px;
    }

    .sales-header {
      align-items: flex-start;
      flex-direction: column;
    }

    .date-control {
      width: 100%;
    }

    .date-control input {
      width: 100%;
    }

    .summary-grid {
      grid-template-columns: 1fr;
    }

    .summary-card {
      min-height: 105px;
    }

    .top-item {
      grid-template-columns:
        30px
        minmax(0, 1fr)
        50px;
    }

    .item-revenue {
      display: none;
    }

    .section-header {
      padding: 17px 14px;
    }

    .top-items-list {
      padding: 4px 14px;
    }

    .sales-table th,
    .sales-table td {
      padding-left: 12px;
      padding-right: 12px;
    }
  }
`;

export default SalesDashboard;