import { describe, it, expect } from 'vitest';
import { isTaskOverdue, getLocalTodayString } from '../utils/date.ts';

describe('Overdue Logic (Requirement 2)', () => {
  const fixedToday = '2026-10-04';
  const yesterday = '2026-10-03';
  const tomorrow = '2026-10-05';

  it('evaluates today due date as not overdue', () => {
    expect(isTaskOverdue(fixedToday, 'todo', fixedToday)).toBe(false);
    expect(isTaskOverdue(`${fixedToday}T18:00:00.000Z`, 'in-progress', fixedToday)).toBe(false);
  });

  it('evaluates yesterday due date as overdue when task status is not done', () => {
    expect(isTaskOverdue(yesterday, 'todo', fixedToday)).toBe(true);
    expect(isTaskOverdue(`${yesterday}T09:30:00.000Z`, 'in-progress', fixedToday)).toBe(true);
  });

  it('evaluates tomorrow due date as not overdue', () => {
    expect(isTaskOverdue(tomorrow, 'todo', fixedToday)).toBe(false);
    expect(isTaskOverdue(`${tomorrow}T12:00:00.000Z`, 'in-progress', fixedToday)).toBe(false);
  });

  it('evaluates done task with yesterday due date as not overdue', () => {
    expect(isTaskOverdue(yesterday, 'done', fixedToday)).toBe(false);
    expect(isTaskOverdue(`${yesterday}T12:00:00.000Z`, 'done', fixedToday)).toBe(false);
  });

  it('evaluates null or undefined due date as not overdue', () => {
    expect(isTaskOverdue(null, 'todo', fixedToday)).toBe(false);
    expect(isTaskOverdue(undefined, 'todo', fixedToday)).toBe(false);
  });

  it('returns valid local today string in YYYY-MM-DD format', () => {
    const today = getLocalTodayString();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
