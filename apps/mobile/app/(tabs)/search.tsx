import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../src/constants/colors';
import { shadow1, shadow2 } from '../../src/constants/shadows';
import { searchMeetings } from '../../src/services/graphService';
import { useAuth } from '../../src/hooks/useAuth';
import { formatDate } from '../../src/utils/format';

const NODE_TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  meeting:  { label: 'Meeting',  icon: '📋', color: '#5B4CFF' },
  note:     { label: 'Summary',  icon: '📝', color: '#00BFA6' },
  action:   { label: 'Action',   icon: '☑️', color: '#FF9500' },
  decision: { label: 'Decision', icon: '⚡', color: '#8B5CF6' },
};

const SUGGESTIONS = [
  'Action items from last week',
  'What did we decide about?',
  'Key decisions',
  'Open questions',
];

interface SearchResult {
  id: string;
  node_type: string;
  title: string;
  content: string | null;
  source_meeting_id: string | null;
  similarity: number;
  meeting_title: string | null;
  meeting_date: string | null;
}

export default function SearchScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async (searchQuery?: string) => {
    const q = (searchQuery ?? query).trim();
    if (!q || !user) return;
    if (searchQuery) setQuery(searchQuery);
    Keyboard.dismiss();
    setIsSearching(true);
    setError(null);
    setHasSearched(true);
    try {
      const res = await searchMeetings(q, user.id, 15);
      setResults(res);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Search failed';
      setError(msg);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [query, user]);

  const navigateToMeeting = (meetingId: string) => {
    router.push(`/meeting/${meetingId}`);
  };

  return (
    <>
      <View style={st.container}>
        {/* Search Bar */}
        <View style={st.searchBar}>
          <View style={st.inputRow}>
            <Text style={st.searchIcon}>🔍</Text>
            <TextInput
              style={st.input}
              placeholder="Ask anything about your meetings..."
              placeholderTextColor={Colors.textMuted}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => handleSearch()}
              returnKeyType="search"
              autoFocus
            />
          </View>
          <TouchableOpacity
            style={[st.searchBtn, !query.trim() && st.searchBtnDisabled]}
            onPress={() => handleSearch()}
            disabled={!query.trim() || isSearching}
          >
            <Text style={st.searchBtnText}>Search</Text>
          </TouchableOpacity>
        </View>

        {isSearching && (
          <View style={st.center}>
            <View style={st.loadingCard}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={st.loadingText}>Searching your knowledge graph...</Text>
            </View>
          </View>
        )}

        {error && (
          <View style={st.center}>
            <Text style={st.errorText}>{error}</Text>
          </View>
        )}

        {!isSearching && hasSearched && results.length === 0 && !error && (
          <View style={st.center}>
            <View style={st.emptyCard}>
              <Text style={st.emptyIcon}>🔍</Text>
              <Text style={st.emptyText}>No results found</Text>
              <Text style={st.emptyHint}>
                Try different keywords or record more meetings
              </Text>
            </View>
          </View>
        )}

        {!isSearching && !hasSearched && (
          <View style={st.center}>
            <View style={st.heroCard}>
              <Text style={st.heroIcon}>💡</Text>
              <Text style={st.heroTitle}>Semantic Search</Text>
              <Text style={st.heroSubtitle}>
                Search across all your meetings by meaning, not just keywords
              </Text>
            </View>

            <Text style={st.suggestTitle}>Try asking</Text>
            <View style={st.suggestRow}>
              {SUGGESTIONS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={st.suggestChip}
                  onPress={() => handleSearch(s)}
                >
                  <Text style={st.suggestChipText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {results.length > 0 && (
          <ScrollView
            style={st.resultsList}
            contentContainerStyle={st.resultsContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={st.resultCount}>
              {results.length} result{results.length !== 1 ? 's' : ''}
            </Text>
            {results.map((r) => {
              const typeInfo = NODE_TYPE_LABELS[r.node_type] || {
                label: r.node_type,
                icon: '📄',
                color: Colors.textSecondary,
              };
              const score = Math.round(r.similarity * 100);

              return (
                <TouchableOpacity
                  key={r.id}
                  style={st.resultCard}
                  onPress={() => r.source_meeting_id && navigateToMeeting(r.source_meeting_id)}
                  activeOpacity={0.7}
                >
                  <View style={st.resultHeader}>
                    <View style={st.resultTypeRow}>
                      <View style={[st.resultTypeIcon, { backgroundColor: typeInfo.color + '18' }]}>
                        <Text style={st.resultTypeEmoji}>{typeInfo.icon}</Text>
                      </View>
                      <Text style={[st.typeBadgeText, { color: typeInfo.color }]}>
                        {typeInfo.label}
                      </Text>
                    </View>
                    <View style={st.scoreWrap}>
                      <View style={st.scoreBar}>
                        <View style={[st.scoreFill, { width: `${score}%`, backgroundColor: typeInfo.color }]} />
                      </View>
                      <Text style={st.scoreText}>{score}%</Text>
                    </View>
                  </View>

                  <Text style={st.resultTitle} numberOfLines={2}>{r.title}</Text>

                  {r.content && (
                    <Text style={st.resultContent} numberOfLines={3}>{r.content}</Text>
                  )}

                  {r.meeting_title && (
                    <View style={st.resultMeta}>
                      <Text style={st.resultMetaIcon}>📋</Text>
                      <Text style={st.resultMetaText} numberOfLines={1}>{r.meeting_title}</Text>
                      {r.meeting_date && (
                        <Text style={st.resultMetaDate}>{formatDate(r.meeting_date)}</Text>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>
    </>
  );
}

const st = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchBar: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
    backgroundColor: Colors.surface,
    ...shadow1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 16,
    paddingHorizontal: 16,
    gap: 10,
  },
  searchIcon: {
    fontSize: 18,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  searchBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    ...shadow2,
  },
  searchBtnDisabled: {
    opacity: 0.5,
  },
  searchBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  // Loading
  loadingCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    width: '100%',
    gap: 16,
    ...shadow1,
  },
  loadingText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '500',
  },

  // Error
  errorText: {
    fontSize: 15,
    color: Colors.danger,
    textAlign: 'center',
    fontWeight: '500',
  },

  // Empty
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    width: '100%',
    ...shadow1,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Hero (initial state)
  heroCard: {
    backgroundColor: Colors.surfaceDark,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    marginBottom: 28,
    ...shadow2,
  },
  heroIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.textOnDark,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: 15,
    color: Colors.textOnDarkSecondary,
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '500',
  },

  // Suggestions
  suggestTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  suggestRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  suggestChip: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...shadow1,
  },
  suggestChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },

  // Results
  resultsList: {
    flex: 1,
  },
  resultsContent: {
    padding: 20,
  },
  resultCount: {
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 14,
    fontWeight: '600',
  },
  resultCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    ...shadow1,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resultTypeIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultTypeEmoji: {
    fontSize: 16,
  },
  typeBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  scoreWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    overflow: 'hidden',
  },
  scoreFill: {
    height: 4,
    borderRadius: 2,
  },
  scoreText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '700',
  },
  resultTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    lineHeight: 24,
    marginBottom: 6,
  },
  resultContent: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 12,
  },
  resultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border + '30',
    gap: 8,
  },
  resultMetaIcon: {
    fontSize: 14,
  },
  resultMetaText: {
    fontSize: 13,
    color: Colors.textMuted,
    flex: 1,
    fontWeight: '500',
  },
  resultMetaDate: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
  },
});
