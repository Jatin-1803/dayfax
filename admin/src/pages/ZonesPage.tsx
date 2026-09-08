import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { apiRequest, ApiError, formatPaise } from '../api/client';
import type {
  DeliveryFeeSlabRow,
  DeliveryZoneRow,
  LocationRow,
  ServiceAreaRow,
} from '../api/types';
import { useToast } from '../components/Toast';

function paiseToRupees(paise: number) {
  return (paise / 100).toFixed(2).replace(/\.?0+$/, '');
}

function rupeesToPaise(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export function ZonesPage() {
  const toast = useToast();
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [areas, setAreas] = useState<ServiceAreaRow[]>([]);
  const [zones, setZones] = useState<DeliveryZoneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [locForm, setLocForm] = useState({
    name: '',
    state: '',
    latitude: '',
    longitude: '',
  });
  const [areaForm, setAreaForm] = useState({ locationId: '', name: '' });
  const [zoneForm, setZoneForm] = useState({
    serviceAreaId: '',
    name: '',
    deliveryFeeRupees: '20',
    minOrderRupees: '99',
    freeDeliveryAboveRupees: '',
    etaMinutes: '30',
  });

  const [editingLocation, setEditingLocation] = useState<LocationRow | null>(null);
  const [locationEditForm, setLocationEditForm] = useState({
    name: '',
    state: '',
    latitude: '',
    longitude: '',
  });

  const [editingZone, setEditingZone] = useState<DeliveryZoneRow | null>(null);
  const [zoneEditForm, setZoneEditForm] = useState({
    name: '',
    deliveryFeeRupees: '',
    minOrderRupees: '',
    freeDeliveryAboveRupees: '',
    etaMinutes: '',
  });

  const [slabsZone, setSlabsZone] = useState<DeliveryZoneRow | null>(null);
  const [slabs, setSlabs] = useState<DeliveryFeeSlabRow[]>([]);
  const [slabForm, setSlabForm] = useState({ fromKm: '0', toKm: '', feeRupees: '20' });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [locs, ars, zns] = await Promise.all([
        apiRequest<LocationRow[]>('/admin/zones/locations'),
        apiRequest<ServiceAreaRow[]>('/admin/zones/service-areas'),
        apiRequest<DeliveryZoneRow[]>('/admin/zones/delivery-zones'),
      ]);
      setLocations(locs);
      setAreas(ars);
      setZones(zns);
      if (!areaForm.locationId && locs[0]) {
        setAreaForm((f) => ({ ...f, locationId: locs[0].id }));
      }
      if (!zoneForm.serviceAreaId && ars[0]) {
        setZoneForm((f) => ({ ...f, serviceAreaId: ars[0].id }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load zones');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreateLocation(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await apiRequest('/admin/zones/locations', {
        method: 'POST',
        body: JSON.stringify({
          name: locForm.name,
          state: locForm.state || null,
          countryCode: 'IN',
          latitude: locForm.latitude ? Number(locForm.latitude) : null,
          longitude: locForm.longitude ? Number(locForm.longitude) : null,
        }),
      });
      toast.push('Location created', 'success');
      setLocForm({ name: '', state: '', latitude: '', longitude: '' });
      await load();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function onCreateArea(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await apiRequest('/admin/zones/service-areas', {
        method: 'POST',
        body: JSON.stringify({
          locationId: areaForm.locationId,
          name: areaForm.name,
          isActive: true,
        }),
      });
      toast.push('Service area created', 'success');
      setAreaForm((f) => ({ ...f, name: '' }));
      await load();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function onCreateZone(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const freeAbove = zoneForm.freeDeliveryAboveRupees.trim();
      await apiRequest('/admin/zones/delivery-zones', {
        method: 'POST',
        body: JSON.stringify({
          serviceAreaId: zoneForm.serviceAreaId,
          name: zoneForm.name,
          deliveryFeePaise: rupeesToPaise(zoneForm.deliveryFeeRupees),
          minOrderPaise: rupeesToPaise(zoneForm.minOrderRupees),
          freeDeliveryAbovePaise: freeAbove ? rupeesToPaise(freeAbove) : null,
          etaMinutes: Number(zoneForm.etaMinutes) || 30,
          isActive: true,
        }),
      });
      toast.push('Delivery zone created', 'success');
      setZoneForm((f) => ({ ...f, name: '', freeDeliveryAboveRupees: '' }));
      await load();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  function openEditLocation(loc: LocationRow) {
    setEditingLocation(loc);
    setLocationEditForm({
      name: loc.name,
      state: loc.state || '',
      latitude: loc.latitude != null ? String(loc.latitude) : '',
      longitude: loc.longitude != null ? String(loc.longitude) : '',
    });
  }

  async function onSaveLocation(e: FormEvent) {
    e.preventDefault();
    if (!editingLocation) return;
    setBusy(true);
    try {
      await apiRequest(`/admin/zones/locations/${editingLocation.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: locationEditForm.name,
          state: locationEditForm.state || null,
          latitude: locationEditForm.latitude
            ? Number(locationEditForm.latitude)
            : null,
          longitude: locationEditForm.longitude
            ? Number(locationEditForm.longitude)
            : null,
        }),
      });
      toast.push('Location updated', 'success');
      setEditingLocation(null);
      await load();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function toggleArea(area: ServiceAreaRow) {
    try {
      await apiRequest(`/admin/zones/service-areas/${area.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !area.isActive }),
      });
      toast.push('Service area updated', 'success');
      await load();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Failed', 'error');
    }
  }

  function openEditZone(zone: DeliveryZoneRow) {
    setEditingZone(zone);
    setZoneEditForm({
      name: zone.name,
      deliveryFeeRupees: paiseToRupees(zone.deliveryFeePaise),
      minOrderRupees: paiseToRupees(zone.minOrderPaise),
      freeDeliveryAboveRupees:
        zone.freeDeliveryAbovePaise != null
          ? paiseToRupees(zone.freeDeliveryAbovePaise)
          : '',
      etaMinutes: String(zone.etaMinutes),
    });
  }

  async function onSaveZone(e: FormEvent) {
    e.preventDefault();
    if (!editingZone) return;
    setBusy(true);
    try {
      const freeAbove = zoneEditForm.freeDeliveryAboveRupees.trim();
      await apiRequest(`/admin/zones/delivery-zones/${editingZone.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: zoneEditForm.name,
          deliveryFeePaise: rupeesToPaise(zoneEditForm.deliveryFeeRupees),
          minOrderPaise: rupeesToPaise(zoneEditForm.minOrderRupees),
          freeDeliveryAbovePaise: freeAbove ? rupeesToPaise(freeAbove) : null,
          etaMinutes: Number(zoneEditForm.etaMinutes) || 30,
        }),
      });
      toast.push('Delivery zone updated', 'success');
      setEditingZone(null);
      await load();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function toggleZone(zone: DeliveryZoneRow) {
    try {
      await apiRequest(`/admin/zones/delivery-zones/${zone.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !zone.isActive }),
      });
      toast.push('Zone updated', 'success');
      await load();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Failed', 'error');
    }
  }

  async function openSlabs(zone: DeliveryZoneRow) {
    setSlabsZone(zone);
    setSlabForm({ fromKm: '0', toKm: '', feeRupees: '20' });
    try {
      const rows = await apiRequest<DeliveryFeeSlabRow[]>(
        `/admin/zones/delivery-zones/${zone.id}/slabs`,
      );
      setSlabs(rows);
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Failed to load slabs', 'error');
      setSlabs([]);
    }
  }

  async function onCreateSlab(e: FormEvent) {
    e.preventDefault();
    if (!slabsZone) return;
    setBusy(true);
    try {
      const toKm = slabForm.toKm.trim();
      await apiRequest(`/admin/zones/delivery-zones/${slabsZone.id}/slabs`, {
        method: 'POST',
        body: JSON.stringify({
          fromKm: Number(slabForm.fromKm) || 0,
          toKm: toKm ? Number(toKm) : null,
          feePaise: rupeesToPaise(slabForm.feeRupees),
        }),
      });
      toast.push('Distance slab added', 'success');
      setSlabForm({ fromKm: '0', toKm: '', feeRupees: '20' });
      await openSlabs(slabsZone);
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteSlab(slabId: string) {
    if (!slabsZone) return;
    setBusy(true);
    try {
      await apiRequest(`/admin/zones/delivery-zones/${slabsZone.id}/slabs/${slabId}`, {
        method: 'DELETE',
      });
      toast.push('Slab deleted', 'success');
      await openSlabs(slabsZone);
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="loading-box">Loading…</div>;
  if (error) return <div className="error-box">{error}</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Zones</h1>
          <p>
            Set location center point, min order, free delivery above amount, and distance fee
            slabs.
          </p>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0, fontFamily: 'var(--display)', fontSize: '1.2rem' }}>
          Locations (delivery center)
        </h2>
        <form className="toolbar" onSubmit={onCreateLocation}>
          <input
            required
            placeholder="Town / city name"
            value={locForm.name}
            onChange={(e) => setLocForm({ ...locForm, name: e.target.value })}
          />
          <input
            placeholder="State"
            value={locForm.state}
            onChange={(e) => setLocForm({ ...locForm, state: e.target.value })}
          />
          <input
            placeholder="Center lat"
            value={locForm.latitude}
            onChange={(e) => setLocForm({ ...locForm, latitude: e.target.value })}
          />
          <input
            placeholder="Center lng"
            value={locForm.longitude}
            onChange={(e) => setLocForm({ ...locForm, longitude: e.target.value })}
          />
          <button className="btn" type="submit" disabled={busy}>
            Add location
          </button>
        </form>
        {locations.length === 0 ? (
          <div className="empty">No locations yet.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>State</th>
                  <th>Center</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {locations.map((l) => (
                  <tr key={l.id}>
                    <td>{l.name}</td>
                    <td>{l.state || '—'}</td>
                    <td>
                      {l.latitude != null && l.longitude != null
                        ? `${l.latitude}, ${l.longitude}`
                        : 'Not set'}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => openEditLocation(l)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0, fontFamily: 'var(--display)', fontSize: '1.2rem' }}>
          Service areas
        </h2>
        <form className="toolbar" onSubmit={onCreateArea}>
          <select
            required
            value={areaForm.locationId}
            onChange={(e) => setAreaForm({ ...areaForm, locationId: e.target.value })}
          >
            <option value="">Select location</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <input
            required
            placeholder="Service area name"
            value={areaForm.name}
            onChange={(e) => setAreaForm({ ...areaForm, name: e.target.value })}
          />
          <button className="btn" type="submit" disabled={busy}>
            Add area
          </button>
        </form>
        {areas.length === 0 ? (
          <div className="empty">No service areas yet.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Location</th>
                  <th>Slug</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {areas.map((a) => (
                  <tr key={a.id}>
                    <td>{a.name}</td>
                    <td>{a.locationName || a.locationId}</td>
                    <td>{a.slug}</td>
                    <td>
                      {a.isActive ? (
                        <span className="badge">Active</span>
                      ) : (
                        <span className="badge badge-muted">Inactive</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => void toggleArea(a)}
                      >
                        {a.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0, fontFamily: 'var(--display)', fontSize: '1.2rem' }}>
          Delivery zones
        </h2>
        <form className="stack" onSubmit={onCreateZone} style={{ marginBottom: '1rem' }}>
          <div className="form-grid">
            <div className="field">
              <label>Service area</label>
              <select
                required
                value={zoneForm.serviceAreaId}
                onChange={(e) => setZoneForm({ ...zoneForm, serviceAreaId: e.target.value })}
              >
                <option value="">Select area</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Zone name</label>
              <input
                required
                value={zoneForm.name}
                onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Fallback fee (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={zoneForm.deliveryFeeRupees}
                onChange={(e) =>
                  setZoneForm({ ...zoneForm, deliveryFeeRupees: e.target.value })
                }
              />
            </div>
            <div className="field">
              <label>Min order (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={zoneForm.minOrderRupees}
                onChange={(e) => setZoneForm({ ...zoneForm, minOrderRupees: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Free delivery above (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Optional"
                value={zoneForm.freeDeliveryAboveRupees}
                onChange={(e) =>
                  setZoneForm({ ...zoneForm, freeDeliveryAboveRupees: e.target.value })
                }
              />
            </div>
            <div className="field">
              <label>ETA (minutes)</label>
              <input
                type="number"
                min="1"
                value={zoneForm.etaMinutes}
                onChange={(e) => setZoneForm({ ...zoneForm, etaMinutes: e.target.value })}
              />
            </div>
          </div>
          <button className="btn" type="submit" disabled={busy}>
            Add zone
          </button>
        </form>
        {zones.length === 0 ? (
          <div className="empty">No delivery zones yet.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Zone</th>
                  <th>Area</th>
                  <th>Fallback fee</th>
                  <th>Min order</th>
                  <th>Free above</th>
                  <th>ETA</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {zones.map((z) => (
                  <tr key={z.id}>
                    <td>{z.name}</td>
                    <td>{z.serviceAreaName || z.serviceAreaId}</td>
                    <td>{formatPaise(z.deliveryFeePaise)}</td>
                    <td>{formatPaise(z.minOrderPaise)}</td>
                    <td>
                      {z.freeDeliveryAbovePaise != null
                        ? formatPaise(z.freeDeliveryAbovePaise)
                        : '—'}
                    </td>
                    <td>{z.etaMinutes} min</td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => openEditZone(z)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => void openSlabs(z)}
                        >
                          Slabs
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => void toggleZone(z)}
                        >
                          {z.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingLocation ? (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>Edit location</h2>
            <form className="stack" onSubmit={onSaveLocation}>
              <div className="field">
                <label>Name</label>
                <input
                  required
                  value={locationEditForm.name}
                  onChange={(e) =>
                    setLocationEditForm({ ...locationEditForm, name: e.target.value })
                  }
                />
              </div>
              <div className="field">
                <label>State</label>
                <input
                  value={locationEditForm.state}
                  onChange={(e) =>
                    setLocationEditForm({ ...locationEditForm, state: e.target.value })
                  }
                />
              </div>
              <div className="form-grid">
                <div className="field">
                  <label>Center latitude</label>
                  <input
                    value={locationEditForm.latitude}
                    onChange={(e) =>
                      setLocationEditForm({
                        ...locationEditForm,
                        latitude: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="field">
                  <label>Center longitude</label>
                  <input
                    value={locationEditForm.longitude}
                    onChange={(e) =>
                      setLocationEditForm({
                        ...locationEditForm,
                        longitude: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingLocation(null)}
                >
                  Cancel
                </button>
                <button className="btn" type="submit" disabled={busy}>
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editingZone ? (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>Edit delivery zone</h2>
            <form className="stack" onSubmit={onSaveZone}>
              <div className="field">
                <label>Zone name</label>
                <input
                  required
                  value={zoneEditForm.name}
                  onChange={(e) => setZoneEditForm({ ...zoneEditForm, name: e.target.value })}
                />
              </div>
              <div className="form-grid">
                <div className="field">
                  <label>Fallback fee (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={zoneEditForm.deliveryFeeRupees}
                    onChange={(e) =>
                      setZoneEditForm({ ...zoneEditForm, deliveryFeeRupees: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>Min order (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={zoneEditForm.minOrderRupees}
                    onChange={(e) =>
                      setZoneEditForm({ ...zoneEditForm, minOrderRupees: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>Free delivery above (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Empty = off"
                    value={zoneEditForm.freeDeliveryAboveRupees}
                    onChange={(e) =>
                      setZoneEditForm({
                        ...zoneEditForm,
                        freeDeliveryAboveRupees: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="field">
                  <label>ETA (minutes)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={zoneEditForm.etaMinutes}
                    onChange={(e) =>
                      setZoneEditForm({ ...zoneEditForm, etaMinutes: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingZone(null)}
                >
                  Cancel
                </button>
                <button className="btn" type="submit" disabled={busy}>
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {slabsZone ? (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 560 }}>
            <h2>Distance slabs — {slabsZone.name}</h2>
            <p style={{ marginTop: 0, color: 'var(--muted)' }}>
              Fee is chosen by distance from the location center to the customer address. Leave
              “to km” empty for an open-ended upper band. Fallback fee applies when no slabs match
              or center/address coords are missing.
            </p>
            <form className="toolbar" onSubmit={onCreateSlab}>
              <input
                required
                type="number"
                min="0"
                step="0.1"
                placeholder="From km"
                value={slabForm.fromKm}
                onChange={(e) => setSlabForm({ ...slabForm, fromKm: e.target.value })}
              />
              <input
                type="number"
                min="0"
                step="0.1"
                placeholder="To km (optional)"
                value={slabForm.toKm}
                onChange={(e) => setSlabForm({ ...slabForm, toKm: e.target.value })}
              />
              <input
                required
                type="number"
                min="0"
                step="0.01"
                placeholder="Fee ₹"
                value={slabForm.feeRupees}
                onChange={(e) => setSlabForm({ ...slabForm, feeRupees: e.target.value })}
              />
              <button className="btn" type="submit" disabled={busy}>
                Add slab
              </button>
            </form>
            {slabs.length === 0 ? (
              <div className="empty">No slabs yet — fallback fee will be used.</div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>From km</th>
                      <th>To km</th>
                      <th>Fee</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {slabs.map((s) => (
                      <tr key={s.id}>
                        <td>{s.fromKm}</td>
                        <td>{s.toKm == null ? '∞' : s.toKm}</td>
                        <td>{formatPaise(s.feePaise)}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={busy}
                            onClick={() => void onDeleteSlab(s.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setSlabsZone(null);
                  setSlabs([]);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
