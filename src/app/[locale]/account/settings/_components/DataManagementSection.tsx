'use client';

import { useState } from 'react';
import { Card, CardBody, Button, Alert, Input, Modal } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';

interface DataManagementSectionProps {
  hasPassword: boolean;
}

export function DataManagementSection({ hasPassword }: DataManagementSectionProps) {
  const { signOut } = useAuth();

  // Export state
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState('');

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteChecked, setDeleteChecked] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  async function handleExport() {
    setExportError('');
    setExportLoading(true);

    try {
      const res = await fetch('/api/account/export-data', {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setExportError(data?.error || 'Something went wrong. Please try again');
        setExportLoading(false);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stg-data-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError('Something went wrong. Please try again');
    }

    setExportLoading(false);
  }

  function openDeleteModal() {
    setDeleteConfirm('');
    setDeleteChecked(false);
    setDeleteError('');
    setShowDeleteModal(true);
  }

  async function handleDelete() {
    setDeleteError('');
    setDeleteLoading(true);

    try {
      const body: Record<string, string> = {};
      if (hasPassword) {
        body.password = deleteConfirm;
      }

      const res = await fetch('/api/account/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify(body),
      });

      if (res.status === 409) {
        const data = await res.json().catch(() => null);
        const reasons = data?.reasons;
        if (reasons && Array.isArray(reasons)) {
          setDeleteError(reasons.join('. '));
        } else {
          setDeleteError(data?.error || 'Your account cannot be deleted at this time');
        }
        setDeleteLoading(false);
        return;
      }

      if (res.ok) {
        // Use AuthContext signOut (browser client) so navbar state clears immediately
        await signOut();
        return;
      }

      const data = await res.json().catch(() => null);
      setDeleteError(data?.error || 'Something went wrong. Please try again');
    } catch {
      setDeleteError('Something went wrong. Please try again');
    }

    setDeleteLoading(false);
  }

  const deleteDisabled =
    !deleteChecked ||
    (hasPassword ? !deleteConfirm : deleteConfirm !== 'DELETE');

  return (
    <>
      <Card>
        <CardBody>
          <h2 className="text-base font-semibold text-semantic-text-heading mb-4">
            Data and privacy
          </h2>

          {/* Data export */}
          <p className="text-sm text-semantic-text-muted mb-3">
            Download a copy of all your data including your profile, listings, orders, and messages.
          </p>
          <Button
            variant="secondary"
            size="sm"
            loading={exportLoading}
            onClick={handleExport}
          >
            {exportLoading ? 'Preparing...' : 'Download my data'}
          </Button>
          {exportError && (
            <Alert variant="error" className="mt-3">{exportError}</Alert>
          )}

          {/* Account deletion */}
          <div className="border-t border-semantic-border-subtle pt-4 mt-4">
            <p className="text-sm text-semantic-text-muted mb-3">
              Permanently delete your account and personal data. Your order history will be retained in anonymized form for tax compliance.
            </p>
            <Button variant="danger" size="sm" onClick={openDeleteModal}>
              Delete my account
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Delete confirmation modal */}
      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete your account"
      >
        <div className="space-y-4">
          <Alert variant="error">
            This action is permanent and cannot be undone. Your profile will be anonymized, active listings will be deactivated, and you will be signed out.
          </Alert>

          {hasPassword ? (
            <Input
              id="deletePassword"
              type="password"
              label="Enter your password to confirm"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              autoComplete="current-password"
            />
          ) : (
            <Input
              id="deleteConfirmText"
              label="Type DELETE to confirm"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
            />
          )}

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={deleteChecked}
              onChange={(e) => setDeleteChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-semantic-border-default text-semantic-primary focus:ring-semantic-border-focus"
            />
            <span className="text-sm text-semantic-text-primary">
              I understand that this action cannot be undone
            </span>
          </label>

          {deleteError && (
            <Alert variant="error">{deleteError}</Alert>
          )}

          <div className="flex gap-3 justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowDeleteModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={deleteLoading}
              disabled={deleteDisabled}
              onClick={handleDelete}
            >
              {deleteLoading ? 'Deleting...' : 'Delete my account'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
