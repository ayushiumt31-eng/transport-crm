import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2, CircleDashed, FileText, LoaderCircle, PackageCheck, Plus, ShieldCheck, Truck, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { apiFetch } from '../../auth/session';


const defaultForm = {
  pickupAddress: {
    contactName: '',
    contactPhone: '',
    street: '',
    city: '',
    state: '',
    pincode: ''
  },
  deliveryAddress: {
    contactName: '',
    contactPhone: '',
    street: '',
    city: '',
    state: '',
    pincode: ''
  },
  cargo: {
    goodsType: '',
    description: '',
    packageType: '',
    quantity: '',
    weightKg: '',
    volumeCbm: '',
    specialInstructions: ''
  },
  vehicleRequirement: {
    vehicleType: '',
    minCapacityKg: '',
    specialRequirements: ''
  },
  schedule: {
    pickupDate: '',
    expectedDeliveryDate: ''
  }
};

const STAFF_STATUS_TRANSITIONS = {
  pending: ['under_review', 'rejected', 'cancelled'],
  under_review: ['quoted', 'rejected', 'cancelled'],
  quoted: ['confirmed', 'rejected', 'cancelled', 'expired'],
  confirmed: ['cancelled'],
  rejected: [],
  cancelled: [],
  expired: []
};

// The signed-in user's token is attached by apiFetch; the API decides what each role may do.
async function apiRequest(path, options = {}) {
  const result = await apiFetch(path, options);
  return result.data ?? result;
}

function Field({ label, value, onChange, type = 'text', placeholder = '', min, required = false }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-slate-600">{label}</span>
      <input
        type={type}
        value={value}
        min={min}
        required={required}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options, required = false }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-slate-600">{label}</span>
      <select
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
      >
        <option value="">Select…</option>
        {options.map((option) => (
          <option key={option.value || option} value={option.value || option}>{option.label || option}</option>
        ))}
      </select>
    </label>
  );
}

function badgeTone(status) {
  if (!status) return 'border-slate-200 bg-slate-100 text-slate-700';
  if (['confirmed', 'verified', 'delivered'].includes(status)) return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (['pending', 'under_review', 'quoted'].includes(status)) return 'border-amber-200 bg-amber-50 text-amber-800';
  if (['rejected', 'cancelled', 'expired'].includes(status)) return 'border-rose-200 bg-rose-50 text-rose-800';
  return 'border-sky-200 bg-sky-50 text-sky-800';
}

