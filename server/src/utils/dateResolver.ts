import { escapeRegex } from '../validation/task.validation.js';

export interface ZonedDateParts {
  dateStr: string; // YYYY-MM-DD
  weekday: string; // e.g. "Tuesday"
  year: number;
  month: number;
  day: number;
}

/**
 * Computes calendar date parts in the target IANA timezone.
 */
export const getZonedTodayParts = (now: Date, timeZone: string): ZonedDateParts => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const yearStr = get('year');
  const monthStr = get('month');
  const dayStr = get('day');
  const weekday = get('weekday');
  const dateStr = `${yearStr}-${monthStr}-${dayStr}`;

  return {
    dateStr,
    weekday,
    year: Number(yearStr),
    month: Number(monthStr),
    day: Number(dayStr),
  };
};

/**
 * Performs calendar date arithmetic via UTC date components (Y-M-D).
 * Avoids millisecond or 24h addition to prevent DST shifts.
 */
export const addDaysToDateStr = (dateStr: string, daysToAdd: number): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + daysToAdd);
  const nextY = date.getUTCFullYear();
  const nextM = String(date.getUTCMonth() + 1).padStart(2, '0');
  const nextD = String(date.getUTCDate()).padStart(2, '0');
  return `${nextY}-${nextM}-${nextD}`;
};

/**
 * Formats a Date or YYYY-MM-DD string into plain words like "Wed, 7 Oct".
 * Uses noon UTC on the calendar date so the calendar date cannot shift.
 */
