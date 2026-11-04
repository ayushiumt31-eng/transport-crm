import React, { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import {
  Search,
  Plus,
  Eye,
  Pencil,
  X,
  UserRound,
  Building2,
  MapPin,
  CreditCard,
  FileText,
  CheckCircle2,
  AlertCircle,
  UserPlus
} from "lucide-react";
import { getAccessToken } from "../../auth/session";

// ==========================================
// Zod Schema for Customer Registration
// ==========================================
const customerSchema = z.object({
  customerType: z.enum(["Company", "Individual"]),
  company: z.string().trim().min(2, "Company/customer name is required"),
  contactPerson: z.string().trim().min(2, "Contact person is required"),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
  alternatePhone: z.string().refine(
    (value) => !value || /^[6-9]\d{9}$/.test(value),
    "Enter a valid alternate mobile number"
  ),
  email: z.string().refine(
    (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    "Enter a valid email address"
  ),
  gstin: z.string().refine(
    (value) =>
      !value ||
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(
        value.toUpperCase()
      ),
    "Enter a valid GSTIN"
  ),
  pan: z.string().refine(
    (value) => !value || /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value.toUpperCase()),
    "Enter a valid PAN"
  ),
  industry: z.string(),
  billingAddress: z.string().trim().min(3, "Billing address is required"),
  billingCity: z.string().trim().min(2, "Billing city is required"),
  billingState: z.string().trim().min(2, "Billing state is required"),
  billingPincode: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit PIN"),
  pickupAddress: z.string(),
  pickupCity: z.string(),
  pickupState: z.string(),
  pickupPincode: z.string().refine(
    (value) => !value || /^\d{6}$/.test(value),
    "Enter a valid 6-digit pickup PIN"
  ),
  paymentTerms: z.string(),
  creditLimit: z.coerce.number().min(0, "Credit limit cannot be negative"),
  status: z.enum(["Active", "Inactive", "Blocked"]),
  verificationStatus: z.enum(["Pending", "Verified", "Rejected"]),
  notes: z.string(),
});

const initialForm = {
  customerType: "Company",
  company: "",
  contactPerson: "",
  phone: "",
  alternatePhone: "",
  email: "",
  gstin: "",
  pan: "",
  industry: "",
  billingAddress: "",
  billingCity: "",
  billingState: "",
  billingPincode: "",
  pickupAddress: "",
  pickupCity: "",
  pickupState: "",
  pickupPincode: "",
  paymentTerms: "Advance",
  creditLimit: 0,
  status: "Active",
  verificationStatus: "Pending",
  notes: "",
};


async function customerRequest(path, options = {}) {
  const token = getAccessToken();
  const response = await fetch(`/api/v1${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.message || `Customer save failed (${response.status}).`);
  }
  return result.data;
}

function mapCustomerRecord(customer) {
  const customerId = String(customer._id);
  const address = customer.address || {};
  const pickupAddress = customer.pickupAddress || {};
  const createdAt = customer.createdAt ? new Date(customer.createdAt) : null;

  return {
    customerId,
    id: `CUS-${customerId.slice(-6).toUpperCase()}`,
    createdAt: createdAt && !Number.isNaN(createdAt.getTime())
      ? createdAt.toLocaleDateString("en-IN")
      : "",
    customerType: customer.customerType === "individual" ? "Individual" : "Company",
    company: customer.companyName || "",
    contactPerson: customer.contactPerson || "",
    phone: customer.phone || "",
    alternatePhone: customer.alternatePhone || "",
    email: customer.email || "",
    gstin: customer.gstin || "",
    pan: customer.pan || "",
    industry: customer.industry || customer.businessType || "",
    billingAddress: address.street || "",
    billingCity: address.city || "",
    billingState: address.state || "",
    billingPincode: address.pincode || "",
    pickupAddress: pickupAddress.street || "",
    pickupCity: pickupAddress.city || "",
    pickupState: pickupAddress.state || "",
    pickupPincode: pickupAddress.pincode || "",
    paymentTerms: customer.paymentTerms || "Advance",
    creditLimit: customer.creditLimit || 0,
    status: customer.crmStatus || (
      customer.status === "Suspended" ? "Blocked" :
        customer.status === "Pending" ? "Inactive" : "Active"
    ),
    verificationStatus: customer.crmVerificationStatus || (
      customer.kycStatus === "Verified" ? "Verified" :
        customer.kycStatus === "Rejected" ? "Rejected" : "Pending"
    ),
    notes: customer.notes || "",
  };
}

async function loadCustomerRecords() {
  const firstPage = await customerRequest(
    "/customers/management/registrations?page=1&limit=100"
  );
  const customers = firstPage.customers || [];
  const totalPages = firstPage.pagination?.totalPages || 1;

  for (let page = 2; page <= totalPages; page += 1) {
    const result = await customerRequest(
      `/customers/management/registrations?page=${page}&limit=100`
    );
    customers.push(...(result.customers || []));
  }

  return customers.map(mapCustomerRecord);
}

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500";

const labelClass = "mb-1 block text-xs font-semibold text-slate-400";

function Field({ label, required, error, children }) {
  return (
    <div className="min-w-0">
      <label className={labelClass}>
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1 flex items-center text-[10px] text-red-400">
          <AlertCircle className="mr-1 h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
}

function Section({ icon: Icon, title, description, children }) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="mb-4 flex items-center gap-2.5 border-b border-slate-800/80 pb-3">
        <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400">
          <Icon size={16} />
        </div>
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">{title}</h3>
          {description && (
            <p className="text-[11px] text-slate-400">{description}</p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {children}
      </div>
    </section>
  );
}

function StatusBadge({ status }) {
  const styles = {
    Active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    Verified: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    Pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    Inactive: "bg-slate-800 text-slate-400 border-slate-700",
    Blocked: "bg-red-500/10 text-red-400 border-red-500/20",
    Rejected: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  return (
    <span
      className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold ${
        styles[status] || "bg-slate-800 text-slate-400 border-slate-700"
      }`}
    >
      {status}
    </span>
  );
}

