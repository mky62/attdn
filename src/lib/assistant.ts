import { format } from 'date-fns';
import * as api from './api';
import { getSetting } from './settings';
import type { AttendanceRecord, AttendanceSession, Class, Student, StudentSummary } from '../types';

const OPENROUTER_CHAT_MODEL =
  import.meta.env.VITE_OPENROUTER_CHAT_MODEL?.trim() || 'openai/gpt-4o-mini';

export interface TeacherAssistantContext {
  classes: Class[];
  selectedClass: Class | null;
  students: Student[];
  sessions: AttendanceSession[];
  summary: StudentSummary[];
  latestSession: AttendanceSession | null;
  latestRecords: AttendanceRecord[];
}

export async function loadTeacherAssistantContext(
  selectedClassId?: string,
): Promise<TeacherAssistantContext> {
  const classes = await api.getClasses();
  const resolvedClassId = selectedClassId || classes[0]?.id || '';
  const selectedClass = classes.find((item) => item.id === resolvedClassId) ?? null;

  if (!selectedClass) {
    return {
      classes,
      selectedClass: null,
      students: [],
      sessions: [],
      summary: [],
      latestSession: null,
      latestRecords: [],
    };
  }

  const [students, sessions, summary] = await Promise.all([
    api.getStudents(selectedClass.id),
    api.getAttendanceSessions(selectedClass.id),
    api.getStudentSummary(selectedClass.id),
  ]);

  const latestSession = sessions[0] ?? null;
  const latestRecords = latestSession
    ? await api.getAttendanceRecords(latestSession.id)
    : [];

  return {
    classes,
    selectedClass,
    students,
    sessions,
    summary,
    latestSession,
    latestRecords,
  };
}

function buildPromptContext(context: TeacherAssistantContext): string {
  const underThreshold = context.summary
    .map((row) => ({
      name: row.student_name,
      rollNumber: row.roll_number,
      attendanceRate: row.total_sessions > 0
        ? Math.round((row.present_count / row.total_sessions) * 100)
        : 0,
      presentCount: row.present_count,
      totalSessions: row.total_sessions,
    }))
    .filter((row) => row.attendanceRate < 75)
    .sort((left, right) => left.attendanceRate - right.attendanceRate)
    .slice(0, 12);

  const latestSessionSnapshot = context.latestRecords.map((record) => ({
    studentName: record.student_name,
    rollNumber: record.roll_number,
    status: record.status,
  }));

  const topPerformers = context.summary
    .map((row) => ({
      name: row.student_name,
      rollNumber: row.roll_number,
      attendanceRate: row.total_sessions > 0
        ? Math.round((row.present_count / row.total_sessions) * 100)
        : 0,
    }))
    .sort((left, right) => right.attendanceRate - left.attendanceRate)
    .slice(0, 10);

  return JSON.stringify({
    generatedAt: format(new Date(), 'yyyy-MM-dd HH:mm'),
    selectedClass: context.selectedClass
      ? {
          id: context.selectedClass.id,
          name: context.selectedClass.name,
          section: context.selectedClass.section,
        }
      : null,
    counts: {
      classes: context.classes.length,
      students: context.students.length,
      sessions: context.sessions.length,
    },
    latestSession: context.latestSession
      ? {
          id: context.latestSession.id,
          date: context.latestSession.date,
          records: latestSessionSnapshot,
        }
      : null,
    attendanceSummary: context.summary.map((row) => ({
      name: row.student_name,
      rollNumber: row.roll_number,
      totalSessions: row.total_sessions,
      presentCount: row.present_count,
      attendanceRate: row.total_sessions > 0
        ? Math.round((row.present_count / row.total_sessions) * 100)
        : 0,
    })),
    under75Percent: underThreshold,
    topPerformers,
  });
}

function extractApiErrorMessage(payloadText: string): string {
  try {
    const parsed = JSON.parse(payloadText) as {
      error?: { message?: unknown };
      message?: unknown;
    };

    if (typeof parsed?.error?.message === 'string' && parsed.error.message.trim()) {
      return parsed.error.message.trim();
    }

    if (typeof parsed?.message === 'string' && parsed.message.trim()) {
      return parsed.message.trim();
    }
  } catch {
    // Fall back to raw text.
  }

  return payloadText.trim();
}

function formatAssistantError(status: number, payloadText: string): string {
  if (status === 401 || status === 403) {
    return 'Assistant authentication failed. Update the OpenRouter key in Settings.';
  }

  if (status === 429) {
    return 'Assistant rate limit reached. Try again in a moment.';
  }

  if (status >= 500) {
    return 'Assistant is temporarily unavailable.';
  }

  return extractApiErrorMessage(payloadText) || 'Assistant request failed.';
}

export async function sendTeacherAssistantMessage(
  context: TeacherAssistantContext,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<string> {
  const apiKey = await getSetting('openrouter_api_key');
  if (!apiKey) {
    throw new Error('Assistant needs an OpenRouter API key in Settings.');
  }

  const promptContext = buildPromptContext(context);
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENROUTER_CHAT_MODEL,
      temperature: 0.3,
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content:
            'You are a teacher assistant inside an attendance app. Answer only from the provided context. Be concise, practical, and structured. If information is missing, say it is not available in the current app data. Do not invent attendance records or student names. Prefer short paragraphs or short bullet lists when useful.',
        },
        {
          role: 'system',
          content: `App context:\n${promptContext}`,
        },
        ...messages,
      ],
    }),
  });

  if (!response.ok) {
    const payloadText = await response.text();
    throw new Error(formatAssistantError(response.status, payloadText));
  }

  const payload = await response.json() as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  return payload.choices?.[0]?.message?.content?.trim() || 'No response.';
}
