import clsx from 'clsx';
import type { ReactNode } from 'react';

export const fmt = (n: number) =>
  `${Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ETB`;

const pad = (n: number) => String(n).padStart(2, '0');

export const localDate = (date: Date = new Date()) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const localDateTime = (date: Date, hours = 0, minutes = 0) =>
  `${localDate(date)}T${pad(hours)}:${pad(minutes)}`;

export function itemRows(detail: any[]) {
  const rows: any[] = [];

  for (const order of detail || []) {
    const items = order.items || [];
    items.forEach((item: any, index: number) => {
      rows.push({
        Order: index === 0 ? `#${order.orderId}` : '',
        Table: index === 0 ? order.table : '',
        Item: item.name,
        Qty: item.quantity,
        'Unit Price (ETB)': Number(item.unitPrice),
        'Amount (ETB)': Number(item.unitPrice) * item.quantity,
      });
    });
    if (!items.length) {
      rows.push({
        Order: `#${order.orderId}`,
        Table: order.table,
        Item: '—',
        Qty: '',
        'Unit Price (ETB)': '',
        'Amount (ETB)': Number(order.amount),
      });
    }
  }

  return rows;
}

export function StatCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="bg-white border border-teal-900/10 rounded-2xl p-5 shadow-sm flex flex-col justify-center">
      <p className="text-[10px] text-teal-800/60 uppercase tracking-widest font-semibold mb-1.5">
        {label}
      </p>
      <p
        className={clsx(
          'text-2xl font-display font-medium',
          highlight ? 'text-gold-600' : 'text-teal-950',
        )}
      >
        {value}
      </p>
    </div>
  );
}