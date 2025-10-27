import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';

export default function InsightsModal({ visible, onClose, insights, isLoading, error, userLanguage }) {
  const userLanguageName = {
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    zh: 'Chinese',
    ja: 'Japanese',
    ar: 'Arabic',
  }[userLanguage] || userLanguage;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerIcon}>🧠</Text>
            <View>
              <Text style={styles.headerTitle}>Cultural Insights</Text>
              <Text style={styles.headerSubtitle}>From your {userLanguageName} perspective</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#128C7E" />
              <Text style={styles.loadingText}>Analyzing conversation...</Text>
              <Text style={styles.loadingSubtext}>This may take a few seconds</Text>
            </View>
          )}

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorTitle}>Unable to Generate Insights</Text>
              <Text style={styles.errorMessage}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={onClose}>
                <Text style={styles.retryButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          )}

          {!isLoading && !error && insights && (
            <>
              {/* Cultural References */}
              {insights.culturalReferences && insights.culturalReferences.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>🌍 Cultural References You Might Have Missed</Text>
                  {insights.culturalReferences.map((ref, index) => (
                    <View key={index} style={styles.insightCard}>
                      <Text style={styles.insightPhrase}>"{ref.phrase}"</Text>
                      <Text style={styles.insightContext}>💬 {ref.context}</Text>
                      <Text style={styles.insightExplanation}>{ref.explanation}</Text>
                      <Text style={styles.insightCulture}>From: {ref.culture}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Idioms & Expressions */}
              {insights.idioms && insights.idioms.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>💬 Idioms & Expressions Explained</Text>
                  {insights.idioms.map((idiom, index) => (
                    <View key={index} style={styles.insightCard}>
                      <Text style={styles.insightPhrase}>"{idiom.phrase}"</Text>
                      <Text style={styles.insightContext}>💬 {idiom.context}</Text>
                      <View style={styles.idiomMeanings}>
                        <Text style={styles.idiomMeaningLabel}>Literal: <Text style={styles.idiomMeaningText}>{idiom.literalMeaning}</Text></Text>
                        <Text style={styles.idiomMeaningLabel}>Actually means: <Text style={styles.idiomMeaningText}>{idiom.actualMeaning}</Text></Text>
                      </View>
                      <Text style={styles.insightCulture}>Language: {idiom.language}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Communication Styles */}
              {insights.communicationStyles && insights.communicationStyles.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>🗣️ Communication Style Insights</Text>
                  {insights.communicationStyles.map((style, index) => (
                    <View key={index} style={styles.insightCard}>
                      <Text style={styles.insightPhrase}>{style.pattern}</Text>
                      <Text style={styles.insightContext}>👥 {style.participants}</Text>
                      <Text style={styles.insightExplanation}>{style.explanation}</Text>
                      <Text style={styles.culturalContext}>Why: {style.culturalContext}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Learning Opportunities */}
              {insights.learningOpportunities && insights.learningOpportunities.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>📚 Language Learning Highlights</Text>
                  {insights.learningOpportunities.map((opportunity, index) => (
                    <View key={index} style={styles.insightCard}>
                      <Text style={styles.insightPhrase}>"{opportunity.phrase}"</Text>
                      <Text style={styles.insightCulture}>Language: {opportunity.language}</Text>
                      <Text style={styles.insightExplanation}>{opportunity.explanation}</Text>
                      <Text style={styles.usageText}>Usage: {opportunity.usage}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Empty state */}
              {insights.totalInsights === 0 && (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyIcon}>💭</Text>
                  <Text style={styles.emptyTitle}>No Cross-Cultural Insights Found</Text>
                  <Text style={styles.emptyMessage}>
                    This conversation appears to be in your native language, or doesn't contain significant cultural references.
                  </Text>
                  <Text style={styles.emptyHint}>
                    Cultural insights work best in multilingual group conversations!
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#F8F8F8',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#666',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  retryButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#128C7E',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
    paddingLeft: 4,
  },
  insightCard: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  insightPhrase: {
    fontSize: 16,
    fontWeight: '600',
    color: '#128C7E',
    marginBottom: 8,
  },
  insightContext: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  insightExplanation: {
    fontSize: 15,
    color: '#000',
    lineHeight: 22,
    marginBottom: 8,
  },
  insightCulture: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },
  idiomMeanings: {
    marginBottom: 8,
    paddingLeft: 8,
  },
  idiomMeaningLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    fontWeight: '600',
  },
  idiomMeaningText: {
    fontWeight: '400',
    color: '#000',
  },
  culturalContext: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  usageText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  emptyHint: {
    fontSize: 14,
    color: '#128C7E',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