function BookingManagement() {
  const { pathname } = useLocation();
  const { role: authRole } = useAuth();
  const [form, setForm] = useState(defaultForm);
  const [bookings, setBookings] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [updating, setUpdating] = useState('');
  const [selectedDetails, setSelectedDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState('');
  // Super admin and managers share the staff view; customers see only their own bookings.
  const role = authRole === 'customer' ? 'customer' : 'admin';
  const showBookingForm = pathname === '/bookings/vehicle' || pathname === '/bookings/online';
  const canCreateBooking = role === 'customer';
  const pageTitle = pathname === '/bookings/calendar'
    ? 'Booking calendar'
    : pathname === '/bookings/status'
      ? 'Booking status'
      : pathname === '/bookings/online'
        ? 'Online bookings'
        : pathname === '/crm/history'
          ? 'Customer booking history'
          : 'Vehicle bookings';
  const pageDescription = pathname === '/bookings/calendar'
    ? 'Review booking pickup and delivery schedules.'
    : pathname === '/bookings/status'
      ? 'Review current booking status and update requests when authorized.'
      : pathname === '/crm/history'
        ? 'Review bookings associated with the signed-in customer account.'
        : 'Create and review vehicle transport booking requests.';
  const visibleBookings = statusFilter
    ? bookings.filter((booking) => (booking.bookingStatus || booking.status || 'pending') === statusFilter)
    : bookings;

  const bookingSummary = useMemo(() => ({
    total: bookings.length,
    pending: bookings.filter((booking) => ['pending', 'under_review', 'quoted'].includes(booking.bookingStatus)).length,
    confirmed: bookings.filter((booking) => booking.bookingStatus === 'confirmed').length,
    rejected: bookings.filter((booking) => ['rejected', 'cancelled'].includes(booking.bookingStatus)).length
  }), [bookings]);

  async function loadBookings() {
    try {
      setLoading(true);
      setError('');
      if (role === 'admin') {
        const today = new Date();
        const startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const endDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const response = await apiRequest(`/customers/booking/calendar?startDate=${startDate}&endDate=${endDate}`);
        setBookings(Array.isArray(response) ? response : response.bookings || []);
      } else {
        const response = await apiRequest('/customers/booking?page=1&limit=20');
        const list = response.bookings || response.data?.bookings || [];
        setBookings(list);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBookings();
  }, [pathname]);

  const updateField = (section, key, value) => {
    setForm((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [key]: value
      }
    }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setNotice('');

    try {
      const payload = {
        pickupAddress: {
          contactName: form.pickupAddress.contactName,
          contactPhone: form.pickupAddress.contactPhone,
          street: form.pickupAddress.street,
          city: form.pickupAddress.city,
          state: form.pickupAddress.state,
          pincode: form.pickupAddress.pincode,
          landmark: '',
          country: 'India'
        },
        deliveryAddress: {
          contactName: form.deliveryAddress.contactName,
          contactPhone: form.deliveryAddress.contactPhone,
          street: form.deliveryAddress.street,
          city: form.deliveryAddress.city,
          state: form.deliveryAddress.state,
          pincode: form.deliveryAddress.pincode,
          landmark: '',
          country: 'India'
        },
        cargo: {
          goodsType: form.cargo.goodsType,
          description: form.cargo.description,
          packageType: form.cargo.packageType,
          quantity: Number(form.cargo.quantity),
          weightKg: Number(form.cargo.weightKg),
          volumeCbm: Number(form.cargo.volumeCbm || 0),
          specialInstructions: form.cargo.specialInstructions
        },
        vehicleRequirement: {
          vehicleType: form.vehicleRequirement.vehicleType,
          minCapacityKg: Number(form.vehicleRequirement.minCapacityKg || 0),
          specialRequirements: form.vehicleRequirement.specialRequirements
        },
        schedule: {
          pickupDate: new Date(form.schedule.pickupDate).toISOString(),
          expectedDeliveryDate: new Date(form.schedule.expectedDeliveryDate).toISOString()
        }
      };

      const bookingType = pathname === '/bookings/online' ? 'online' : 'vehicle';
      await apiRequest(`/customers/booking/${bookingType}`, { method: 'POST', body: payload });
      setNotice('Booking request submitted successfully.');
      setForm(defaultForm);
      await loadBookings();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusUpdate(bookingId, status) {
    setUpdating(bookingId);
    setError('');
    setNotice('');
    try {
      await apiRequest(`/customers/booking/${bookingId}/status`, {
        method: 'PATCH',
        body: { status, remarks: `Booking status updated to ${status}` }
      });
      setNotice(`Booking ${bookingId} status updated to ${status}.`);
      await loadBookings();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setUpdating('');
    }
  }

  async function loadBookingDetails(bookingId) {
    if (selectedDetails?.id === bookingId) {
      setSelectedDetails(null);
      return;
    }
    setLoadingDetails(bookingId);
    setError('');
    try {
      const [bookingResult, historyResult] = await Promise.all([
        apiRequest(`/customers/booking/${bookingId}`),
        apiRequest(`/customers/booking/${bookingId}/history`)
      ]);
      setSelectedDetails({
        id: bookingId,
        booking: bookingResult.booking || bookingResult,
        history: Array.isArray(historyResult) ? historyResult : historyResult.history || []
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingDetails('');
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <header className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-end">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">Booking Management</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">{pageTitle}</h1>
          <p className="mt-1 text-sm text-slate-600">{pageDescription}</p>
        </div>
        <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 border border-emerald-200">
          <ShieldCheck size={16} /> {role === 'customer' ? 'Customer view' : authRole === 'manager' ? 'Manager view' : 'Admin view'}
        </div>
      </header>

      {error && (
        <div role="alert" className="flex items-start gap-2 border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <X size={16} className="mt-0.5 shrink-0" />{error}
        </div>
      )}
      {notice && (
        <div role="status" className="flex items-center gap-2 border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <CheckCircle2 size={16} />{notice}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-xs uppercase text-slate-500">Total</div><div className="mt-2 text-3xl font-bold text-slate-900">{bookingSummary.total}</div></div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm"><div className="text-xs uppercase text-amber-700">Pending</div><div className="mt-2 text-3xl font-bold text-amber-900">{bookingSummary.pending}</div></div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm"><div className="text-xs uppercase text-emerald-700">Confirmed</div><div className="mt-2 text-3xl font-bold text-emerald-900">{bookingSummary.confirmed}</div></div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-sm"><div className="text-xs uppercase text-rose-700">Rejected / Cancelled</div><div className="mt-2 text-3xl font-bold text-rose-900">{bookingSummary.rejected}</div></div>
      </section>

      {showBookingForm && role === 'admin' && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
          Staff can review and update bookings here. Booking requests are created by customers from the Customer login.
        </div>
      )}

      <section className={`grid gap-6 ${showBookingForm && canCreateBooking ? 'lg:grid-cols-[1.05fr,0.95fr]' : 'grid-cols-1'}`}>
        {showBookingForm && canCreateBooking && <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Plus className="text-emerald-700" size={18} />
            <h2 className="text-lg font-bold text-slate-900">New booking request</h2>
          </div>

          <div className="space-y-5">
            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Pickup address</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Contact name" value={form.pickupAddress.contactName} onChange={(value) => updateField('pickupAddress', 'contactName', value)} placeholder="Pickup contact" required />
                <Field label="Contact phone" value={form.pickupAddress.contactPhone} onChange={(value) => updateField('pickupAddress', 'contactPhone', value)} placeholder="+91..." required />
                <Field label="Street" value={form.pickupAddress.street} onChange={(value) => updateField('pickupAddress', 'street', value)} placeholder="Street address" required />
                <Field label="City" value={form.pickupAddress.city} onChange={(value) => updateField('pickupAddress', 'city', value)} placeholder="City" required />
                <Field label="State" value={form.pickupAddress.state} onChange={(value) => updateField('pickupAddress', 'state', value)} placeholder="State" required />
                <Field label="Pincode" value={form.pickupAddress.pincode} onChange={(value) => updateField('pickupAddress', 'pincode', value)} placeholder="Pincode" required />
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Delivery address</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Contact name" value={form.deliveryAddress.contactName} onChange={(value) => updateField('deliveryAddress', 'contactName', value)} placeholder="Delivery contact" required />
                <Field label="Contact phone" value={form.deliveryAddress.contactPhone} onChange={(value) => updateField('deliveryAddress', 'contactPhone', value)} placeholder="+91..." required />
                <Field label="Street" value={form.deliveryAddress.street} onChange={(value) => updateField('deliveryAddress', 'street', value)} placeholder="Street address" required />
                <Field label="City" value={form.deliveryAddress.city} onChange={(value) => updateField('deliveryAddress', 'city', value)} placeholder="City" required />
                <Field label="State" value={form.deliveryAddress.state} onChange={(value) => updateField('deliveryAddress', 'state', value)} placeholder="State" required />
                <Field label="Pincode" value={form.deliveryAddress.pincode} onChange={(value) => updateField('deliveryAddress', 'pincode', value)} placeholder="Pincode" required />
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Cargo details</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Goods type" value={form.cargo.goodsType} onChange={(value) => updateField('cargo', 'goodsType', value)} placeholder="Goods type" required />
                <SelectField label="Package type" value={form.cargo.packageType} onChange={(value) => updateField('cargo', 'packageType', value)} options={['box', 'bag', 'pallet', 'carton', 'drum', 'container', 'loose', 'other'].map((item) => ({ value: item, label: item }))} required />
                <Field label="Quantity" type="number" min="1" value={form.cargo.quantity} onChange={(value) => updateField('cargo', 'quantity', value)} placeholder="Quantity" required />
                <Field label="Weight (kg)" type="number" min="0.01" value={form.cargo.weightKg} onChange={(value) => updateField('cargo', 'weightKg', value)} placeholder="Weight" required />
                <Field label="Volume (CBM)" type="number" min="0" value={form.cargo.volumeCbm} onChange={(value) => updateField('cargo', 'volumeCbm', value)} placeholder="0" />
                <Field label="Description" value={form.cargo.description} onChange={(value) => updateField('cargo', 'description', value)} placeholder="Short cargo description" />
              </div>
              <div className="mt-3">
                <Field label="Special instructions" value={form.cargo.specialInstructions} onChange={(value) => updateField('cargo', 'specialInstructions', value)} placeholder="Fragile / temperature etc." />
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Vehicle requirement</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <SelectField label="Vehicle type" value={form.vehicleRequirement.vehicleType} onChange={(value) => updateField('vehicleRequirement', 'vehicleType', value)} options={['Open Body', 'Container', 'Trailer', 'Heavy Duty', 'Temperature Controlled'].map((item) => ({ value: item, label: item }))} required />
                <Field label="Minimum capacity (kg)" type="number" min="0" value={form.vehicleRequirement.minCapacityKg} onChange={(value) => updateField('vehicleRequirement', 'minCapacityKg', value)} placeholder="Optional" />
              </div>
              <div className="mt-3">
                <Field label="Vehicle special requirements" value={form.vehicleRequirement.specialRequirements} onChange={(value) => updateField('vehicleRequirement', 'specialRequirements', value)} placeholder="Tail lift, double driver, etc." />
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Schedule</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Pickup date" type="date" value={form.schedule.pickupDate} onChange={(value) => updateField('schedule', 'pickupDate', value)} required />
                <Field label="Expected delivery date" type="date" value={form.schedule.expectedDeliveryDate} onChange={(value) => updateField('schedule', 'expectedDeliveryDate', value)} required />
              </div>
            </div>
          </div>

          <button type="submit" disabled={submitting} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
            {submitting ? <LoaderCircle size={16} className="animate-spin" /> : <PackageCheck size={16} />}Save booking request
          </button>
        </form>}

        <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <CalendarClock className="text-emerald-700" size={18} />
              <h2 className="text-lg font-bold text-slate-900">{pageTitle}</h2>
            </div>
            <label className="text-xs font-semibold text-slate-600">
              Filter status
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="ml-2 rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs">
                <option value="">All statuses</option>
                {['pending', 'under_review', 'quoted', 'confirmed', 'rejected', 'cancelled', 'expired'].map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-600"><LoaderCircle className="animate-spin" size={16} />Loading bookings...</div>
          ) : visibleBookings.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">No bookings found yet.</div>
          ) : (
            <div className="space-y-3">
              {visibleBookings.map((booking) => {
                const pickup = booking.pickupAddress || {};
                const delivery = booking.deliveryAddress || {};
                const status = booking.bookingStatus || booking.status || 'pending';
                return (
                  <article key={booking._id || booking.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{booking.bookingNumber || 'BK-NEW'}</div>
                        <div className="mt-1 text-sm font-bold text-slate-900">{pickup.city || 'Pickup'} → {delivery.city || 'Delivery'}</div>
                      </div>
                      <span className={`inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-semibold ${badgeTone(status)}`}>{status}</span>
                    </div>

                    <div className="space-y-1 text-xs text-slate-600">
                      <div>Goods: {booking.cargo?.goodsType || '—'}</div>
                      <div>Vehicle: {booking.vehicleRequirement?.vehicleType || '—'}</div>
                    </div>

                    {role === 'admin' && (
                      <div className="mt-3 flex items-center gap-2">
                        <select
                          value={status}
                          onChange={(event) => handleStatusUpdate(booking._id, event.target.value)}
                          disabled={updating === booking._id}
                          className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-xs text-slate-800"
                        >
                          {[status, ...(STAFF_STATUS_TRANSITIONS[status] || [])].map((item) => (
                            <option key={item} value={item}>{item}</option>
                          ))}
                        </select>
                        {updating === booking._id && <LoaderCircle className="animate-spin text-slate-500" size={16} />}
                      </div>
                    )}
                    {role === 'customer' && (
                      <button type="button" onClick={() => loadBookingDetails(booking._id || booking.id)} disabled={loadingDetails === (booking._id || booking.id)} className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                        {loadingDetails === (booking._id || booking.id) ? <LoaderCircle size={13} className="animate-spin" /> : <FileText size={13} />}
                        {selectedDetails?.id === (booking._id || booking.id) ? 'Hide details' : 'Details & status history'}
                      </button>
                    )}
                    {selectedDetails?.id === (booking._id || booking.id) && (
                      <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                        <div className="grid gap-2 text-xs sm:grid-cols-2">
                          <p><span className="font-semibold text-slate-700">Booking ID:</span> {selectedDetails.booking._id || selectedDetails.booking.id || booking._id}</p>
                          <p><span className="font-semibold text-slate-700">Created:</span> {selectedDetails.booking.createdAt ? new Date(selectedDetails.booking.createdAt).toLocaleString('en-IN') : '—'}</p>
                          <p><span className="font-semibold text-slate-700">Pickup:</span> {selectedDetails.booking.pickupAddress?.street || '—'}, {selectedDetails.booking.pickupAddress?.city || '—'}</p>
                          <p><span className="font-semibold text-slate-700">Delivery:</span> {selectedDetails.booking.deliveryAddress?.street || '—'}, {selectedDetails.booking.deliveryAddress?.city || '—'}</p>
                        </div>
                        <div>
                          <p className="mb-2 text-xs font-bold text-slate-800">Status history</p>
                          {selectedDetails.history.length ? <ul className="space-y-2">{selectedDetails.history.map((item, index) => <li key={item._id || `${item.status}-${item.createdAt}-${index}`} className="flex items-start justify-between gap-3 text-xs"><span className="font-semibold text-slate-700">{item.status || item.bookingStatus || 'Update'}{item.remarks ? ` · ${item.remarks}` : ''}</span><span className="shrink-0 text-slate-500">{item.createdAt ? new Date(item.createdAt).toLocaleString('en-IN') : '—'}</span></li>)}</ul> : <p className="text-xs text-slate-500">No status history returned.</p>}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}

export default BookingManagement;