export default function CustomerRegister() {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [search, setSearch] = useState("");
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingCode, setEditingCode] = useState("");
  const [viewCustomer, setViewCustomer] = useState(null);
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState("success");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    loadCustomerRecords()
      .then((records) => {
        if (active) setCustomers(records);
      })
      .catch((error) => {
        if (active) {
          setNotice(error.message);
          setNoticeType("error");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return customers;

    return customers.filter((customer) =>
      [
        customer.id,
        customer.company,
        customer.contactPerson,
        customer.phone,
        customer.gstin,
        customer.billingCity,
      ].some((value) => String(value || "").toLowerCase().includes(query))
    );
  }, [customers, search]);

  function updateField(name, value) {
    setForm((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name]: undefined }));
    setNotice("");
  }

  function openNewForm() {
    setForm({ ...initialForm });
    setErrors({});
    setEditingId(null);
    setEditingCode("");
    setShowFormModal(true);
    setNotice("");
  }

  function openEditForm(customer) {
    const { customerId, id, createdAt, ...customerData } = customer;
    setForm({ ...initialForm, ...customerData });
    setErrors({});
    setEditingId(customerId);
    setEditingCode(id);
    setShowFormModal(true);
    setViewCustomer(null);
    setNotice("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const normalized = {
      ...form,
      company: form.company.trim(),
      contactPerson: form.contactPerson.trim(),
      phone: form.phone.trim(),
      alternatePhone: form.alternatePhone.trim(),
      email: form.email.trim(),
      gstin: form.gstin.trim().toUpperCase(),
      pan: form.pan.trim().toUpperCase(),
      creditLimit: Number(form.creditLimit),
    };

    const result = customerSchema.safeParse(normalized);

    if (!result.success) {
      const nextErrors = {};

      result.error.issues.forEach((issue) => {
        const key = issue.path[0];
        if (!nextErrors[key]) nextErrors[key] = issue.message;
      });

      setErrors(nextErrors);
      setNotice("Please correct the highlighted fields in the form.");
      setNoticeType("error");
      return;
    }

    const duplicate = customers.find(
      (customer) =>
        customer.id !== editingId &&
        (customer.phone === normalized.phone ||
          (normalized.gstin &&
            customer.gstin &&
            customer.gstin === normalized.gstin))
    );

    if (duplicate) {
      setNotice(
        `Duplicate customer detected: ${duplicate.id}. Check mobile number or GSTIN.`
      );
      setNoticeType("error");
      return;
    }

    setSaving(true);
    setNotice("");
    try {
      await customerRequest(
        editingId
          ? `/customers/management/registrations/${encodeURIComponent(editingId)}`
          : "/customers/management/registrations",
        {
          method: editingId ? "PUT" : "POST",
          body: normalized,
        }
      );
      const records = await loadCustomerRecords();
      setCustomers(records);
      setNotice(editingId ? "Customer details updated successfully." : "Customer registered successfully.");
      setNoticeType("success");
      setForm({ ...initialForm });
      setErrors({});
      setShowFormModal(false);
      setEditingId(null);
      setEditingCode("");
    } catch (error) {
      setNotice(error.message);
      setNoticeType("error");
    } finally {
      setSaving(false);
    }
  }

  const activeCount = customers.filter(
    (customer) => customer.status === "Active"
  ).length;

  const pendingCount = customers.filter(
    (customer) => customer.verificationStatus === "Pending"
  ).length;

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-wide text-white">
            Customer Registration (CRM)
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Manage B2B corporate shippers, tax profiles, credit limits & verification.
          </p>
        </div>

        {/* CLICKING THIS BUTTON OPENS THE POPUP FORM */}
        <button
          type="button"
          onClick={openNewForm}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-500"
        >
          <Plus size={16} />
          <span>Register New Customer</span>
        </button>
      </div>

      {/* Alert Notice */}
      {notice && (
        <div
          role={noticeType === "error" ? "alert" : "status"}
          className={`flex items-center justify-between rounded-xl border p-3 text-xs ${
            noticeType === "error"
              ? "border-red-500/30 bg-red-500/10 text-red-300"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertCircle
              size={16}
              className={noticeType === "error" ? "text-red-400" : "text-emerald-400"}
            />
            <span>{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice("")}
            className={noticeType === "error" ? "text-red-400 hover:text-white" : "text-emerald-400 hover:text-white"}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Analytics Counter Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Shippers</p>
          <p className="mt-2 text-3xl font-bold text-white">{customers.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Clients</p>
          <p className="mt-2 text-3xl font-bold text-emerald-400">{activeCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Pending Verification</p>
          <p className="mt-2 text-3xl font-bold text-amber-400">{pendingCount}</p>
        </div>
      </div>

      {/* Customers Directory Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
        <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-sm font-bold text-white">Registered Shippers Directory</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {filteredCustomers.length} customer profile(s) listed
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search company, GST, city..."
              className="w-full rounded-xl border border-slate-800 bg-slate-950 py-1.5 pl-9 pr-3 text-xs text-slate-200 outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="pb-3">Company / Client</th>
                <th className="pb-3">Contact Person</th>
                <th className="pb-3">GSTIN / Tax</th>
                <th className="pb-3">Credit Terms</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Verification</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-500">
                    {loading
                      ? "Loading customer profiles..."
                      : "No customer profiles found. Click \"Register New Customer\" to add a shipper."}
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/40 transition-all">
                    <td className="py-3">
                      <div className="font-semibold text-white">{c.company}</div>
                      <div className="text-[10px] text-slate-400">{c.id} • {c.billingCity}, {c.billingState}</div>
                    </td>
                    <td className="py-3">
                      <div>{c.contactPerson}</div>
                      <div className="text-[10px] text-slate-400">{c.phone}</div>
                    </td>
                    <td className="py-3 font-mono text-emerald-400 text-[11px]">
                      {c.gstin || "N/A"}
                    </td>
                    <td className="py-3">
                      <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] font-semibold">
                        {c.paymentTerms}
                      </span>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Limit: ₹{c.creditLimit ? c.creditLimit.toLocaleString("en-IN") : "0"}
                      </div>
                    </td>
                    <td className="py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="py-3">
                      <StatusBadge status={c.verificationStatus} />
                    </td>
                    <td className="py-3 text-right space-x-2">
                      <button
                        onClick={() => setViewCustomer(c)}
                        className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                        title="View Details"
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        onClick={() => openEditForm(c)}
                        className="rounded p-1 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                        title="Edit Customer"
                      >
                        <Pencil size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* POPUP MODAL: CUSTOMER REGISTRATION FORM */}
      {showFormModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          onClick={() => setShowFormModal(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Popup Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-900/95 px-6 py-4 backdrop-blur">
              <div className="flex items-center space-x-2.5">
                <div className="rounded-xl bg-emerald-600/20 p-2 text-emerald-400">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">
                    {editingId ? "Edit Customer Profile" : "Register New Shipper"}
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Fill in complete B2B details, GST tax rules, and credit terms.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Popup Registration Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {noticeType === "error" && notice && (
                <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                  {notice}
                </div>
              )}
              <Section
                icon={Building2}
                title="Business & Tax Information"
                description="Identity and legal compliance details"
              >
                <Field label="Customer ID">
                  <input
                    className={`${inputClass} bg-slate-900 text-slate-500`}
                    value={editingCode || "Assigned after save"}
                    readOnly
                  />
                </Field>

                <Field label="Customer Type" required>
                  <select
                    className={inputClass}
                    value={form.customerType}
                    onChange={(e) => updateField("customerType", e.target.value)}
                  >
                    <option value="Company">Company / Business</option>
                    <option value="Individual">Individual</option>
                  </select>
                </Field>

                <Field label="Company / Customer Name" required error={errors.company}>
                  <input
                    className={inputClass}
                    value={form.company}
                    onChange={(e) => updateField("company", e.target.value)}
                    placeholder="e.g. UltraTech Cement Ltd."
                  />
                </Field>

                <Field label="Industry Sector">
                  <select
                    className={inputClass}
                    value={form.industry}
                    onChange={(e) => updateField("industry", e.target.value)}
                  >
                    <option value="">Select industry</option>
                    <option>Manufacturing</option>
                    <option>Trading & Distribution</option>
                    <option>E-commerce</option>
                    <option>Retail</option>
                    <option>Agriculture</option>
                    <option>Pharmaceuticals</option>
                    <option>Automotive</option>
                    <option>Other</option>
                  </select>
                </Field>

                <Field label="GSTIN Number" error={errors.gstin}>
                  <input
                    className={`${inputClass} uppercase`}
                    maxLength={15}
                    value={form.gstin}
                    onChange={(e) => updateField("gstin", e.target.value.toUpperCase())}
                    placeholder="23AAAAA0000A1Z5"
                  />
                </Field>

                <Field label="PAN Number" error={errors.pan}>
                  <input
                    className={`${inputClass} uppercase`}
                    maxLength={10}
                    value={form.pan}
                    onChange={(e) => updateField("pan", e.target.value.toUpperCase())}
                    placeholder="ABCDE1234F"
                  />
                </Field>
              </Section>

              <Section
                icon={UserRound}
                title="Contact Information"
                description="Primary contact person for loading & dispatch"
              >
                <Field label="Contact Person Name" required error={errors.contactPerson}>
                  <input
                    className={inputClass}
                    value={form.contactPerson}
                    onChange={(e) => updateField("contactPerson", e.target.value)}
                    placeholder="e.g. Rajesh Sharma"
                  />
                </Field>

                <Field label="Mobile Number" required error={errors.phone}>
                  <input
                    className={inputClass}
                    maxLength={10}
                    value={form.phone}
                    onChange={(e) =>
                      updateField("phone", e.target.value.replace(/\D/g, "").slice(0, 10))
                    }
                    placeholder="9876543210"
                  />
                </Field>

                <Field label="Alternate Phone" error={errors.alternatePhone}>
                  <input
                    className={inputClass}
                    maxLength={10}
                    value={form.alternatePhone}
                    onChange={(e) =>
                      updateField("alternatePhone", e.target.value.replace(/\D/g, "").slice(0, 10))
                    }
                    placeholder="Optional"
                  />
                </Field>

                <Field label="Email Address" error={errors.email}>
                  <input
                    type="email"
                    className={inputClass}
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    placeholder="billing@company.com"
                  />
                </Field>
              </Section>

              <Section
                icon={MapPin}
                title="Billing & Office Address"
                description="Official registered address for Tax Invoices"
              >
                <div className="sm:col-span-2 xl:col-span-3">
                  <Field label="Full Street Address" required error={errors.billingAddress}>
                    <textarea
                      className={inputClass}
                      rows={2}
                      value={form.billingAddress}
                      onChange={(e) => updateField("billingAddress", e.target.value)}
                      placeholder="Plot No, Industrial Area..."
                    />
                  </Field>
                </div>

                <Field label="City" required error={errors.billingCity}>
                  <input
                    className={inputClass}
                    value={form.billingCity}
                    onChange={(e) => updateField("billingCity", e.target.value)}
                    placeholder="Indore"
                  />
                </Field>

                <Field label="State" required error={errors.billingState}>
                  <input
                    className={inputClass}
                    value={form.billingState}
                    onChange={(e) => updateField("billingState", e.target.value)}
                    placeholder="Madhya Pradesh"
                  />
                </Field>

                <Field label="PIN Code" required error={errors.billingPincode}>
                  <input
                    className={inputClass}
                    maxLength={6}
                    value={form.billingPincode}
                    onChange={(e) =>
                      updateField("billingPincode", e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="452001"
                  />
                </Field>
              </Section>

              <Section
                icon={CreditCard}
                title="Credit Limit & Payment Terms"
                description="Set udhaar period and maximum credit ceiling"
              >
                <Field label="Payment Credit Terms" required>
                  <select
                    className={inputClass}
                    value={form.paymentTerms}
                    onChange={(e) => updateField("paymentTerms", e.target.value)}
                  >
                    <option value="Advance">Advance Payment</option>
                    <option value="COD">Cash on Delivery</option>
                    <option value="7 Days">7 Days Credit</option>
                    <option value="15 Days">15 Days Credit</option>
                    <option value="30 Days">30 Days Credit</option>
                    <option value="45 Days">45 Days Credit</option>
                    <option value="60 Days">60 Days Credit</option>
                  </select>
                </Field>

                <Field label="Credit Limit (₹)" required error={errors.creditLimit}>
                  <input
                    type="number"
                    min="0"
                    className={inputClass}
                    value={form.creditLimit}
                    onChange={(e) => updateField("creditLimit", e.target.value)}
                    placeholder="500000"
                  />
                </Field>
              </Section>

              <Section
                icon={FileText}
                title="Account Status & Verification"
                description="Manage account lifecycle status"
              >
                <Field label="Account Status" required>
                  <select
                    className={inputClass}
                    value={form.status}
                    onChange={(e) => updateField("status", e.target.value)}
                  >
                    <option>Active</option>
                    <option>Inactive</option>
                    <option>Blocked</option>
                  </select>
                </Field>

                <Field label="KYC Verification Status" required>
                  <select
                    className={inputClass}
                    value={form.verificationStatus}
                    onChange={(e) => updateField("verificationStatus", e.target.value)}
                  >
                    <option>Pending</option>
                    <option>Verified</option>
                    <option>Rejected</option>
                  </select>
                </Field>
              </Section>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center space-x-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 disabled:cursor-wait disabled:opacity-60"
                >
                  <CheckCircle2 size={16} />
                  <span>
                    {saving
                      ? "Saving..."
                      : editingId ? "Save Changes" : "Save Customer Profile"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP MODAL: VIEW DETAILS */}
      {viewCustomer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          onClick={() => setViewCustomer(null)}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 p-5">
              <div>
                <span className="text-[10px] font-bold text-emerald-400 uppercase">{viewCustomer.id}</span>
                <h2 className="text-lg font-bold text-white">{viewCustomer.company}</h2>
              </div>
              <button
                type="button"
                onClick={() => setViewCustomer(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 p-5 text-xs">
              <div>
                <span className="text-slate-500">Contact Person</span>
                <p className="font-semibold text-white">{viewCustomer.contactPerson}</p>
              </div>
              <div>
                <span className="text-slate-500">Mobile Number</span>
                <p className="font-semibold text-white">{viewCustomer.phone}</p>
              </div>
              <div>
                <span className="text-slate-500">GSTIN</span>
                <p className="font-mono text-emerald-400">{viewCustomer.gstin || "N/A"}</p>
              </div>
              <div>
                <span className="text-slate-500">PAN</span>
                <p className="font-mono text-emerald-400">{viewCustomer.pan || "N/A"}</p>
              </div>
              <div>
                <span className="text-slate-500">Payment Terms</span>
                <p className="font-semibold text-white">{viewCustomer.paymentTerms}</p>
              </div>
              <div>
                <span className="text-slate-500">Credit Limit</span>
                <p className="font-semibold text-white">₹{viewCustomer.creditLimit?.toLocaleString("en-IN")}</p>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500">Billing Address</span>
                <p className="font-semibold text-white">
                  {viewCustomer.billingAddress}, {viewCustomer.billingCity}, {viewCustomer.billingState} - {viewCustomer.billingPincode}
                </p>
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-800 p-4">
              <button
                type="button"
                onClick={() => setViewCustomer(null)}
                className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}