export const formatDueDatePlain = (dateOrStr: Date | string, _timeZone?: string): string => {
  const dateStr = typeof dateOrStr === 'string' ? dateOrStr.slice(0, 10) : dateOrStr.toISOString().slice(0, 10);
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

  const parts = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('weekday')}, ${get('day')} ${get('month')}`;
};

const WEEKDAY_MAP: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const PAST_TENSE_REGEX = /\b(?:tha|thi|the|thay|thii|was|were|did|had)\b/i;

const TIME_OF_DAY_REGEX = /\b(?:late\s+evening|early\s+morning|morning|afternoon|evening|night|\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i;

export interface DateResolutionResult {
  matchCount: number;
  resolvedDate: string | null;
  matchedPhrase: string | null;
}

/**
 * Scans the message for supported relative date phrases.
 * If excludeTitle is provided, date words occurring within the title are ignored.
 * Returns matchCount, resolvedDate, and matchedPhrase.
 * Only resolves a date if matchCount === 1.
 */
export const resolveRelativeDate = (
  message: string,
  todayStr: string,
  excludeTitle?: string
): DateResolutionResult => {
  if (!message || !todayStr) {
    return { matchCount: 0, resolvedDate: null, matchedPhrase: null };
  }

  const isPastTense = PAST_TENSE_REGEX.test(message);

  // Compute title span in message to avoid matching date words inside task title (e.g. "Friday movie")
  let titleStart = -1;
  let titleEnd = -1;
  if (excludeTitle && excludeTitle.trim()) {
    const idx = message.toLowerCase().indexOf(excludeTitle.toLowerCase());
    if (idx !== -1) {
      titleStart = idx;
      titleEnd = idx + excludeTitle.length;
    }
  }

  // Ordered pattern alternatives so longer phrases (e.g. "day after tomorrow") match before "tomorrow"
  const patternList = [
    '(?<dayAfterTomorrow>\\b(?:the\\s+)?day\\s+after\\s+tomorrow\\b)',
    '(?<inDays>\\bin\\s+(\\d+)\\s+days?\\b)',
    '(?<inWeeks>\\bin\\s+(\\d+)\\s+weeks?\\b)',
    '(?<nextWeek>\\bnext\\s+week\\b)',
    '(?<weekday>\\b(?:(?:on|by|due|for|next)\\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\\b)',
    '(?<today>\\b(?:today|aaj)\\b)',
    '(?<tomorrow>\\btomorrow\\b)',
  ];

  if (!isPastTense) {
    patternList.push('(?<kal>\\bkal\\b)', '(?<parso>\\bparso\\b)');
  }

  const combinedRegex = new RegExp(patternList.join('|'), 'gi');

  const matches: Array<{ phrase: string; compute: () => string }> = [];
  let execMatch: RegExpExecArray | null;

  while ((execMatch = combinedRegex.exec(message)) !== null) {
    const matchIndex = execMatch.index;
    const matchLength = execMatch[0].length;

    // If this match is inside the excluded title, ignore it
    if (titleStart !== -1 && matchIndex >= titleStart && matchIndex + matchLength <= titleEnd) {
      continue;
    }

    const matchedText = execMatch[0];
    const groups = execMatch.groups ?? {};

    if (groups.dayAfterTomorrow) {
      matches.push({ phrase: matchedText, compute: () => addDaysToDateStr(todayStr, 2) });
    } else if (groups.inDays) {
      const daysMatch = matchedText.match(/in\s+(\d+)\s+days?/i);
      const days = daysMatch ? Number(daysMatch[1]) : 0;
      matches.push({ phrase: matchedText, compute: () => addDaysToDateStr(todayStr, days) });
    } else if (groups.inWeeks) {
      const weeksMatch = matchedText.match(/in\s+(\d+)\s+weeks?/i);
      const weeks = weeksMatch ? Number(weeksMatch[1]) : 0;
      matches.push({ phrase: matchedText, compute: () => addDaysToDateStr(todayStr, weeks * 7) });
    } else if (groups.nextWeek) {
      // "next week" means coming Monday strictly after today
      matches.push({
        phrase: matchedText,
        compute: () => {
          const [y, m, d] = todayStr.split('-').map(Number);
          const currentDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
          let diff = (1 - currentDay + 7) % 7;
          if (diff === 0) diff = 7;
          return addDaysToDateStr(todayStr, diff);
        },
      });
    } else if (groups.weekday) {
      const isBare = !/^(?:next|on|by|due|for)\s+/i.test(matchedText);
      if (isBare) {
        const followingText = message.slice(matchIndex + matchedText.length);
        const followingWordMatch = followingText.match(/^\s+([a-zA-Z]+)/);
        if (followingWordMatch) {
          const nextWord = followingWordMatch[1].toLowerCase();
          const isTimeWord = /^(?:morning|afternoon|evening|night|early|late|at|am|pm)$/i.test(nextWord);
          if (!isTimeWord) {
            continue;
          }
        }
      }
      const nameMatch = matchedText.match(/(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
      const name = nameMatch ? nameMatch[0].toLowerCase() : '';
      const targetDay = WEEKDAY_MAP[name];
      matches.push({
        phrase: matchedText,
        compute: () => {
          const [y, m, d] = todayStr.split('-').map(Number);
          const currentDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
          let diff = (targetDay - currentDay + 7) % 7;
          if (diff === 0) diff = 7;
          return addDaysToDateStr(todayStr, diff);
        },
      });
    } else if (groups.today) {
      matches.push({ phrase: matchedText, compute: () => todayStr });
    } else if (groups.tomorrow || groups.kal) {
      matches.push({ phrase: matchedText, compute: () => addDaysToDateStr(todayStr, 1) });
    } else if (groups.parso) {
      matches.push({ phrase: matchedText, compute: () => addDaysToDateStr(todayStr, 2) });
    }
  }

  if (matches.length !== 1) {
    return {
      matchCount: matches.length,
      resolvedDate: null,
      matchedPhrase: null,
    };
  }

  return {
    matchCount: 1,
    resolvedDate: matches[0].compute(),
    matchedPhrase: matches[0].phrase,
  };
};

/**
 * Removes only the exact matched date phrase from the description.
 * Never touches the title, and falls back to original text if the result would be empty or broken.
 */
export const cleanDescription = (description: string, matchedPhrase: string): string => {
  if (!description || !matchedPhrase) return description;

  const escaped = escapeRegex(matchedPhrase);
  // Match the phrase as whole word(s)
  const regex = new RegExp(`\\b${escaped}\\b`, 'i');
  if (!regex.test(description)) return description;

  const withoutPhrase = description.replace(regex, '');
  const normalized = withoutPhrase.replace(/\s+/g, ' ').trim();

  // If empty or only punctuation (broken), fall back to original description
  if (!normalized || !/[a-zA-Z0-9]/.test(normalized)) {
    return description;
  }

  return normalized;
};

/**
 * Extracts time-of-day phrases like "late evening", "morning", "5pm" from text.
 */
export const extractTimeOfDayNote = (text: string): string | null => {
  if (!text) return null;
  const match = text.match(TIME_OF_DAY_REGEX);
  return match ? match[0] : null;
};

/**
 * Conservatively cleans matched date phrase and/or time note from a task title.
 * Strips matched phrases only from edges (beginning or end).
 * Preserves words in the middle (e.g. "Watch Friday movie" -> "Watch Friday movie").
 * Returns empty string if the title would become empty or broken after cleaning a date phrase.
 */
export const cleanTaskTitle = (
  rawTitle: string,
  matchedPhrase?: string | null,
  timeNote?: string | null
): string => {
  if (!rawTitle) return '';
  let cleaned = rawTitle;

  const stripFromEdges = (text: string, phrase: string): string => {
    if (!phrase) return text;
    const escaped = escapeRegex(phrase);
    const endRegex = new RegExp(`(?:\\s+(?:due|on|by|for|at)\\s+|\\s+)?\\b${escaped}\\b[\\s,.:;-]*$`, 'i');
    if (endRegex.test(text)) {
      return text.replace(endRegex, '');
    }
    const startRegex = new RegExp(`^[\\s,.:;-]*\\b${escaped}\\b(?:\\s+(?:to|do)\\s+|[\\s,.:;-]+|\\s+)?`, 'i');
    if (startRegex.test(text)) {
      return text.replace(startRegex, '');
    }
    return text;
  };

  let strippedAny = false;
  if (timeNote) {
    const after = stripFromEdges(cleaned, timeNote);
    if (after !== cleaned) {
      cleaned = after;
      strippedAny = true;
    }
  }
  if (matchedPhrase) {
    const after = stripFromEdges(cleaned, matchedPhrase);
    if (after !== cleaned) {
      cleaned = after;
      strippedAny = true;
    }
  }

  const normalized = cleaned.replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, '').replace(/\s+/g, ' ').trim();
  if (normalized.length >= 2 && /[a-zA-Z0-9]/.test(normalized)) {
    return normalized;
  }
  if (strippedAny) {
    return '';
  }
  return rawTitle.trim();
};

