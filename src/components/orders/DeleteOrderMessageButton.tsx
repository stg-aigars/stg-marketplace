'use client';

import { DeleteItemButton } from '@/components/ui';
import { deleteOrderMessage } from '@/lib/order-messages/actions';

interface DeleteOrderMessageButtonProps {
  messageId: string;
  orderId: string;
}

export function DeleteOrderMessageButton({ messageId, orderId }: DeleteOrderMessageButtonProps) {
  return (
    <DeleteItemButton
      onDelete={() => deleteOrderMessage(messageId, orderId)}
      title="Remove message"
    />
  );
}
