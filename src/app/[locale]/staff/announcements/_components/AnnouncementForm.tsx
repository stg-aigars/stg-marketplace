'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Card, CardBody, Input, Modal, Textarea } from '@/components/ui';
import { AnnouncementMarkdown } from '@/components/announcements/AnnouncementMarkdown';
import {
  createAnnouncement,
  updateAnnouncement,
  publishAnnouncement,
  unpublishAnnouncement,
  softDeleteAnnouncement,
} from '@/lib/announcements/actions';
import { slugifyTitle } from '@/lib/announcements/slug';

type Mode =
  | { mode: 'new' }
  | {
      mode: 'edit';
      id: string;
      initial: { title: string; slug: string; bodyMarkdown: string };
      slugLocked: boolean;
      isPublished: boolean;
      isDeleted: boolean;
    };

type Props = Mode;

export function AnnouncementForm(props: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(props.mode === 'edit' ? props.initial.title : '');
  const [slug, setSlug] = useState(props.mode === 'edit' ? props.initial.slug : '');
  const [body, setBody] = useState(props.mode === 'edit' ? props.initial.bodyMarkdown : '');
  const [slugAutoFromTitle, setSlugAutoFromTitle] = useState(props.mode === 'new');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const slugLocked = props.mode === 'edit' && props.slugLocked;

  function handleTitleChange(next: string) {
    setTitle(next);
    if (slugAutoFromTitle && !slugLocked) {
      setSlug(slugifyTitle(next));
    }
  }

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      if (props.mode === 'new') {
        const result = await createAnnouncement({
          title,
          slug: slug.trim() || undefined,
          bodyMarkdown: body,
        });
        if ('error' in result) {
          setError(humanizeError(result.error));
          return;
        }
        router.push(`/staff/announcements/${result.id}/edit`);
      } else {
        const result = await updateAnnouncement(props.id, {
          title,
          bodyMarkdown: body,
          // Only send slug when not locked AND it actually changed
          ...(slugLocked || slug === props.initial.slug ? {} : { slug }),
        });
        if ('error' in result) {
          setError(humanizeError(result.error));
          return;
        }
        router.refresh();
      }
    });
  }

  function handlePublish() {
    if (props.mode !== 'edit') return;
    setError(null);
    startTransition(async () => {
      const result = await publishAnnouncement(props.id);
      if ('error' in result) {
        setError(humanizeError(result.error));
        return;
      }
      router.refresh();
    });
  }

  function handleUnpublish() {
    if (props.mode !== 'edit') return;
    setError(null);
    startTransition(async () => {
      const result = await unpublishAnnouncement(props.id);
      if ('error' in result) {
        setError(humanizeError(result.error));
        return;
      }
      router.refresh();
    });
  }

  function handleDeleteConfirm() {
    if (props.mode !== 'edit') return;
    startTransition(async () => {
      const result = await softDeleteAnnouncement(props.id);
      if ('error' in result) {
        setError(humanizeError(result.error));
        setShowDeleteConfirm(false);
        return;
      }
      router.push('/staff/announcements');
    });
  }

  return (
    <>
      <form onSubmit={handleSave} className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}

        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={200}
          disabled={isPending}
        />

        <div>
          <Input
            label="Slug"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugAutoFromTitle(false);
            }}
            disabled={isPending || slugLocked}
            maxLength={80}
          />
          <p className="mt-1 text-xs text-semantic-text-muted">
            {slugLocked
              ? "Slug is locked after the first publish — notifications snapshotted this URL."
              : 'URL: /announcements/' + (slug || '…')}
          </p>
        </div>

        <div>
          <Textarea
            label="Body (markdown)"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={14}
            maxLength={20000}
            disabled={isPending}
          />
          <p className="mt-1 text-xs text-semantic-text-muted">
            Headings, bold, italic, links, lists, and code blocks supported. Inline image embeds aren&rsquo;t — link out to external images if needed.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" variant="secondary" disabled={isPending}>
            {isPending ? 'Saving…' : 'Save'}
          </Button>

          {props.mode === 'edit' && !props.isDeleted && (
            <>
              {props.isPublished ? (
                <Button type="button" variant="ghost" onClick={handleUnpublish} disabled={isPending}>
                  Unpublish
                </Button>
              ) : (
                <Button type="button" variant="brand" onClick={handlePublish} disabled={isPending}>
                  Publish
                </Button>
              )}
              <span className="grow" />
              <Button
                type="button"
                variant="danger"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isPending}
              >
                Delete
              </Button>
            </>
          )}
        </div>
      </form>

      {body.trim().length > 0 && (
        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-semantic-text-muted mb-2">
            Preview
          </p>
          <Card>
            <CardBody>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-4">
                {title || 'Untitled'}
              </h1>
              <AnnouncementMarkdown body={body} />
            </CardBody>
          </Card>
        </div>
      )}

      {props.mode === 'edit' && (
        <Modal
          open={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          title="Delete this announcement?"
        >
          <p className="text-sm text-semantic-text-secondary mb-4">
            The announcement disappears from the public list. Visitors who follow an old
            link see a &ldquo;no longer available&rdquo; page. Bell entries are cleared.
            This is a soft delete and can be reversed by staff if needed.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteConfirm}
              disabled={isPending}
            >
              {isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

function humanizeError(code: string): string {
  switch (code) {
    case 'forbidden':
      return 'You don’t have permission to do that.';
    case 'invalid_title':
      return 'Title must be between 1 and 200 characters.';
    case 'invalid_body':
      return 'Body must be between 1 and 20,000 characters.';
    case 'slug_empty':
      return 'Slug cannot be empty.';
    case 'slug_too_long':
      return 'Slug must be 80 characters or fewer.';
    case 'slug_invalid_chars':
      return 'Slug can only contain lowercase letters, numbers, and single dashes.';
    case 'slug_reserved':
      return 'That slug collides with a route segment. Pick another.';
    case 'slug_taken':
      return 'That slug is already in use. Pick another.';
    case 'slug_locked_after_notify':
      return 'Slug is locked after the first publish — notifications snapshotted this URL.';
    case 'not_found':
      return 'Announcement not found.';
    case 'create_failed':
    case 'update_failed':
    case 'publish_failed':
    case 'unpublish_failed':
    case 'delete_failed':
      return 'Something went wrong. Please try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
