import React, { useMemo, useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import {
  UserPlus,
  Search,
  Pencil,
  Trash2,
  X,
  User,
  MapPin,
  Clock3,
  ShieldCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  Users,
  ShieldAlert,
  Crown,
  RefreshCw
} from 'lucide-react';

export type AccountRole = 'Farmer' | 'Admin' | 'Super Admin';
export type AccountStatus = 'Active' | 'Inactive';

export interface Account {
  id: string;
  name: string;
  email: string;
  location: string;
  role: AccountRole;
  createdAt: string;
  status: AccountStatus;
}

export interface AccountData {
  id?: string;
  name?: string;
  email: string;
  location?: string;
  role?: string;
  status?: string;
}

interface AccountManagementProps {
  onAddAccount?: (acc: AccountData) => void;
  onEditAccount?: (id: string, acc: AccountData) => void;
  onDeleteAccount?: (id: string) => void;
}

interface AccountForm {
  id: string;
  name: string;
  email: string;
  location: string;
  role: AccountRole;
  password: string;
  status: AccountStatus;
}

// Read API URL dynamically from environment variables, falling back to live Render backend
const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'https://aquasense-backend-osmi.onrender.com';

const API_BASE_URL = `${BASE_URL.replace(/\/$/, '')}/api/accounts`;

const EMPTY_FORM: AccountForm = {
  id: '',
  name: '',
  email: '',
  location: '',
  role: 'Farmer',
  password: '',
  status: 'Active'
};

const formatDateTime = (date: Date) => {
  return date.toLocaleString([], {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export default function AccountManagement({
  onAddAccount,
  onEditAccount,
  onDeleteAccount
}: AccountManagementProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'All' | AccountRole>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | AccountStatus>('All');

  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [form, setForm] = useState<AccountForm>(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);

  const [notice, setNotice] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Fetch Accounts on Mount
  const fetchAccounts = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(API_BASE_URL);
      if (!response.ok) throw new Error('Failed to fetch accounts.');
      const data: Account[] = await response.json();
      setAccounts(data);
    } catch (err: any) {
      showError(err.message || 'Error connecting to the database server.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const filteredAccounts = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return accounts.filter((account) => {
      const matchesSearch =
        !keyword ||
        account.id.toLowerCase().includes(keyword) ||
        account.name.toLowerCase().includes(keyword) ||
        account.email.toLowerCase().includes(keyword) ||
        account.location.toLowerCase().includes(keyword);

      const matchesRole = roleFilter === 'All' || account.role === roleFilter;
      const matchesStatus = statusFilter === 'All' || (account.status ?? 'Active') === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [accounts, search, roleFilter, statusFilter]);

  const farmerCount = accounts.filter((acc) => acc.role === 'Farmer').length;
  const adminCount = accounts.filter((acc) => acc.role === 'Admin').length;
  const superAdminCount = accounts.filter((acc) => acc.role === 'Super Admin').length;

  const openAddModal = () => {
    setEditingAccount(null);
    const nextNumber = accounts.length + 1;

    setForm({
      ...EMPTY_FORM,
      id: `USR-${String(nextNumber).padStart(3, '0')}`
    });

    setShowPassword(false);
    setNotice(null);
    setShowModal(true);
  };

  const openEditModal = (account: Account) => {
    setEditingAccount(account);

    setForm({
      id: account.id,
      name: account.name,
      email: account.email,
      location: account.location,
      role: account.role,
      password: '',
      status: account.status ?? 'Active'
    });

    setShowPassword(false);
    setNotice(null);
    setShowModal(true);
  };

  const closeModal = () => {
    if (isSubmitting) return;
    setShowModal(false);
    setEditingAccount(null);
    setForm(EMPTY_FORM);
    setShowPassword(false);
  };

  const updateForm = <K extends keyof AccountForm>(
    field: K,
    value: AccountForm[K]
  ) => {
    setForm((previous) => ({
      ...previous,
      [field]: value
    }));
  };

  const showSuccess = (message: string) => {
    setNotice({ type: 'success', message });
    window.setTimeout(() => setNotice(null), 3500);
  };

  const showError = (message: string) => {
    setNotice({ type: 'error', message });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const id = form.id.trim();
    const name = form.name.trim();
    const email = form.email.trim();
    const location = form.location.trim();

    if (!id || !name || !email || !location) {
      showError('Please complete all required fields.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError('Please enter a valid email address.');
      return;
    }

    if (!editingAccount && form.password.length < 6) {
      showError('Password must contain at least 6 characters.');
      return;
    }

    const payload = {
      id,
      name,
      email,
      location,
      role: form.role,
      status: form.status,
      createdAt: editingAccount?.createdAt ?? formatDateTime(new Date()),
      password: form.password ? form.password : undefined
    };

    setIsSubmitting(true);

    try {
      if (editingAccount) {
        const response = await fetch(`${API_BASE_URL}/${editingAccount.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.detail || 'Failed to update account.');
        }

        const updated: Account = await response.json();
        setAccounts((prev) =>
          prev.map((acc) => (acc.id === editingAccount.id ? updated : acc))
        );
        showSuccess(`Account "${name}" updated successfully.`);
        if (onEditAccount) onEditAccount(editingAccount.id, updated);
      } else {
        const response = await fetch(API_BASE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.detail || 'Failed to create account.');
        }

        const created: Account = await response.json();
        setAccounts((prev) => [created, ...prev]);
        showSuccess(`Account "${name}" created successfully.`);
        if (onAddAccount) onAddAccount(created);
      }

      closeModal();
    } catch (err: any) {
      showError(err.message || 'Failed to persist account changes.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    const deletedId = deleteTarget.id;
    const deletedName = deleteTarget.name;

    try {
      const response = await fetch(`${API_BASE_URL}/${deletedId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to delete account.');
      }

      setAccounts((prev) => prev.filter((acc) => acc.id !== deletedId));
      showSuccess(`Account "${deletedName}" was removed.`);
      if (onDeleteAccount) onDeleteAccount(deletedId);
    } catch (err: any) {
      showError(err.message || 'Failed to delete account.');
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="aquasense-account-page" style={styles.page}>
      {/* Header Bar */}
      <div className="aquasense-account-page-header" style={styles.header}>
        <div>
          <div style={styles.eyebrow}>
            <ShieldCheck size={14} />
            AQUASENSE CONTROL PANEL
          </div>

          <h1 style={styles.title}>Account Management</h1>

          <p style={styles.subtitle}>
            Register, provision, and control role-based access for Farmers, System Admins, and Super Administrators.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          style={styles.primaryButton}
        >
          <UserPlus size={18} />
          Add New Account
        </button>
      </div>

      {/* Global Alerts */}
      {notice && !showModal && (
        <div
          style={{
            ...styles.notice,
            ...(notice.type === 'success' ? styles.successNotice : styles.errorNotice)
          }}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 size={18} />
          ) : (
            <AlertTriangle size={18} />
          )}
          <span>{notice.message}</span>
        </div>
      )}

      {/* Dynamic Role & Account Metric Cards */}
      <div className="aquasense-account-stats" style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, background: '#eff6ff', color: '#2563eb' }}>
            <Users size={21} />
          </div>
          <div>
            <div style={styles.statLabel}>TOTAL ACCOUNTS</div>
            <div style={styles.statValue}>{accounts.length}</div>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, background: '#ecfdf5', color: '#047857' }}>
            <User size={21} />
          </div>
          <div>
            <div style={styles.statLabel}>FARMERS</div>
            <div style={styles.statValue}>{farmerCount}</div>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, background: '#f0f9ff', color: '#0284c7' }}>
            <ShieldCheck size={21} />
          </div>
          <div>
            <div style={styles.statLabel}>SYSTEM ADMINS</div>
            <div style={styles.statValue}>{adminCount}</div>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, background: '#f3e8ff', color: '#7e22ce' }}>
            <Crown size={21} />
          </div>
          <div>
            <div style={styles.statLabel}>SUPER ADMINS</div>
            <div style={styles.statValue}>{superAdminCount}</div>
          </div>
        </div>
      </div>

      {/* Main Table & Filter Controls Panel */}
      <section style={styles.panel}>
        <div className="aquasense-account-toolbar" style={styles.toolbar}>
          <div style={styles.searchBox}>
            <Search size={18} color="#64748b" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, email, ID, or location..."
              style={styles.searchInput}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={styles.clearSearch}
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div style={styles.filterGroup}>
            <select
              value={roleFilter}
              onChange={(event) =>
                setRoleFilter(event.target.value as 'All' | AccountRole)
              }
              className="aquasense-account-filter"
              style={styles.filterSelect}
            >
              <option value="All">All Roles</option>
              <option value="Farmer">Farmer</option>
              <option value="Admin">Admin</option>
              <option value="Super Admin">Super Admin</option>
            </select>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as 'All' | AccountStatus)
              }
              className="aquasense-account-filter"
              style={styles.filterSelect}
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>ACCOUNT INFO</th>
                <th style={styles.th}>FARM / LOCATION</th>
                <th style={styles.th}>ASSIGNED ROLE</th>
                <th style={styles.th}>CREATED DATE</th>
                <th style={styles.th}>STATUS</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} style={{ ...styles.emptyCell, padding: '40px' }}>
                    <RefreshCw size={24} className="animate-spin" color="#2563eb" />
                    <span style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>
                      Loading database records...
                    </span>
                  </td>
                </tr>
              ) : filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={6} style={styles.emptyCell}>
                    <Users size={34} color="#94a3b8" />
                    <strong style={{ display: 'block', marginTop: 8 }}>
                      No matching accounts found
                    </strong>
                    <span style={{ fontSize: 12, color: '#64748b' }}>
                      Adjust your search keyword or selection filters.
                    </span>
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((account) => (
                  <tr key={account.id} style={styles.tr}>
                    <td style={styles.td}>
                      <div style={styles.accountCell}>
                        <div
                          style={{
                            ...styles.avatar,
                            ...(account.role === 'Super Admin'
                              ? styles.superAdminAvatar
                              : account.role === 'Admin'
                              ? styles.adminAvatar
                              : styles.farmerAvatar)
                          }}
                        >
                          {account.name.charAt(0).toUpperCase()}
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <div style={styles.accountName}>{account.name}</div>
                          <div style={styles.accountEmail}>
                            <Mail size={13} />
                            {account.email}
                          </div>
                          <div style={styles.accountId}>ID: {account.id}</div>
                        </div>
                      </div>
                    </td>

                    <td style={styles.td}>
                      <div style={styles.locationCell}>
                        <MapPin size={15} color="#64748b" />
                        <span>{account.location}</span>
                      </div>
                    </td>

                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.roleBadge,
                          ...(account.role === 'Super Admin'
                            ? styles.superAdminBadge
                            : account.role === 'Admin'
                            ? styles.adminBadge
                            : styles.farmerBadge)
                        }}
                      >
                        {account.role === 'Super Admin' && (
                          <Crown size={12} style={{ marginRight: 4 }} />
                        )}
                        {account.role === 'Admin' && (
                          <ShieldCheck size={12} style={{ marginRight: 4 }} />
                        )}
                        {account.role === 'Farmer' && (
                          <User size={12} style={{ marginRight: 4 }} />
                        )}
                        {account.role}
                      </span>
                    </td>

                    <td style={styles.td}>
                      <div style={styles.dateCell}>
                        <Clock3 size={14} color="#64748b" />
                        {account.createdAt}
                      </div>
                    </td>

                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.statusBadge,
                          ...(account.status === 'Inactive'
                            ? styles.inactiveBadge
                            : styles.activeBadge)
                        }}
                      >
                        <span
                          style={{
                            ...styles.statusDot,
                            ...(account.status === 'Inactive'
                              ? styles.inactiveDot
                              : styles.activeDot)
                          }}
                        />
                        {account.status ?? 'Active'}
                      </span>
                    </td>

                    <td style={styles.td}>
                      <div style={styles.actions}>
                        <button
                          type="button"
                          title="Edit Account"
                          aria-label={`Edit ${account.name}`}
                          onClick={() => openEditModal(account)}
                          style={styles.editButton}
                        >
                          <Pencil size={15} />
                        </button>

                        <button
                          type="button"
                          title="Delete Account"
                          aria-label={`Delete ${account.name}`}
                          onClick={() => setDeleteTarget(account)}
                          style={styles.deleteButton}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={styles.footer}>
          Showing <strong>{filteredAccounts.length}</strong> of <strong>{accounts.length}</strong> registered accounts
        </div>
      </section>

      {/* Add / Edit Account Modal */}
      {showModal && (
        <div
          style={styles.overlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-modal-title"
            style={styles.modal}
          >
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={styles.modalIcon}>
                  {editingAccount ? <Pencil size={20} /> : <UserPlus size={20} />}
                </div>

                <div>
                  <h2 id="account-modal-title" style={styles.modalTitle}>
                    {editingAccount ? 'Edit Account Credentials' : 'Create New Account'}
                  </h2>

                  <p style={styles.modalSubtitle}>
                    {editingAccount
                      ? 'Modify permissions, identity details, or update system password.'
                      : 'Provision a new user account with specific role rights.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeModal}
                style={styles.closeButton}
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            {notice && (
              <div
                style={{
                  ...styles.notice,
                  margin: '16px 24px 0',
                  ...(notice.type === 'success' ? styles.successNotice : styles.errorNotice)
                }}
              >
                {notice.type === 'success' ? (
                  <CheckCircle2 size={17} />
                ) : (
                  <AlertTriangle size={17} />
                )}
                <span>{notice.message}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ padding: 24 }}>
              <div className="aquasense-account-form-grid" style={styles.formGrid}>
                {/* ID Field */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Account ID <span style={styles.requiredStar}>*</span>
                  </label>
                  <input
                    value={form.id}
                    onChange={(event) => updateForm('id', event.target.value)}
                    placeholder="e.g. USR-001"
                    style={styles.input}
                    disabled={Boolean(editingAccount)}
                    required
                  />
                </div>

                {/* Name Field */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Full Name <span style={styles.requiredStar}>*</span>
                  </label>
                  <input
                    value={form.name}
                    onChange={(event) => updateForm('name', event.target.value)}
                    placeholder="Enter user's full name"
                    style={styles.input}
                    required
                  />
                </div>

                {/* Email Field */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Email Address <span style={styles.requiredStar}>*</span>
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => updateForm('email', event.target.value)}
                    placeholder="name@aquasense.io"
                    style={styles.input}
                    required
                  />
                </div>

                {/* Location Field */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Location / Station <span style={styles.requiredStar}>*</span>
                  </label>
                  <input
                    value={form.location}
                    onChange={(event) => updateForm('location', event.target.value)}
                    placeholder="e.g. Cagayan de Oro City"
                    style={styles.input}
                    required
                  />
                </div>

                {/* Role Field */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Role & Permissions <span style={styles.requiredStar}>*</span>
                  </label>
                  <select
                    value={form.role}
                    onChange={(event) =>
                      updateForm('role', event.target.value as AccountRole)
                    }
                    style={styles.input}
                  >
                    <option value="Farmer">Farmer (Telemetry & Readings View)</option>
                    <option value="Admin">Admin (System Operations & Management)</option>
                    <option value="Super Admin">Super Admin (Full Administrative Authority)</option>
                  </select>
                </div>

                {/* Status Field */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Account Status</label>
                  <select
                    value={form.status}
                    onChange={(event) =>
                      updateForm('status', event.target.value as AccountStatus)
                    }
                    style={styles.input}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                {/* Password Input */}
                <div style={{ ...styles.formGroup, gridColumn: '1 / -1' }}>
                  <label style={styles.label}>
                    {editingAccount ? 'New Password (Optional)' : 'Account Password'}{' '}
                    {!editingAccount && <span style={styles.requiredStar}>*</span>}
                  </label>

                  <div style={styles.passwordWrapper}>
                    <Lock size={17} color="#64748b" style={styles.passwordIcon} />

                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={(event) => updateForm('password', event.target.value)}
                      placeholder={
                        editingAccount
                          ? 'Leave empty to keep existing password'
                          : 'Minimum 6 characters'
                      }
                      style={{
                        ...styles.input,
                        paddingLeft: 42,
                        paddingRight: 44
                      }}
                      required={!editingAccount}
                      minLength={editingAccount ? 0 : 6}
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      style={styles.passwordToggle}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>
              </div>

              <div style={styles.modalActions}>
                <button
                  type="button"
                  onClick={closeModal}
                  style={styles.cancelButton}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>

                <button type="submit" style={styles.saveButton} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <RefreshCw size={17} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={17} />
                  )}
                  {editingAccount ? 'Save Changes' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <div style={styles.overlay}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            style={styles.deleteModal}
          >
            <div style={styles.warningIcon}>
              <ShieldAlert size={26} color="#ef4444" />
            </div>

            <h2 id="delete-account-title" style={styles.deleteTitle}>
              Delete Account?
            </h2>

            <p style={styles.deleteText}>
              Are you sure you want to permanently remove <strong>{deleteTarget.name}</strong> ({deleteTarget.email})? This operation will remove access privileges and cannot be undone.
            </p>

            <div style={styles.deleteActions}>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                style={styles.cancelButton}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmDelete}
                style={styles.confirmDeleteButton}
              >
                <Trash2 size={16} />
                Confirm Deletion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    width: '100%',
    minHeight: '100%',
    boxSizing: 'border-box',
    padding: '28px',
    background: '#f8fafc',
    color: '#0f172a'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 20,
    marginBottom: 24
  },
  eyebrow: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    color: '#2563eb',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.12em',
    marginBottom: 8
  },
  title: {
    margin: 0,
    fontSize: 27,
    fontWeight: 800,
    letterSpacing: '-0.02em'
  },
  subtitle: {
    margin: '7px 0 0',
    color: '#64748b',
    fontSize: 14
  },
  primaryButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    border: 0,
    borderRadius: 9,
    padding: '11px 17px',
    background: '#2563eb',
    color: '#fff',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    boxShadow: '0 5px 15px rgba(37, 99, 235, 0.20)'
  },
  notice: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 16px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 16
  },
  successNotice: {
    background: '#ecfdf5',
    color: '#047857',
    border: '1px solid #a7f3d0'
  },
  errorNotice: {
    background: '#fef2f2',
    color: '#b91c1c',
    border: '1px solid #fecaca'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 14,
    marginBottom: 18
  },
  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 13,
    minHeight: 84,
    padding: '16px 18px',
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 11,
    boxSizing: 'border-box'
  },
  statIcon: {
    width: 42,
    height: 42,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10
  },
  statLabel: {
    fontSize: 10,
    fontWeight: 800,
    color: '#64748b',
    letterSpacing: '0.07em'
  },
  statValue: {
    marginTop: 4,
    fontSize: 23,
    fontWeight: 800,
    color: '#0f172a'
  },
  panel: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)'
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
    borderBottom: '1px solid #e2e8f0',
    flexWrap: 'wrap'
  },
  searchBox: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    flex: 1,
    minWidth: 260,
    height: 40,
    padding: '0 12px',
    border: '1px solid #dbe2ea',
    borderRadius: 8,
    background: '#f8fafc'
  },
  searchInput: {
    width: '100%',
    border: 0,
    outline: 0,
    background: 'transparent',
    color: '#0f172a',
    fontSize: 13
  },
  clearSearch: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 0,
    background: 'transparent',
    cursor: 'pointer',
    color: '#64748b'
  },
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 10
  },
  filterSelect: {
    height: 40,
    padding: '0 12px',
    border: '1px solid #dbe2ea',
    borderRadius: 8,
    background: '#f8fafc',
    color: '#0f172a',
    fontSize: 13,
    outline: 0,
    cursor: 'pointer'
  },
  tableWrapper: {
    width: '100%',
    overflowX: 'auto'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: 13
  },
  th: {
    padding: '12px 16px',
    background: '#f8fafc',
    color: '#64748b',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.05em',
    borderBottom: '1px solid #e2e8f0',
    whiteSpace: 'nowrap'
  },
  tr: {
    borderBottom: '1px solid #f1f5f9'
  },
  td: {
    padding: '14px 16px',
    verticalAlign: 'middle',
    color: '#0f172a'
  },
  accountCell: {
    display: 'flex',
    alignItems: 'center',
    gap: 12
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: 14,
    flexShrink: 0
  },
  farmerAvatar: {
    background: '#ecfdf5',
    color: '#047857',
    border: '1px solid #a7f3d0'
  },
  adminAvatar: {
    background: '#f0f9ff',
    color: '#0284c7',
    border: '1px solid #bae6fd'
  },
  superAdminAvatar: {
    background: '#f3e8ff',
    color: '#7e22ce',
    border: '1px solid #e9d5ff'
  },
  accountName: {
    fontWeight: 700,
    color: '#0f172a',
    fontSize: 14
  },
  accountEmail: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    color: '#64748b',
    fontSize: 12,
    marginTop: 2
  },
  accountId: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 1
  },
  locationCell: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: '#334155',
    fontSize: 13
  },
  roleBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: 'nowrap'
  },
  farmerBadge: {
    background: '#ecfdf5',
    color: '#047857'
  },
  adminBadge: {
    background: '#f0f9ff',
    color: '#0284c7'
  },
  superAdminBadge: {
    background: '#f3e8ff',
    color: '#7e22ce'
  },
  dateCell: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: '#64748b',
    fontSize: 12
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600
  },
  activeBadge: {
    background: '#f0fdf4',
    color: '#166534'
  },
  inactiveBadge: {
    background: '#fef2f2',
    color: '#991b1b'
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: '50%'
  },
  activeDot: {
    background: '#22c55e'
  },
  inactiveDot: {
    background: '#ef4444'
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8
  },
  editButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    background: '#fff',
    color: '#334155',
    cursor: 'pointer'
  },
  deleteButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    border: '1px solid #fee2e2',
    borderRadius: 6,
    background: '#fff',
    color: '#ef4444',
    cursor: 'pointer'
  },
  emptyCell: {
    textAlign: 'center',
    padding: '48px 16px',
    color: '#475569'
  },
  footer: {
    padding: '12px 16px',
    background: '#f8fafc',
    borderTop: '1px solid #e2e8f0',
    color: '#64748b',
    fontSize: 12
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.45)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 16
  },
  modal: {
    width: '100%',
    maxWidth: 620,
    background: '#fff',
    borderRadius: 14,
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    overflow: 'hidden'
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: '1px solid #e2e8f0',
    background: '#f8fafc'
  },
  modalIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    background: '#eff6ff',
    color: '#2563eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  modalTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
    color: '#0f172a'
  },
  modalSubtitle: {
    margin: '2px 0 0',
    fontSize: 12,
    color: '#64748b'
  },
  closeButton: {
    border: 0,
    background: 'transparent',
    color: '#64748b',
    cursor: 'pointer',
    padding: 4,
    borderRadius: 6
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 16
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6
  },
  label: {
    fontSize: 12,
    fontWeight: 700,
    color: '#334155'
  },
  requiredStar: {
    color: '#ef4444'
  },
  input: {
    height: 40,
    padding: '0 12px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    outline: 0,
    fontSize: 13,
    color: '#0f172a',
    width: '100%',
    boxSizing: 'border-box'
  },
  passwordWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  },
  passwordIcon: {
    position: 'absolute',
    left: 12,
    pointerEvents: 'none'
  },
  passwordToggle: {
    position: 'absolute',
    right: 12,
    border: 0,
    background: 'transparent',
    color: '#64748b',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center'
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 24
  },
  cancelButton: {
    padding: '9px 16px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#334155',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer'
  },
  saveButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '9px 18px',
    borderRadius: 8,
    border: 0,
    background: '#2563eb',
    color: '#fff',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer'
  },
  deleteModal: {
    width: '100%',
    maxWidth: 420,
    background: '#fff',
    borderRadius: 14,
    padding: 24,
    textAlign: 'center',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
  },
  warningIcon: {
    width: 52,
    height: 52,
    borderRadius: '50%',
    background: '#fef2f2',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px'
  },
  deleteTitle: {
    margin: 0,
    fontSize: 19,
    fontWeight: 700,
    color: '#0f172a'
  },
  deleteText: {
    margin: '10px 0 24px',
    fontSize: 13,
    color: '#64748b',
    lineHeight: 1.5
  },
  deleteActions: {
    display: 'flex',
    justifyContent: 'center',
    gap: 12
  },
  confirmDeleteButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '9px 18px',
    borderRadius: 8,
    border: 0,
    background: '#ef4444',
    color: '#fff',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer'
  }
};