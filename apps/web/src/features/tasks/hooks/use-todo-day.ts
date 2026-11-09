import { getRouteApi } from '@tanstack/react-router';
import { useToday } from './use-today';

const todo = getRouteApi('/_authenticated/plan/todo');

/** The day To do lists (today when the address names none), and today. */
export function useTodoDay() {
  const { date } = todo.useSearch();
  const today = useToday();
  return { day: date ?? today, today };
}
