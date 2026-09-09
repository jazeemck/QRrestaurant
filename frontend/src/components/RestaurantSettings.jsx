import React, { useEffect, useState } from 'react';
import { api } from '../api';

export default function RestaurantSettings({ restaurantId }) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    logo_url: '',
    cover_image_url: '',
    phone: '',
    address: '',
    primary_color: '#222222',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadRestaurant();
  }, [restaurantId]);

  const loadRestaurant = async () => {
    try {
      setLoading(true);
      setError('');

      const result = await api.getRestaurant(restaurantId);

      if (result.error) {
        setError(result.error);
        return;
      }

      setForm({
        name: result.name || '',
        description: result.description || '',
        logo_url: result.logo_url || '',
        cover_image_url: result.cover_image_url || '',
        phone: result.phone || '',
        address: result.address || '',
        primary_color: result.primary_color || '#222222',
      });
    } catch (err) {
      console.error(err);
      setError('Failed to load restaurant settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));

    setSuccess('');
    setError('');
  };

  // --------------------------------------------------
  // IMAGE UPLOAD
  // --------------------------------------------------

  const handleImageUpload = (field, file) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file.');
      return;
    }

    // Keep the file size reasonable.
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5 MB.');
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      setForm((prev) => ({
        ...prev,
        [field]: reader.result,
      }));

      setSuccess('');
      setError('');
    };

    reader.onerror = () => {
      setError('Failed to read the image file.');
    };

    reader.readAsDataURL(file);
  };

  // --------------------------------------------------
  // SAVE
  // --------------------------------------------------

  const handleSave = async (e) => {
    e.preventDefault();

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      if (!form.name.trim()) {
        setError('Restaurant name is required.');
        return;
      }

      const result = await api.updateRestaurant(
        restaurantId,
        {
          name: form.name.trim(),
          description: form.description.trim(),
          logo_url: form.logo_url || null,
          cover_image_url:
            form.cover_image_url || null,
          phone: form.phone.trim(),
          address: form.address.trim(),
          primary_color:
            form.primary_color || '#222222',
        }
      );

      if (result.error) {
        setError(result.error);
        return;
      }

      setForm({
        name: result.name || '',
        description: result.description || '',
        logo_url: result.logo_url || '',
        cover_image_url:
          result.cover_image_url || '',
        phone: result.phone || '',
        address: result.address || '',
        primary_color:
          result.primary_color || '#222222',
      });

      setSuccess(
        'Restaurant settings saved successfully.'
      );
    } catch (err) {
      console.error(err);
      setError(
        'Failed to save restaurant settings.'
      );
    } finally {
      setSaving(false);
    }
  };

  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------

  if (loading) {
    return (
      <section
        style={{
          background: 'white',
          border: '1px solid #ddd',
          borderRadius: 14,
          padding: 24,
          marginBottom: 30,
        }}
      >
        <p>Loading restaurant settings...</p>
      </section>
    );
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <section
      style={{
        background: 'white',
        border: '1px solid #ddd',
        borderRadius: 14,
        padding: 24,
        marginBottom: 30,
      }}
    >
      <div
        style={{
          marginBottom: 22,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 24,
          }}
        >
          Restaurant Settings
        </h2>

        <p
          style={{
            marginTop: 6,
            marginBottom: 0,
            color: '#666',
            fontSize: 14,
          }}
        >
          Customize how your restaurant appears
          to customers.
        </p>
      </div>

      {success && (
        <div
          style={{
            background: '#e8f5e9',
            color: '#2e7d32',
            padding: 12,
            borderRadius: 10,
            marginBottom: 18,
            border: '1px solid #c8e6c9',
          }}
        >
          {success}
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
            border: '1px solid #ffcdd2',
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSave}>

        {/* ------------------------------------------ */}
        {/* RESTAURANT NAME */}
        {/* ------------------------------------------ */}

        <div style={{ marginBottom: 18 }}>
          <label
            style={{
              display: 'block',
              fontWeight: 'bold',
              marginBottom: 6,
            }}
          >
            Restaurant Name
          </label>

          <input
            type="text"
            value={form.name}
            onChange={(e) =>
              handleChange(
                'name',
                e.target.value
              )
            }
            placeholder="e.g. Calicut Parivar"
            style={{
              width: '100%',
              padding: 12,
              border: '1px solid #ddd',
              borderRadius: 8,
              boxSizing: 'border-box',
              fontSize: 15,
            }}
          />
        </div>

        {/* ------------------------------------------ */}
        {/* DESCRIPTION */}
        {/* ------------------------------------------ */}

        <div style={{ marginBottom: 18 }}>
          <label
            style={{
              display: 'block',
              fontWeight: 'bold',
              marginBottom: 6,
            }}
          >
            Description
          </label>

          <textarea
            value={form.description}
            onChange={(e) =>
              handleChange(
                'description',
                e.target.value
              )
            }
            placeholder="A short description of your restaurant"
            rows={4}
            style={{
              width: '100%',
              padding: 12,
              border: '1px solid #ddd',
              borderRadius: 8,
              boxSizing: 'border-box',
              fontSize: 15,
              resize: 'vertical',
            }}
          />
        </div>

        {/* ------------------------------------------ */}
        {/* LOGO */}
        {/* ------------------------------------------ */}

        <div
          style={{
            marginBottom: 24,
            padding: 16,
            border: '1px solid #eee',
            borderRadius: 12,
            background: '#fafafa',
          }}
        >
          <h3
            style={{
              marginTop: 0,
              marginBottom: 14,
            }}
          >
            Restaurant Logo
          </h3>

          <label
            style={{
              display: 'block',
              fontWeight: 'bold',
              marginBottom: 6,
            }}
          >
            Image URL
          </label>

          <input
            type="text"
            value={
              form.logo_url.startsWith('data:')
                ? ''
                : form.logo_url
            }
            onChange={(e) =>
              handleChange(
                'logo_url',
                e.target.value
              )
            }
            placeholder="https://example.com/logo.jpg"
            style={{
              width: '100%',
              padding: 12,
              border: '1px solid #ddd',
              borderRadius: 8,
              boxSizing: 'border-box',
              fontSize: 15,
            }}
          />

          <div
            style={{
              textAlign: 'center',
              margin: '12px 0',
              color: '#999',
              fontSize: 13,
            }}
          >
            OR
          </div>

          <label
            style={{
              display: 'block',
              fontWeight: 'bold',
              marginBottom: 6,
            }}
          >
            Choose Image
          </label>

          <input
            type="file"
            accept="image/*"
            onChange={(e) =>
              handleImageUpload(
                'logo_url',
                e.target.files?.[0]
              )
            }
            style={{
              width: '100%',
              boxSizing: 'border-box',
            }}
          />

          {form.logo_url && (
            <div
              style={{
                marginTop: 16,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  color: '#666',
                  marginBottom: 8,
                }}
              >
                Logo Preview
              </div>

              <img
                src={form.logo_url}
                alt="Restaurant logo preview"
                onError={(e) => {
                  e.currentTarget.style.display =
                    'none';
                }}
                style={{
                  width: 140,
                  height: 140,
                  objectFit: 'contain',
                  borderRadius: 12,
                  background: 'white',
                  border: '1px solid #ddd',
                  padding: 8,
                }}
              />
            </div>
          )}
        </div>

        {/* ------------------------------------------ */}
        {/* COVER IMAGE */}
        {/* ------------------------------------------ */}

        <div
          style={{
            marginBottom: 24,
            padding: 16,
            border: '1px solid #eee',
            borderRadius: 12,
            background: '#fafafa',
          }}
        >
          <h3
            style={{
              marginTop: 0,
              marginBottom: 14,
            }}
          >
            Cover Image
          </h3>

          <label
            style={{
              display: 'block',
              fontWeight: 'bold',
              marginBottom: 6,
            }}
          >
            Image URL
          </label>

          <input
            type="text"
            value={
              form.cover_image_url.startsWith('data:')
                ? ''
                : form.cover_image_url
            }
            onChange={(e) =>
              handleChange(
                'cover_image_url',
                e.target.value
              )
            }
            placeholder="https://example.com/cover.jpg"
            style={{
              width: '100%',
              padding: 12,
              border: '1px solid #ddd',
              borderRadius: 8,
              boxSizing: 'border-box',
              fontSize: 15,
            }}
          />

          <div
            style={{
              textAlign: 'center',
              margin: '12px 0',
              color: '#999',
              fontSize: 13,
            }}
          >
            OR
          </div>

          <label
            style={{
              display: 'block',
              fontWeight: 'bold',
              marginBottom: 6,
            }}
          >
            Choose Image
          </label>

          <input
            type="file"
            accept="image/*"
            onChange={(e) =>
              handleImageUpload(
                'cover_image_url',
                e.target.files?.[0]
              )
            }
            style={{
              width: '100%',
              boxSizing: 'border-box',
            }}
          />

          {form.cover_image_url && (
            <div
              style={{
                marginTop: 16,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  color: '#666',
                  marginBottom: 8,
                }}
              >
                Cover Preview
              </div>

              <img
                src={form.cover_image_url}
                alt="Restaurant cover preview"
                onError={(e) => {
                  e.currentTarget.style.display =
                    'none';
                }}
                style={{
                  width: '100%',
                  maxHeight: 220,
                  objectFit: 'cover',
                  borderRadius: 12,
                  background: '#eee',
                  border: '1px solid #ddd',
                }}
              />
            </div>
          )}
        </div>

        {/* ------------------------------------------ */}
        {/* PHONE */}
        {/* ------------------------------------------ */}

        <div style={{ marginBottom: 18 }}>
          <label
            style={{
              display: 'block',
              fontWeight: 'bold',
              marginBottom: 6,
            }}
          >
            Phone
          </label>

          <input
            type="text"
            value={form.phone}
            onChange={(e) =>
              handleChange(
                'phone',
                e.target.value
              )
            }
            placeholder="+91 9876543210"
            style={{
              width: '100%',
              padding: 12,
              border: '1px solid #ddd',
              borderRadius: 8,
              boxSizing: 'border-box',
              fontSize: 15,
            }}
          />
        </div>

        {/* ------------------------------------------ */}
        {/* ADDRESS */}
        {/* ------------------------------------------ */}

        <div style={{ marginBottom: 18 }}>
          <label
            style={{
              display: 'block',
              fontWeight: 'bold',
              marginBottom: 6,
            }}
          >
            Address
          </label>

          <textarea
            value={form.address}
            onChange={(e) =>
              handleChange(
                'address',
                e.target.value
              )
            }
            placeholder="Restaurant address"
            rows={3}
            style={{
              width: '100%',
              padding: 12,
              border: '1px solid #ddd',
              borderRadius: 8,
              boxSizing: 'border-box',
              fontSize: 15,
              resize: 'vertical',
            }}
          />
        </div>

        {/* ------------------------------------------ */}
        {/* PRIMARY COLOR */}
        {/* ------------------------------------------ */}

        <div style={{ marginBottom: 24 }}>
          <label
            style={{
              display: 'block',
              fontWeight: 'bold',
              marginBottom: 8,
            }}
          >
            Brand Color
          </label>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <input
              type="color"
              value={
                form.primary_color || '#222222'
              }
              onChange={(e) =>
                handleChange(
                  'primary_color',
                  e.target.value
                )
              }
              style={{
                width: 55,
                height: 42,
                padding: 2,
                border: '1px solid #ddd',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            />

            <input
              type="text"
              value={form.primary_color}
              onChange={(e) =>
                handleChange(
                  'primary_color',
                  e.target.value
                )
              }
              placeholder="#222222"
              style={{
                width: 140,
                padding: 10,
                border: '1px solid #ddd',
                borderRadius: 8,
              }}
            />

            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 8,
                background:
                  form.primary_color ||
                  '#222222',
                border: '1px solid #ddd',
              }}
            />
          </div>
        </div>

        {/* ------------------------------------------ */}
        {/* SAVE */}
        {/* ------------------------------------------ */}

        <button
          type="submit"
          disabled={saving}
          style={{
            width: '100%',
            padding: 14,
            border: 'none',
            borderRadius: 10,
            background:
              form.primary_color ||
              '#222222',
            color: 'white',
            cursor: saving
              ? 'not-allowed'
              : 'pointer',
            fontWeight: 'bold',
            fontSize: 16,
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving
            ? 'Saving...'
            : 'Save Restaurant Settings'}
        </button>
      </form>
    </section>
  );
}