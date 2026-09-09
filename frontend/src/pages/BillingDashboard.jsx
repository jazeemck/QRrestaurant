import React, { useEffect, useState } from 'react';

const API_BASE =
  import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

function formatDate(value) {
  if (!value) return '—';

  return new Date(value).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function money(value) {
  return `₹${Number(value || 0).toFixed(2)}`;
}

function statusClass(status) {
  return String(status || '')
    .toLowerCase()
    .replace(/\s+/g, '-');
}

function paymentClass(status) {
  return String(status || 'unpaid')
    .toLowerCase()
    .replace(/\s+/g, '-');
}

export default function BillingDashboard({ restaurantId }) {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('all');
  const [selectedBill, setSelectedBill] = useState(null);
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [loading, setLoading] = useState(true);
  const [billLoading, setBillLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [error, setError] = useState('');

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch(
        `${API_BASE}/orders/restaurant/${restaurantId}/billing`
      );

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(
          data.error || 'Failed to load orders.'
        );
      }

      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError(
        err.message || 'Failed to load orders.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [restaurantId]);

  const openBill = async (orderId) => {
    try {
      setBillLoading(true);
      setError('');

      const response = await fetch(
        `${API_BASE}/orders/bill/${orderId}`
      );

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(
          data.error || 'Failed to load bill.'
        );
      }

      setSelectedBill(data);
    } catch (err) {
      console.error(err);
      setError(
        err.message || 'Failed to load bill.'
      );
    } finally {
      setBillLoading(false);
    }
  };

  const markPaymentComplete = async () => {
    if (!paymentOrder) return;

    try {
      setPaymentLoading(true);
      setError('');

      const response = await fetch(
        `${API_BASE}/orders/${paymentOrder.id}/payment`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            payment_method: paymentMethod,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(
          data.error || 'Failed to complete payment.'
        );
      }

      setOrders((prev) =>
        prev.map((order) =>
          Number(order.id) === Number(paymentOrder.id)
            ? {
                ...order,
                payment_status: 'paid',
                payment_method:
                  data.payment_method ||
                  paymentMethod,
                paid_at:
                  data.paid_at ||
                  new Date().toISOString(),
              }
            : order
        )
      );

      if (
        selectedBill &&
        Number(selectedBill.order.id) ===
          Number(paymentOrder.id)
      ) {
        setSelectedBill((prev) => ({
          ...prev,
          order: {
            ...prev.order,
            payment_status: 'paid',
            payment_method:
              data.payment_method ||
              paymentMethod,
            paid_at:
              data.paid_at ||
              new Date().toISOString(),
          },
        }));
      }

      setPaymentOrder(null);
    } catch (err) {
      console.error(err);
      setError(
        err.message || 'Failed to complete payment.'
      );
    } finally {
      setPaymentLoading(false);
    }
  };

  const printBill = () => {
    if (!selectedBill) return;

    const printWindow = window.open(
      '',
      '_blank',
      'width=480,height=800'
    );

    if (!printWindow) return;

    const {
      restaurant,
      order,
      totals,
    } = selectedBill;

    const rows = order.items
      .map(
        (item) => `
          <tr>
            <td>${item.name}</td>
            <td style="text-align:center">${item.quantity}</td>
            <td style="text-align:right">${money(
              item.unit_price
            )}</td>
            <td style="text-align:right">${money(
              item.item_total
            )}</td>
          </tr>
        `
      )
      .join('');

    const paymentText =
      order.payment_status === 'paid'
        ? `Paid${order.payment_method ? ` (${order.payment_method})` : ''}`
        : 'Unpaid';

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Bill #${order.order_number}</title>
          <style>
            *{box-sizing:border-box}
            body{
              font-family:Arial,sans-serif;
              margin:0;
              padding:24px;
              color:#17201d;
              font-size:12px
            }
            .receipt{
              max-width:420px;
              margin:auto
            }
            .center{text-align:center}
            .logo{
              max-width:90px;
              max-height:70px;
              object-fit:contain;
              margin-bottom:8px
            }
            h1{
              font-size:20px;
              margin:0 0 4px
            }
            .muted{color:#666}
            .meta{
              margin:18px 0;
              border-top:1px dashed #aaa;
              border-bottom:1px dashed #aaa;
              padding:10px 0;
              display:grid;
              grid-template-columns:1fr 1fr;
              gap:5px
            }
            table{
              width:100%;
              border-collapse:collapse;
              margin-top:12px
            }
            th,td{
              padding:7px 3px;
              border-bottom:1px solid #eee
            }
            th{
              text-align:left;
              font-size:10px;
              text-transform:uppercase
            }
            .totals{
              margin-top:14px;
              margin-left:auto;
              width:65%
            }
            .total-row{
              display:flex;
              justify-content:space-between;
              padding:4px 0
            }
            .grand{
              font-weight:800;
              font-size:16px;
              border-top:1px solid #222;
              margin-top:5px;
              padding-top:8px
            }
            .paid{
              margin-top:16px;
              text-align:center;
              font-weight:800
            }
            .thanks{
              text-align:center;
              margin-top:24px
            }
            @media print{
              body{padding:0}
              .receipt{max-width:none}
            }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="center">
              ${
                restaurant.logo_url
                  ? `<img class="logo" src="${restaurant.logo_url}" />`
                  : ''
              }
              <h1>${restaurant.name || 'Restaurant'}</h1>
              ${
                restaurant.address
                  ? `<div class="muted">${restaurant.address}</div>`
                  : ''
              }
              ${
                restaurant.phone
                  ? `<div class="muted">${restaurant.phone}</div>`
                  : ''
              }
            </div>

            <div class="meta">
              <div>
                <b>Bill #</b><br/>
                ${order.order_number}
              </div>
              <div>
                <b>Table</b><br/>
                ${order.table_number}
              </div>
              <div>
                <b>Date</b><br/>
                ${formatDate(order.created_at)}
              </div>
              <div>
                <b>Payment</b><br/>
                ${paymentText}
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>

            <div class="totals">
              <div class="total-row">
                <span>Subtotal</span>
                <b>${money(totals.subtotal)}</b>
              </div>
              <div class="total-row">
                <span>Tax</span>
                <b>${money(totals.tax)}</b>
              </div>
              <div class="total-row">
                <span>Discount</span>
                <b>- ${money(totals.discount)}</b>
              </div>
              <div class="total-row grand">
                <span>Grand Total</span>
                <b>${money(totals.grand_total)}</b>
              </div>
            </div>

            <div class="paid">${paymentText}</div>

            <div class="thanks">
              Thank you for dining with us!
            </div>
          </div>

          <script>
            window.onload = () => {
              window.print();
              window.onafterprint = () => window.close();
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  const filteredOrders = orders.filter(
    (order) =>
      filter === 'all' ||
      String(order.status).toLowerCase() === filter
  );

  return (
    <div className="billing-dashboard">
      <style>{`
        .billing-dashboard{width:100%}
        .billing-head{
          display:flex;
          align-items:flex-end;
          justify-content:space-between;
          gap:20px;
          margin-bottom:24px
        }
        .billing-head h2{
          margin:0;
          font-size:28px
        }
        .billing-head p{
          margin:7px 0 0;
          color:#707a76;
          font-size:12px
        }
        .billing-refresh{
          border:1px solid #dce2df;
          background:#fff;
          border-radius:9px;
          padding:10px 14px;
          font-weight:800;
          font-size:11px;
          cursor:pointer
        }
        .billing-filters{
          display:flex;
          gap:8px;
          flex-wrap:wrap;
          margin-bottom:16px
        }
        .billing-filter{
          border:1px solid #dce2df;
          background:#fff;
          border-radius:9px;
          padding:9px 13px;
          font-size:11px;
          font-weight:800;
          cursor:pointer
        }
        .billing-filter.active{
          background:#0f5a4f;
          color:#fff;
          border-color:#0f5a4f
        }
        .billing-list{
          display:grid;
          gap:10px
        }
        .billing-row{
          display:grid;
          grid-template-columns:70px 1fr 100px 95px 115px 100px 105px;
          align-items:center;
          gap:13px;
          background:#fff;
          border:1px solid #e4e9e6;
          border-radius:14px;
          padding:15px 16px;
          box-shadow:0 5px 18px rgba(25,48,42,.035)
        }
        .billing-id{font-weight:900}
        .billing-table{
          font-weight:800;
          font-size:12px
        }
        .billing-date{
          font-size:10px;
          color:#707a76
        }
        .billing-status,
        .billing-payment{
          display:inline-flex;
          width:max-content;
          padding:5px 8px;
          border-radius:999px;
          font-size:9px;
          font-weight:900;
          text-transform:capitalize
        }
        .billing-status{
          background:#f0f2f1;
        }
        .billing-status.completed{
          background:#e8f5e9;
          color:#2e7d32
        }
        .billing-status.cancelled{
          background:#ffebee;
          color:#c62828
        }
        .billing-status.pending,
        .billing-status.active{
          background:#fff7e6;
          color:#9a6500
        }
        .billing-payment.paid{
          background:#e8f5e9;
          color:#2e7d32
        }
        .billing-payment.unpaid{
          background:#fff4e5;
          color:#a15c00
        }
        .billing-total{
          font-weight:900;
          text-align:right
        }
        .billing-view,
        .billing-pay{
          border:0;
          border-radius:9px;
          padding:9px 10px;
          font-size:10px;
          font-weight:850;
          cursor:pointer;
          white-space:nowrap
        }
        .billing-view{
          background:#0f5a4f;
          color:#fff
        }
        .billing-pay{
          background:#173c35;
          color:#fff
        }
        .billing-pay:disabled,
        .billing-view:disabled{
          opacity:.55;
          cursor:not-allowed
        }
        .billing-paid-note{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          min-width:70px;
          box-sizing:border-box;
          border-radius:9px;
          padding:9px 10px;
          background:#e8f5e9;
          color:#2e7d32;
          font-size:10px;
          font-weight:850;
          white-space:nowrap;
          text-align:center
        }
        .billing-empty,
        .billing-loading{
          padding:35px;
          text-align:center;
          background:#fff;
          border:1px solid #e4e9e6;
          border-radius:14px;
          color:#707a76;
          font-size:12px
        }
        .billing-error{
          padding:12px;
          background:#ffebee;
          color:#c62828;
          border:1px solid #f2c7cc;
          border-radius:10px;
          margin-bottom:15px;
          font-size:12px;
          font-weight:700
        }

        .bill-overlay{
          position:fixed;
          inset:0;
          background:rgba(10,25,21,.48);
          z-index:100;
          display:flex;
          justify-content:center;
          align-items:flex-start;
          padding:35px 15px;
          overflow:auto
        }
        .bill-modal{
          width:min(520px,100%);
          background:#fff;
          border-radius:18px;
          box-shadow:0 25px 70px rgba(0,0,0,.25);
          overflow:hidden
        }
        .bill-modal-head{
          display:flex;
          justify-content:space-between;
          align-items:center;
          padding:16px 18px;
          border-bottom:1px solid #e4e9e6
        }
        .bill-modal-head strong{font-size:14px}
        .bill-close{
          border:0;
          background:#f2f4f3;
          width:32px;
          height:32px;
          border-radius:50%;
          cursor:pointer;
          font-size:18px
        }
        .bill-paper{padding:25px}
        .bill-brand{text-align:center}
        .bill-logo{
          max-width:90px;
          max-height:70px;
          object-fit:contain;
          margin-bottom:8px
        }
        .bill-brand h3{
          margin:0;
          font-size:21px
        }
        .bill-brand p{
          margin:4px 0;
          color:#707a76;
          font-size:10px
        }
        .bill-meta{
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:10px;
          margin:18px 0;
          padding:13px 0;
          border-top:1px dashed #bbb;
          border-bottom:1px dashed #bbb
        }
        .bill-meta-label{
          font-size:9px;
          color:#707a76;
          text-transform:uppercase;
          font-weight:800
        }
        .bill-meta-value{
          margin-top:3px;
          font-size:11px;
          font-weight:800
        }
        .bill-items{
          width:100%;
          border-collapse:collapse
        }
        .bill-items th,
        .bill-items td{
          padding:9px 3px;
          border-bottom:1px solid #edf0ee;
          font-size:11px;
          text-align:left
        }
        .bill-items th{
          font-size:9px;
          color:#707a76;
          text-transform:uppercase
        }
        .bill-items th:not(:first-child),
        .bill-items td:not(:first-child){
          text-align:right
        }
        .bill-totals{
          margin:15px 0 0 auto;
          width:60%
        }
        .bill-total-row{
          display:flex;
          justify-content:space-between;
          padding:5px 0;
          font-size:11px
        }
        .bill-grand{
          border-top:1px solid #17201d;
          margin-top:5px;
          padding-top:9px;
          font-size:15px;
          font-weight:900
        }
        .bill-payment-box{
          margin-top:16px;
          padding:12px;
          border-radius:11px;
          background:#f4f8f6;
          border:1px solid #dfe9e4;
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:10px
        }
        .bill-payment-label{
          color:#707a76;
          font-size:9px;
          font-weight:800;
          text-transform:uppercase
        }
        .bill-payment-value{
          margin-top:3px;
          font-size:12px;
          font-weight:900
        }
        .bill-paid{
          color:#2e7d32
        }
        .bill-unpaid{
          color:#a15c00
        }
        .bill-thanks{
          text-align:center;
          color:#707a76;
          font-size:10px;
          margin-top:22px
        }
        .bill-actions{
          display:flex;
          gap:9px;
          padding:15px 18px;
          border-top:1px solid #e4e9e6
        }
        .bill-action{
          flex:1;
          border:0;
          border-radius:9px;
          padding:11px;
          font-size:11px;
          font-weight:850;
          cursor:pointer
        }
        .bill-action.print{
          background:#0f5a4f;
          color:#fff
        }
        .bill-action.secondary{
          background:#f1f3f2;
          color:#17201d
        }

        .payment-overlay{
          position:fixed;
          inset:0;
          z-index:120;
          background:rgba(10,25,21,.52);
          display:flex;
          align-items:center;
          justify-content:center;
          padding:20px
        }
        .payment-modal{
          width:min(420px,100%);
          background:#fff;
          border-radius:18px;
          padding:22px;
          box-shadow:0 25px 70px rgba(0,0,0,.25)
        }
        .payment-title{
          margin:0;
          font-size:20px
        }
        .payment-subtitle{
          margin:6px 0 18px;
          color:#707a76;
          font-size:11px
        }
        .payment-amount{
          padding:15px;
          border-radius:12px;
          background:#f4f8f6;
          text-align:center;
          margin-bottom:18px
        }
        .payment-amount small{
          display:block;
          color:#707a76;
          font-size:9px;
          font-weight:800;
          text-transform:uppercase
        }
        .payment-amount strong{
          display:block;
          margin-top:4px;
          font-size:25px
        }
        .payment-methods{
          display:grid;
          grid-template-columns:repeat(3,1fr);
          gap:8px
        }
        .payment-method{
          border:1px solid #dce2df;
          background:#fff;
          border-radius:10px;
          padding:12px 7px;
          cursor:pointer;
          font-size:11px;
          font-weight:800
        }
        .payment-method.selected{
          border-color:#0f5a4f;
          background:#edf8f5;
          color:#0f5a4f
        }
        .payment-actions{
          display:flex;
          gap:8px;
          margin-top:18px
        }
        .payment-button{
          flex:1;
          border:0;
          border-radius:10px;
          padding:12px;
          cursor:pointer;
          font-size:11px;
          font-weight:850
        }
        .payment-button.cancel{
          background:#f1f3f2;
          color:#17201d
        }
        .payment-button.confirm{
          background:#0f5a4f;
          color:#fff
        }
        .payment-button:disabled{
          opacity:.55;
          cursor:not-allowed
        }

        @media(max-width:1100px){
          .billing-row{
            grid-template-columns:60px 1fr 90px 90px 100px 90px 95px
          }
        }
        @media(max-width:900px){
          .billing-row{
            grid-template-columns:70px 1fr 100px 100px;
          }
          .billing-row > :nth-child(4){
            display:none
          }
          .billing-total{text-align:left}
        }
        @media(max-width:600px){
          .billing-head{
            align-items:flex-start;
            flex-direction:column
          }
          .billing-head h2{font-size:24px}

          /* Compact mobile billing card: keep the amount and actions
             inside the white card instead of letting the action group
             overflow its right edge. */
          .billing-list{
            width:100%;
            min-width:0;
          }

          .billing-row{
            grid-template-columns:minmax(70px,1fr) auto;
            gap:8px;
            width:100%;
            min-width:0;
            box-sizing:border-box;
            padding:15px 12px;
          }

          .billing-row > :nth-child(1),
          .billing-row > :nth-child(2),
          .billing-row > :nth-child(3),
          .billing-row > :nth-child(4),
          .billing-row > :nth-child(5){
            display:none
          }

          .billing-row > :nth-child(6){
            grid-column:1;
            min-width:0;
            text-align:left
          }

          .billing-row > :nth-child(7){
            grid-column:2;
            min-width:0;
            display:flex !important;
            gap:6px;
            align-items:center;
            justify-content:flex-end;
          }

          .billing-view,
          .billing-pay,
          .billing-paid-note{
            width:auto;
            flex:0 0 auto
          }

          .billing-view,
          .billing-pay,
          .billing-paid-note{
            padding:9px 10px
          }

          .bill-paper{padding:18px}
          .bill-totals{width:75%}
        }
      `}</style>

      <div className="billing-head">
        <div>
          <div className="admin-eyebrow">
            ORDERS & BILLING
          </div>

          <h2>Billing</h2>

          <p>
            View orders, generate bills and record customer
            payments.
          </p>
        </div>

        <button
          className="billing-refresh"
          onClick={loadOrders}
        >
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div className="billing-error">
          {error}
        </div>
      )}

      <div className="billing-filters">
        {[
          'all',
          'completed',
          'active',
          'pending',
          'cancelled',
        ].map((item) => (
          <button
            key={item}
            className={`billing-filter ${
              filter === item ? 'active' : ''
            }`}
            onClick={() => setFilter(item)}
          >
            {item === 'all'
              ? 'All'
              : item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="billing-loading">
          Loading orders…
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="billing-empty">
          No orders found for this filter.
        </div>
      ) : (
        <div className="billing-list">
          <div
            className="billing-row"
            style={{
              background: 'transparent',
              boxShadow: 'none',
              border: 0,
              padding: '0 16px',
              fontSize: 9,
              color: '#707a76',
              fontWeight: 900,
            }}
          >
            <span>ORDER</span>
            <span>TABLE / DATE</span>
            <span>STATUS</span>
            <span>PAYMENT</span>
            <span></span>
            <span
              style={{
                textAlign: 'right',
              }}
            >
              TOTAL
            </span>
            <span></span>
          </div>

          {filteredOrders.map((order) => {
            const isCompleted =
              String(order.status).toLowerCase() ===
              'completed';

            const isPaid =
              String(
                order.payment_status || 'unpaid'
              ).toLowerCase() === 'paid';

            return (
              <div
                className="billing-row"
                key={order.id}
              >
                <div className="billing-id">
                  #{order.id}
                </div>

                <div>
                  <div className="billing-table">
                    Table {order.table_number ?? '—'}
                  </div>

                  <div className="billing-date">
                    {formatDate(order.created_at)}
                  </div>
                </div>

                <span
                  className={`billing-status ${statusClass(
                    order.status
                  )}`}
                >
                  {order.status}
                </span>

                <span
                  className={`billing-payment ${paymentClass(
                    order.payment_status
                  )}`}
                >
                  {isPaid
                    ? `Paid${
                        order.payment_method
                          ? ` • ${order.payment_method}`
                          : ''
                      }`
                    : 'Unpaid'}
                </span>

                <span />

                <div className="billing-total">
                  {money(order.total)}
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: 6,
                    alignItems: 'center',
                  }}
                >
                  <button
                    className="billing-view"
                    onClick={() =>
                      openBill(order.id)
                    }
                    disabled={billLoading}
                  >
                    View Bill
                  </button>

                  {isCompleted && !isPaid ? (
                    <button
                      className="billing-pay"
                      onClick={() =>
                        setPaymentOrder(order)
                      }
                    >
                      Mark Paid
                    </button>
                  ) : (
                    isPaid && (
                      <span className="billing-paid-note">
                        ✓ Paid
                      </span>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedBill && (
        <div
          className="bill-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedBill(null);
            }
          }}
        >
          <div className="bill-modal">
            <div className="bill-modal-head">
              <strong>
                Bill #
                {selectedBill.order.order_number}
              </strong>

              <button
                className="bill-close"
                onClick={() =>
                  setSelectedBill(null)
                }
              >
                ×
              </button>
            </div>

            <div className="bill-paper">
              <div className="bill-brand">
                {selectedBill.restaurant
                  .logo_url && (
                  <img
                    className="bill-logo"
                    src={
                      selectedBill.restaurant
                        .logo_url
                    }
                    alt="Restaurant logo"
                  />
                )}

                <h3>
                  {selectedBill.restaurant.name ||
                    'Restaurant'}
                </h3>

                {selectedBill.restaurant
                  .address && (
                  <p>
                    {
                      selectedBill.restaurant
                        .address
                    }
                  </p>
                )}

                {selectedBill.restaurant
                  .phone && (
                  <p>
                    {
                      selectedBill.restaurant
                        .phone
                    }
                  </p>
                )}
              </div>

              <div className="bill-meta">
                <div>
                  <div className="bill-meta-label">
                    Bill
                  </div>
                  <div className="bill-meta-value">
                    #
                    {
                      selectedBill.order
                        .order_number
                    }
                  </div>
                </div>

                <div>
                  <div className="bill-meta-label">
                    Table
                  </div>
                  <div className="bill-meta-value">
                    Table{' '}
                    {
                      selectedBill.order
                        .table_number
                    }
                  </div>
                </div>

                <div>
                  <div className="bill-meta-label">
                    Date
                  </div>
                  <div className="bill-meta-value">
                    {formatDate(
                      selectedBill.order
                        .created_at
                    )}
                  </div>
                </div>

                <div>
                  <div className="bill-meta-label">
                    Status
                  </div>
                  <div className="bill-meta-value">
                    {
                      selectedBill.order
                        .status
                    }
                  </div>
                </div>
              </div>

              <table className="bill-items">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Total</th>
                  </tr>
                </thead>

                <tbody>
                  {selectedBill.order.items.map(
                    (item) => (
                      <tr
                        key={
                          item.id ??
                          item.order_item_id
                        }
                      >
                        <td>{item.name}</td>
                        <td>{item.quantity}</td>
                        <td>
                          {money(item.unit_price)}
                        </td>
                        <td>
                          {money(item.item_total)}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>

              <div className="bill-totals">
                <div className="bill-total-row">
                  <span>Subtotal</span>
                  <b>
                    {money(
                      selectedBill.totals
                        .subtotal
                    )}
                  </b>
                </div>

                <div className="bill-total-row">
                  <span>Tax</span>
                  <b>
                    {money(
                      selectedBill.totals.tax
                    )}
                  </b>
                </div>

                <div className="bill-total-row">
                  <span>Discount</span>
                  <b>
                    -{' '}
                    {money(
                      selectedBill.totals
                        .discount
                    )}
                  </b>
                </div>

                <div className="bill-total-row bill-grand">
                  <span>Grand Total</span>
                  <b>
                    {money(
                      selectedBill.totals
                        .grand_total
                    )}
                  </b>
                </div>
              </div>

              <div className="bill-payment-box">
                <div>
                  <div className="bill-payment-label">
                    Payment Status
                  </div>

                  <div
                    className={`bill-payment-value ${
                      selectedBill.order
                        .payment_status ===
                      'paid'
                        ? 'bill-paid'
                        : 'bill-unpaid'
                    }`}
                  >
                    {selectedBill.order
                      .payment_status ===
                    'paid'
                      ? `Paid${
                          selectedBill.order
                            .payment_method
                            ? ` • ${selectedBill.order.payment_method}`
                            : ''
                        }`
                      : 'Unpaid'}
                  </div>
                </div>

                {selectedBill.order
                  .payment_status !== 'paid' &&
                  String(
                    selectedBill.order.status
                  ).toLowerCase() ===
                    'completed' && (
                    <button
                      className="billing-pay"
                      onClick={() => {
                        setPaymentOrder({
                          id: selectedBill.order
                            .id,
                          total:
                            selectedBill
                              .totals
                              .grand_total,
                        });
                      }}
                    >
                      Mark Paid
                    </button>
                  )}
              </div>

              <div className="bill-thanks">
                Thank you for dining with us!
              </div>
            </div>

            <div className="bill-actions">
              <button
                className="bill-action secondary"
                onClick={() =>
                  setSelectedBill(null)
                }
              >
                Close
              </button>

              <button
                className="bill-action print"
                onClick={printBill}
              >
                🖨 Print Bill
              </button>
            </div>
          </div>
        </div>
      )}

      {paymentOrder && (
        <div className="payment-overlay">
          <div className="payment-modal">
            <h3 className="payment-title">
              Complete Payment
            </h3>

            <p className="payment-subtitle">
              Confirm that the customer has paid
              this bill.
            </p>

            <div className="payment-amount">
              <small>Amount Received</small>
              <strong>
                {money(paymentOrder.total)}
              </strong>
            </div>

            <div className="payment-methods">
              {[
                ['cash', '💵 Cash'],
                ['upi', '📱 UPI'],
                ['card', '💳 Card'],
              ].map(
                ([value, label]) => (
                  <button
                    key={value}
                    className={`payment-method ${
                      paymentMethod === value
                        ? 'selected'
                        : ''
                    }`}
                    onClick={() =>
                      setPaymentMethod(value)
                    }
                  >
                    {label}
                  </button>
                )
              )}
            </div>

            <div className="payment-actions">
              <button
                className="payment-button cancel"
                onClick={() =>
                  setPaymentOrder(null)
                }
                disabled={paymentLoading}
              >
                Cancel
              </button>

              <button
                className="payment-button confirm"
                onClick={markPaymentComplete}
                disabled={paymentLoading}
              >
                {paymentLoading
                  ? 'Saving...'
                  : '✓ Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
