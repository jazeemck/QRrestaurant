import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const API_BASE =
  import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

function money(value) {
  const number = Number(value);
  return `₹${Number.isFinite(number) ? number.toFixed(2) : '0.00'}`;
}

function formatDate(value) {
  if (!value) return '—';

  return new Date(value).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function getAggregatedItems(bill) {
  const grouped = new Map();

  for (const order of bill?.orders || []) {
    for (const item of order.items || []) {
      const unitPrice = Number(item.unit_price ?? item.price ?? 0);
      const quantity = Number(item.quantity || 0);

      const safeUnitPrice = Number.isFinite(unitPrice) ? unitPrice : 0;
      const safeQuantity = Number.isFinite(quantity) ? quantity : 0;

      const key = `${item.menu_item_id}-${safeUnitPrice.toFixed(2)}`;

      const existing = grouped.get(key);

      if (existing) {
        existing.quantity += safeQuantity;
        existing.item_total =
          existing.quantity * existing.unit_price;
      } else {
        grouped.set(key, {
          menu_item_id: item.menu_item_id,
          name: item.name,
          quantity: safeQuantity,
          unit_price: safeUnitPrice,
          item_total: safeQuantity * safeUnitPrice,
        });
      }
    }
  }

  return Array.from(grouped.values());
}

export default function BillingDashboard({ restaurantId }) {
  const [bills, setBills] = useState([]);
  const [filter, setFilter] = useState('all');
  const [selectedBill, setSelectedBill] = useState(null);
  const [paymentBill, setPaymentBill] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [loading, setLoading] = useState(true);
  const [billLoading, setBillLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [error, setError] = useState('');

  const loadBills = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch(
        `${API_BASE}/bills/restaurant/${restaurantId}`
      );

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to load bills.');
      }

      setBills(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load bills.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBills();
  }, [restaurantId]);

  useEffect(() => {
    const socketUrl =
      import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      socket.emit('join_restaurant', restaurantId);
    });

    socket.on('bill_generated', (billEvent) => {
      loadBills();

      if (billEvent?.bill_id) {
        setError('');
      }
    });

    socket.on('bill_paid', (paymentEvent) => {
      setBills((prev) =>
        prev.map((bill) =>
          Number(bill.id) === Number(paymentEvent?.bill_id)
            ? {
                ...bill,
                payment_status: 'paid',
                payment_method: paymentEvent.payment_method,
                paid_at: paymentEvent.paid_at,
                status: 'paid',
              }
            : bill
        )
      );

      setSelectedBill((prev) =>
        prev &&
        Number(prev.bill_id) === Number(paymentEvent?.bill_id)
          ? {
              ...prev,
              payment_status: 'paid',
              payment_method: paymentEvent.payment_method,
              paid_at: paymentEvent.paid_at,
              status: 'paid',
            }
          : prev
      );
    });

    return () => socket.disconnect();
  }, [restaurantId]);

  const openBill = async (billId) => {
    try {
      setBillLoading(true);
      setError('');

      const response = await fetch(
        `${API_BASE}/bills/${billId}`
      );

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to load bill.');
      }

      setSelectedBill(data);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load bill.');
    } finally {
      setBillLoading(false);
    }
  };

  const markPaymentComplete = async () => {
    if (!paymentBill) return;

    try {
      setPaymentLoading(true);
      setError('');

      const response = await fetch(
        `${API_BASE}/bills/${paymentBill.id}/payment`,
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

      const paidAt =
        data.paid_at || new Date().toISOString();

      const paidMethod =
        data.payment_method || paymentMethod;

      setBills((prev) =>
        prev.map((bill) =>
          Number(bill.id) === Number(paymentBill.id)
            ? {
                ...bill,
                payment_status: 'paid',
                payment_method: paidMethod,
                paid_at: paidAt,
                status: 'paid',
              }
            : bill
        )
      );

      if (
        selectedBill &&
        Number(selectedBill.bill_id) === Number(paymentBill.id)
      ) {
        setSelectedBill((prev) => ({
          ...prev,
          payment_status: 'paid',
          payment_method: paidMethod,
          paid_at: paidAt,
          status: 'paid',
        }));
      }

      setPaymentBill(null);
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
      'width=520,height=850'
    );

    if (!printWindow) return;

    const { restaurant, totals } = selectedBill;

    const aggregatedItems =
      getAggregatedItems(selectedBill);

    const items = aggregatedItems
      .map(
        (item) => `
          <tr>
            <td>${item.name}</td>
            <td style="text-align:center">
              ${item.quantity}
            </td>
            <td style="text-align:right">
              ${money(item.unit_price)}
            </td>
            <td style="text-align:right">
              ${money(item.item_total)}
            </td>
          </tr>
        `
      )
      .join('');

    const paymentText =
      selectedBill.payment_status === 'paid'
        ? `Paid${
            selectedBill.payment_method
              ? ` (${selectedBill.payment_method.toUpperCase()})`
              : ''
          }`
        : 'Unpaid';

    printWindow.document.write(`
      <!doctype html>
      <html>
      <head>
        <title>
          Bill #${selectedBill.bill_number}
        </title>

        <style>
          * {
            box-sizing: border-box;
          }

          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 24px;
            color: #17201d;
            font-size: 12px;
          }

          .receipt {
            max-width: 430px;
            margin: auto;
          }

          .center {
            text-align: center;
          }

          .logo {
            max-width: 90px;
            max-height: 70px;
            object-fit: contain;
            margin-bottom: 8px;
          }

          h1 {
            font-size: 20px;
            margin: 0 0 4px;
          }

          .muted {
            color: #666;
          }

          .meta {
            margin: 18px 0;
            border-top: 1px dashed #aaa;
            border-bottom: 1px dashed #aaa;
            padding: 10px 0;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 7px;
          }

          th,
          td {
            padding: 7px 3px;
            border-bottom: 1px solid #eee;
            text-align: left;
          }

          th {
            font-size: 10px;
            text-transform: uppercase;
          }

          th:last-child,
          td:last-child {
            text-align: right;
          }

          .totals {
            margin-top: 14px;
            margin-left: auto;
            width: 66%;
          }

          .row {
            display: flex;
            justify-content: space-between;
            padding: 4px 0;
          }

          .grand {
            font-weight: 800;
            font-size: 16px;
            border-top: 1px solid #222;
            margin-top: 5px;
            padding-top: 8px;
          }

          .payment {
            margin-top: 16px;
            text-align: center;
            font-weight: 800;
          }

          .thanks {
            text-align: center;
            margin-top: 22px;
          }

          @media print {
            body {
              padding: 0;
            }
          }
        </style>
      </head>

      <body>
        <div class="receipt">

          <div class="center">
            ${
              restaurant?.logo_url
                ? `<img
                    class="logo"
                    src="${restaurant.logo_url}"
                  />`
                : ''
            }

            <h1>
              ${restaurant?.name || 'Restaurant'}
            </h1>

            ${
              restaurant?.address
                ? `<div class="muted">
                    ${restaurant.address}
                  </div>`
                : ''
            }

            ${
              restaurant?.phone
                ? `<div class="muted">
                    ${restaurant.phone}
                  </div>`
                : ''
            }
          </div>

          <div class="meta">
            <div>
              <b>Bill #</b>
              <br/>
              ${selectedBill.bill_number}
            </div>

            <div>
              <b>Table</b>
              <br/>
              ${selectedBill.table?.table_number}
            </div>

            <div>
              <b>Date</b>
              <br/>
              ${formatDate(selectedBill.created_at)}
            </div>

            <div>
              <b>Payment</b>
              <br/>
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

            <tbody>
              ${items}
            </tbody>
          </table>

          <div class="totals">
            <div class="row">
              <span>Subtotal</span>
              <b>${money(totals?.subtotal)}</b>
            </div>

            <div class="row">
              <span>Tax</span>
              <b>${money(totals?.tax)}</b>
            </div>

            <div class="row">
              <span>Discount</span>
              <b>- ${money(totals?.discount)}</b>
            </div>

            <div class="row grand">
              <span>Grand Total</span>
              <b>${money(totals?.grand_total)}</b>
            </div>
          </div>

          <div class="payment">
            ${paymentText}
          </div>

          <div class="thanks">
            Thank you for dining with us!
          </div>

        </div>

        <script>
          window.onload = () => {
            window.print();

            window.onafterprint = () => {
              window.close();
            };
          };
        </script>
      </body>
      </html>
    `);

    printWindow.document.close();
  };

  const filteredBills = bills.filter((bill) => {
    if (filter === 'unpaid') {
      return bill.payment_status !== 'paid';
    }

    if (filter === 'paid') {
      return bill.payment_status === 'paid';
    }

    return true;
  });

  return (
    <div className="billing-dashboard">
      <style>{`
        .billing-dashboard {
          width: 100%;
        }

        .billing-head {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 24px;
        }

        .billing-head h2 {
          margin: 0;
          font-size: 28px;
        }

        .billing-head p {
          margin: 7px 0 0;
          color: #707a76;
          font-size: 12px;
        }

        .billing-refresh {
          border: 1px solid #dce2df;
          background: #fff;
          border-radius: 9px;
          padding: 10px 14px;
          font-weight: 800;
          font-size: 11px;
          cursor: pointer;
        }

        .billing-filters {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }

        .billing-filter {
          border: 1px solid #dce2df;
          background: #fff;
          border-radius: 9px;
          padding: 9px 13px;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
        }

        .billing-filter.active {
          background: #0f5a4f;
          color: #fff;
          border-color: #0f5a4f;
        }

        .billing-list {
          display: grid;
          gap: 10px;
        }

        .billing-row {
          display: grid;
          grid-template-columns:
            85px
            85px
            1fr
            95px
            100px
            105px
            105px
            100px;
          align-items: center;
          gap: 12px;
          background: #fff;
          border: 1px solid #e4e9e6;
          border-radius: 14px;
          padding: 15px 16px;
          box-shadow:
            0 5px 18px rgba(25, 48, 42, 0.035);
        }

        .billing-id {
          font-weight: 900;
        }

        .billing-table {
          font-weight: 800;
          font-size: 12px;
        }

        .billing-date {
          font-size: 10px;
          color: #707a76;
        }

        .billing-count {
          font-size: 11px;
          color: #66716d;
        }

        .billing-payment {
          display: inline-flex;
          width: max-content;
          padding: 5px 8px;
          border-radius: 999px;
          font-size: 9px;
          font-weight: 900;
          text-transform: capitalize;
        }

        .billing-payment.paid {
          background: #e8f5e9;
          color: #2e7d32;
        }

        .billing-payment.unpaid {
          background: #fff4e5;
          color: #a15c00;
        }

        .billing-total {
          font-weight: 900;
          text-align: right;
        }

        .billing-view,
        .billing-pay {
          border: 0;
          border-radius: 9px;
          padding: 9px 10px;
          font-size: 10px;
          font-weight: 850;
          cursor: pointer;
          white-space: nowrap;
        }

        .billing-view {
          background: #0f5a4f;
          color: #fff;
        }

        .billing-pay {
          background: #173c35;
          color: #fff;
        }

        .billing-paid-note {
          display: inline-flex;
          justify-content: center;
          border-radius: 9px;
          padding: 9px 10px;
          background: #e8f5e9;
          color: #2e7d32;
          font-size: 10px;
          font-weight: 850;
        }

        .billing-empty,
        .billing-loading {
          padding: 35px;
          text-align: center;
          background: #fff;
          border: 1px solid #e4e9e6;
          border-radius: 14px;
          color: #707a76;
          font-size: 12px;
        }

        .billing-error {
          padding: 12px;
          background: #ffebee;
          color: #c62828;
          border: 1px solid #f2c7cc;
          border-radius: 10px;
          margin-bottom: 15px;
          font-size: 12px;
          font-weight: 700;
        }

        .bill-overlay {
          position: fixed;
          inset: 0;
          background: rgba(10, 25, 21, 0.48);
          z-index: 100;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding: 35px 15px;
          overflow: auto;
        }

        .bill-modal {
          width: min(620px, 100%);
          background: #fff;
          border-radius: 18px;
          box-shadow:
            0 25px 70px rgba(0, 0, 0, 0.25);
          overflow: hidden;
        }

        .bill-modal-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 18px;
          border-bottom: 1px solid #e4e9e6;
        }

        .bill-modal-head strong {
          font-size: 14px;
        }

        .bill-close {
          border: 0;
          background: #f2f4f3;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 18px;
        }

        .bill-paper {
          padding: 25px;
        }

        .bill-brand {
          text-align: center;
        }

        .bill-logo {
          max-width: 90px;
          max-height: 70px;
          object-fit: contain;
          margin-bottom: 8px;
        }

        .bill-brand h3 {
          margin: 0;
          font-size: 21px;
        }

        .bill-brand p {
          margin: 4px 0;
          color: #707a76;
          font-size: 10px;
        }

        .bill-meta {
          margin: 18px 0;
          border-top: 1px dashed #aaa;
          border-bottom: 1px dashed #aaa;
          padding: 10px 0;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
          font-size: 10px;
        }

        .bill-order-block {
          margin-top: 16px;
        }

        .bill-paper table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10px;
        }

        .bill-paper th,
        .bill-paper td {
          padding: 7px 3px;
          border-bottom: 1px solid #eee;
          text-align: left;
        }

        .bill-paper th:last-child,
        .bill-paper td:last-child {
          text-align: right;
        }

        .bill-totals {
          margin: 14px 0 0 auto;
          width: 65%;
        }

        .bill-total-row {
          display: flex;
          justify-content: space-between;
          padding: 4px 0;
        }

        .bill-total-row.grand {
          font-weight: 900;
          font-size: 16px;
          border-top: 1px solid #222;
          margin-top: 4px;
          padding-top: 8px;
        }

        .bill-payment {
          text-align: center;
          font-weight: 900;
          margin-top: 14px;
        }

        .bill-modal-foot {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          padding: 14px 18px;
          border-top: 1px solid #e4e9e6;
        }

        .bill-action {
          border: 0;
          border-radius: 9px;
          padding: 9px 13px;
          font-size: 10px;
          font-weight: 850;
          cursor: pointer;
        }

        .bill-action.light {
          background: #eef1ef;
          color: #26332f;
        }

        .bill-action.primary {
          background: #0f5a4f;
          color: #fff;
        }

        .bill-action:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .payment-overlay {
          position: fixed;
          inset: 0;
          background: rgba(10, 25, 21, 0.48);
          z-index: 120;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 15px;
        }

        .payment-modal {
          width: min(390px, 100%);
          background: #fff;
          border-radius: 16px;
          padding: 20px;
          box-shadow:
            0 25px 70px rgba(0, 0, 0, 0.25);
        }

        .payment-modal h3 {
          margin: 0 0 6px;
          font-size: 16px;
        }

        .payment-modal p {
          margin: 0 0 16px;
          color: #68736f;
          font-size: 11px;
        }

        .payment-method-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        .payment-method {
          border: 1px solid #dfe5e2;
          background: #fff;
          border-radius: 9px;
          padding: 10px;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
        }

        .payment-method.active {
          background: #173c35;
          color: #fff;
          border-color: #173c35;
        }

        .payment-foot {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 18px;
        }

        @media (max-width: 950px) {
          .billing-row {
            grid-template-columns:
              70px
              70px
              1fr
              90px
              90px
              95px;
          }

          .billing-row > *:nth-child(6) {
            display: none;
          }

          .billing-row > *:nth-child(7) {
            display: none;
          }
        }

        @media (max-width: 650px) {
          .billing-head {
            align-items: flex-start;
            flex-direction: column;
          }

          .billing-row {
            grid-template-columns: 1fr 1fr;
            gap: 9px;
          }

          .billing-row > * {
            text-align: left !important;
          }

          .billing-row .billing-total {
            grid-column: 2;
            text-align: right !important;
          }

          .bill-meta {
            grid-template-columns: 1fr;
          }

          .bill-modal-foot {
            flex-wrap: wrap;
          }

          .payment-method-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="billing-head">
        <div>
          <h2>Billing & Orders</h2>
          <p>
            Generated bills from completed table service.
          </p>
        </div>

        <button
          className="billing-refresh"
          onClick={loadBills}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="billing-error">
          {error}
        </div>
      )}

      <div className="billing-filters">
        {['all', 'unpaid', 'paid'].map((value) => (
          <button
            key={value}
            className={`billing-filter ${
              filter === value ? 'active' : ''
            }`}
            onClick={() => setFilter(value)}
          >
            {value === 'all'
              ? 'All Bills'
              : value === 'unpaid'
              ? 'Unpaid'
              : 'Paid'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="billing-loading">
          Loading bills…
        </div>
      ) : filteredBills.length === 0 ? (
        <div className="billing-empty">
          No generated bills found.
        </div>
      ) : (
        <div className="billing-list">
          {filteredBills.map((bill) => (
            <div className="billing-row" key={bill.id}>
              <div className="billing-id">
                Bill #{bill.bill_number || bill.id}
              </div>

              <div className="billing-table">
                Table {bill.table_number}
              </div>

              <div>
                <div className="billing-date">
                  {formatDate(bill.created_at)}
                </div>

                <div className="billing-count">
                  {bill.order_count || 0} order(s)
                </div>
              </div>

              <div className="billing-payment">
                {bill.status}
              </div>

              <div
                className={`billing-payment ${
                  bill.payment_status === 'paid'
                    ? 'paid'
                    : 'unpaid'
                }`}
              >
                {bill.payment_status || 'unpaid'}
              </div>

              <div className="billing-date">
                {bill.payment_method
                  ? bill.payment_method.toUpperCase()
                  : '—'}
              </div>

              <div className="billing-total">
                {money(bill.total)}
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 7,
                  flexWrap: 'wrap',
                  justifyContent: 'flex-end',
                }}
              >
                <button
                  className="billing-view"
                  onClick={() => openBill(bill.id)}
                >
                  View Bill
                </button>

                {bill.payment_status !== 'paid' ? (
                  <button
                    className="billing-pay"
                    onClick={() => setPaymentBill(bill)}
                  >
                    Mark Paid
                  </button>
                ) : (
                  <span className="billing-paid-note">
                    Paid
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedBill && (
        <div
          className="bill-overlay"
          onMouseDown={(e) =>
            e.target === e.currentTarget &&
            !billLoading &&
            setSelectedBill(null)
          }
        >
          <div className="bill-modal">
            <div className="bill-modal-head">
              <strong>
                Bill #{selectedBill.bill_number} · Table{' '}
                {selectedBill.table?.table_number}
              </strong>

              <button
                className="bill-close"
                onClick={() => setSelectedBill(null)}
              >
                ×
              </button>
            </div>

            <div className="bill-paper">
              <div className="bill-brand">
                {selectedBill.restaurant?.logo_url && (
                  <img
                    className="bill-logo"
                    src={selectedBill.restaurant.logo_url}
                    alt=""
                  />
                )}

                <h3>
                  {selectedBill.restaurant?.name ||
                    'Restaurant'}
                </h3>

                {selectedBill.restaurant?.address && (
                  <p>
                    {selectedBill.restaurant.address}
                  </p>
                )}

                {selectedBill.restaurant?.phone && (
                  <p>
                    {selectedBill.restaurant.phone}
                  </p>
                )}
              </div>

              <div className="bill-meta">
                <div>
                  <b>Bill #</b>
                  <br />
                  {selectedBill.bill_number}
                </div>

                <div>
                  <b>Table</b>
                  <br />
                  {selectedBill.table?.table_number}
                </div>

                <div>
                  <b>Generated</b>
                  <br />
                  {formatDate(selectedBill.created_at)}
                </div>

                <div>
                  <b>Payment</b>
                  <br />
                  {selectedBill.payment_status}
                  {selectedBill.payment_method
                    ? ` · ${selectedBill.payment_method.toUpperCase()}`
                    : ''}
                </div>
              </div>

              <div className="bill-order-block">
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Qty</th>
                      <th>Price</th>
                      <th>Total</th>
                    </tr>
                  </thead>

                  <tbody>
                    {getAggregatedItems(selectedBill).map(
                      (item) => (
                        <tr
                          key={`${item.menu_item_id}-${item.unit_price}`}
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
              </div>

              <div className="bill-totals">
                <div className="bill-total-row">
                  <span>Subtotal</span>
                  <b>
                    {money(
                      selectedBill.totals?.subtotal
                    )}
                  </b>
                </div>

                <div className="bill-total-row">
                  <span>Tax</span>
                  <b>
                    {money(selectedBill.totals?.tax)}
                  </b>
                </div>

                <div className="bill-total-row">
                  <span>Discount</span>
                  <b>
                    -{' '}
                    {money(
                      selectedBill.totals?.discount
                    )}
                  </b>
                </div>

                <div className="bill-total-row grand">
                  <span>Grand Total</span>
                  <b>
                    {money(
                      selectedBill.totals?.grand_total
                    )}
                  </b>
                </div>
              </div>

              <div className="bill-payment">
                {selectedBill.payment_status === 'paid'
                  ? `PAID${
                      selectedBill.payment_method
                        ? ` · ${selectedBill.payment_method.toUpperCase()}`
                        : ''
                    }`
                  : 'UNPAID'}
              </div>
            </div>

            <div className="bill-modal-foot">
              <button
                className="bill-action light"
                onClick={() => setSelectedBill(null)}
              >
                Close
              </button>

              <button
                className="bill-action primary"
                onClick={printBill}
              >
                Print Bill
              </button>
            </div>
          </div>
        </div>
      )}

      {paymentBill && (
        <div
          className="payment-overlay"
          onMouseDown={(e) =>
            e.target === e.currentTarget &&
            !paymentLoading &&
            setPaymentBill(null)
          }
        >
          <div className="payment-modal">
            <h3>
              Complete Payment · Bill #
              {paymentBill.bill_number}
            </h3>

            <p>
              Table {paymentBill.table_number} · Total{' '}
              {money(paymentBill.total)}
            </p>

            <div className="payment-method-grid">
              {['cash', 'upi', 'card'].map((method) => (
                <button
                  key={method}
                  className={`payment-method ${
                    paymentMethod === method
                      ? 'active'
                      : ''
                  }`}
                  onClick={() =>
                    setPaymentMethod(method)
                  }
                >
                  {method.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="payment-foot">
              <button
                className="bill-action light"
                disabled={paymentLoading}
                onClick={() => setPaymentBill(null)}
              >
                Cancel
              </button>

              <button
                className="bill-action primary"
                disabled={paymentLoading}
                onClick={markPaymentComplete}
              >
                {paymentLoading
                  ? 'Saving…'
                  : 'Confirm Paid'}
              </button>
            </div>
          </div>
        </div>
      )}

      {billLoading && !selectedBill && <div />}
    </div>
  );
}