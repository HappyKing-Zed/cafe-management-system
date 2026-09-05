import axios from 'axios';

type ApiErrorBody = {
  message?: string | string[];
};

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError<ApiErrorBody>(error)) return fallback;

  const message = error.response?.data?.message;
  return Array.isArray(message) ? message.join(', ') : message || fallback;
}