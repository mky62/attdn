import React, { useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type TabKey = 'dashboard' | 'attendance' | 'assistant' | 'settings';

type ClassItem = {
  id: string;
  name: string;
  section: string;
  students: number;
  sessions: number;
};

type StudentSummary = {
  id: string;
  name: string;
  rollNumber: string;
  present: number;
  total: number;
};

type SessionRecord = {
  id: string;
  date: string;
  absent: string[];
  presentCount: number;
};

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

const classes: ClassItem[] = [
  { id: '1', name: 'Class X', section: 'A', students: 32, sessions: 18 },
  { id: '2', name: 'Class IX', section: 'B', students: 28, sessions: 14 },
  { id: '3', name: 'Class VIII', section: 'C', students: 30, sessions: 11 },
];

const summariesByClass: Record<string, StudentSummary[]> = {
  '1': [
    { id: '1', name: 'Rajeev', rollNumber: '01', present: 12, total: 18 },
    { id: '2', name: 'Anita', rollNumber: '02', present: 17, total: 18 },
    { id: '3', name: 'Rahul', rollNumber: '03', present: 10, total: 18 },
    { id: '4', name: 'Meena', rollNumber: '04', present: 15, total: 18 },
  ],
  '2': [
    { id: '5', name: 'Soham', rollNumber: '05', present: 11, total: 14 },
    { id: '6', name: 'Tina', rollNumber: '06', present: 13, total: 14 },
    { id: '7', name: 'Nikhil', rollNumber: '07', present: 8, total: 14 },
  ],
  '3': [
    { id: '8', name: 'Pooja', rollNumber: '08', present: 9, total: 11 },
    { id: '9', name: 'Arjun', rollNumber: '09', present: 7, total: 11 },
  ],
};

const sessionsByClass: Record<string, SessionRecord[]> = {
  '1': [
    { id: 's1', date: '2026-04-23', absent: ['Rajeev', 'Rahul'], presentCount: 30 },
    { id: 's2', date: '2026-04-22', absent: ['Rahul'], presentCount: 31 },
  ],
  '2': [
    { id: 's3', date: '2026-04-23', absent: ['Nikhil'], presentCount: 27 },
  ],
  '3': [
    { id: 's4', date: '2026-04-23', absent: ['Arjun'], presentCount: 29 },
  ],
};

const quickPrompts = [
  'Summarize this class attendance.',
  'Who was absent in the latest session?',
  'Which students are below 75% attendance?',
  'How many sessions are recorded?',
];

function attendanceRate(item: StudentSummary) {
  if (item.total === 0) return 0;
  return Math.round((item.present / item.total) * 100);
}

function getAssistantReply(query: string, classItem: ClassItem | undefined) {
  if (!classItem) {
    return 'Select a class first.';
  }

  const summaries = summariesByClass[classItem.id] || [];
  const sessions = sessionsByClass[classItem.id] || [];
  const latestSession = sessions[0];
  const lowerQuery = query.toLowerCase();

  if (lowerQuery.includes('absent') && latestSession) {
    return latestSession.absent.length > 0
      ? `Latest session ${latestSession.date}: absent - ${latestSession.absent.join(', ')}.`
      : `Latest session ${latestSession.date}: no absentees.`;
  }

  if (lowerQuery.includes('75') || lowerQuery.includes('low attendance') || lowerQuery.includes('below')) {
    const lowAttendance = summaries.filter((item) => attendanceRate(item) < 75);
    return lowAttendance.length > 0
      ? `Below 75%: ${lowAttendance.map((item) => `${item.name} (${attendanceRate(item)}%)`).join(', ')}.`
      : 'No students are below 75% attendance.';
  }

  if (lowerQuery.includes('how many sessions') || lowerQuery.includes('sessions')) {
    return `${classItem.name} ${classItem.section}: ${classItem.sessions} sessions recorded.`;
  }

  const averageRate = summaries.length > 0
    ? Math.round(
        summaries.reduce((total, item) => total + attendanceRate(item), 0) / summaries.length,
      )
    : 0;

  return `${classItem.name} ${classItem.section}: ${classItem.students} students, ${classItem.sessions} sessions, average attendance ${averageRate}%.`;
}

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || '');
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'm1',
      role: 'assistant',
      content: 'Ask about summary, absentees, low attendance, or session counts.',
    },
  ]);

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === selectedClassId),
    [selectedClassId],
  );
  const selectedSummary = summariesByClass[selectedClassId] || [];
  const selectedSessions = sessionsByClass[selectedClassId] || [];

  const submitPrompt = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    const userMessage: Message = {
      id: `user-${messages.length + 1}`,
      role: 'user',
      content: trimmed,
    };
    const assistantMessage: Message = {
      id: `assistant-${messages.length + 2}`,
      role: 'assistant',
      content: getAssistantReply(trimmed, selectedClass),
    };

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setChatInput('');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Attdn Mobile</Text>
          <Text style={styles.title}>Teacher App</Text>
        </View>

        <View style={styles.classSwitcher}>
          {classes.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => setSelectedClassId(item.id)}
              style={[
                styles.classChip,
                item.id === selectedClassId && styles.classChipActive,
              ]}
            >
              <Text
                style={[
                  styles.classChipText,
                  item.id === selectedClassId && styles.classChipTextActive,
                ]}
              >
                {item.name} {item.section}
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === 'dashboard' && (
            <View style={styles.section}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{selectedClass?.name} {selectedClass?.section}</Text>
                <View style={styles.metricsRow}>
                  <MetricCard label="Students" value={String(selectedClass?.students || 0)} />
                  <MetricCard label="Sessions" value={String(selectedClass?.sessions || 0)} />
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Low Attendance</Text>
                {(selectedSummary.filter((item) => attendanceRate(item) < 75)).map((item) => (
                  <View key={item.id} style={styles.listRow}>
                    <Text style={styles.listName}>{item.name}</Text>
                    <Text style={styles.tagText}>{attendanceRate(item)}%</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {activeTab === 'attendance' && (
            <View style={styles.section}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Latest Session</Text>
                <Text style={styles.cardValue}>{selectedSessions[0]?.date || 'No session'}</Text>
                <Text style={styles.muted}>
                  Present: {selectedSessions[0]?.presentCount || 0}
                </Text>
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Absent</Text>
                {(selectedSessions[0]?.absent || []).map((name) => (
                  <View key={name} style={styles.listRow}>
                    <Text style={styles.listName}>{name}</Text>
                  </View>
                ))}
                {(!selectedSessions[0] || selectedSessions[0].absent.length === 0) && (
                  <Text style={styles.muted}>No absentees</Text>
                )}
              </View>
            </View>
          )}

          {activeTab === 'assistant' && (
            <View style={styles.section}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Teacher Assistant</Text>
                <View style={styles.promptWrap}>
                  {quickPrompts.map((prompt) => (
                    <Pressable
                      key={prompt}
                      onPress={() => submitPrompt(prompt)}
                      style={styles.promptChip}
                    >
                      <Text style={styles.promptChipText}>{prompt}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.card}>
                {messages.map((message) => (
                  <View
                    key={message.id}
                    style={[
                      styles.message,
                      message.role === 'user' ? styles.userMessage : styles.assistantMessage,
                    ]}
                  >
                    <Text style={styles.messageRole}>
                      {message.role === 'user' ? 'You' : 'Assistant'}
                    </Text>
                    <Text style={styles.messageText}>{message.content}</Text>
                  </View>
                ))}

                <View style={styles.chatComposer}>
                  <TextInput
                    value={chatInput}
                    onChangeText={setChatInput}
                    placeholder="Ask about this class"
                    placeholderTextColor="#839489"
                    style={styles.input}
                  />
                  <Pressable style={styles.primaryButton} onPress={() => submitPrompt(chatInput)}>
                    <Text style={styles.primaryButtonText}>Send</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {activeTab === 'settings' && (
            <View style={styles.section}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Expo Scaffold</Text>
                <Text style={styles.muted}>Folder: app/</Text>
                <Text style={styles.muted}>Runtime: Expo SDK 55</Text>
                <Text style={styles.muted}>Status: Ready to install</Text>
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Next</Text>
                <Text style={styles.muted}>1. npm install</Text>
                <Text style={styles.muted}>2. npm run start</Text>
                <Text style={styles.muted}>3. Replace mock data with your API or local store</Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.tabBar}>
          <TabButton label="Home" active={activeTab === 'dashboard'} onPress={() => setActiveTab('dashboard')} />
          <TabButton label="Attendance" active={activeTab === 'attendance'} onPress={() => setActiveTab('attendance')} />
          <TabButton label="Assistant" active={activeTab === 'assistant'} onPress={() => setActiveTab('assistant')} />
          <TabButton label="Settings" active={activeTab === 'settings'} onPress={() => setActiveTab('settings')} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.tabButton, active && styles.tabButtonActive]}>
      <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#eef2eb',
  },
  container: {
    flex: 1,
    backgroundColor: '#eef2eb',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#839489',
  },
  title: {
    marginTop: 6,
    fontSize: 32,
    fontWeight: '600',
    color: '#111318',
  },
  classSwitcher: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  classChip: {
    borderWidth: 1,
    borderColor: 'rgba(17,19,24,0.1)',
    backgroundColor: 'rgba(255,255,255,0.74)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  classChipActive: {
    borderColor: '#1f8f5f',
    backgroundColor: '#ddf5e9',
  },
  classChipText: {
    color: '#58685d',
    fontSize: 13,
    fontWeight: '500',
  },
  classChipTextActive: {
    color: '#15734b',
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: 20,
    paddingBottom: 120,
    gap: 14,
  },
  section: {
    gap: 14,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(17,19,24,0.08)',
    borderRadius: 12,
    padding: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111318',
  },
  cardValue: {
    marginTop: 10,
    fontSize: 28,
    fontWeight: '600',
    color: '#111318',
  },
  muted: {
    marginTop: 8,
    fontSize: 14,
    color: '#58685d',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  metricCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(17,19,24,0.08)',
    borderRadius: 10,
    padding: 14,
    backgroundColor: '#f8fbf7',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: '#839489',
  },
  metricValue: {
    marginTop: 10,
    fontSize: 24,
    fontWeight: '600',
    color: '#111318',
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(17,19,24,0.06)',
  },
  listName: {
    fontSize: 15,
    color: '#111318',
  },
  tagText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#15734b',
  },
  promptWrap: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  promptChip: {
    borderWidth: 1,
    borderColor: 'rgba(17,19,24,0.08)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f8fbf7',
  },
  promptChipText: {
    color: '#58685d',
    fontSize: 13,
  },
  message: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  userMessage: {
    backgroundColor: '#ddf5e9',
    borderWidth: 1,
    borderColor: 'rgba(31,143,95,0.18)',
  },
  assistantMessage: {
    backgroundColor: '#f8fbf7',
    borderWidth: 1,
    borderColor: 'rgba(17,19,24,0.08)',
  },
  messageRole: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    color: '#839489',
  },
  messageText: {
    marginTop: 6,
    color: '#111318',
    fontSize: 14,
    lineHeight: 21,
  },
  chatComposer: {
    marginTop: 12,
    gap: 10,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: 'rgba(17,19,24,0.12)',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#111318',
    fontSize: 14,
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: 10,
    backgroundColor: '#1f8f5f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  tabBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(17,19,24,0.08)',
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  tabButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#ddf5e9',
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#58685d',
  },
  tabButtonTextActive: {
    color: '#15734b',
  },
});

export default App;
