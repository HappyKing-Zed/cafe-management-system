import { redirect } from 'next/navigation';

export default function SummaryRedirect() {
  redirect('/dashboard/reports');
}
