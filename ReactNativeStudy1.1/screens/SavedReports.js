import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView } from 'react-native';
import styled from 'styled-components/native';
import { useFocusEffect } from '@react-navigation/native';
import { BASE_URL } from '../config';

export default function SavedReports({ route, navigation }) {
  const { userId } = route.params;
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/reports/by-user/${userId}`);
      const text = await response.text();
      if (!response.ok) {
        Alert.alert('Error', text || 'Could not load reports.');
        return;
      }
      let data = [];
      try {
        data = JSON.parse(text);
      } catch (e) {
        Alert.alert('Error', 'Unexpected server response.');
        return;
      }
      setReports(data);
    } catch (err) {
      Alert.alert('Error', 'Could not load reports.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchReports();
    }, [userId]),
  );

  const openReport = async (reportId, downloadUrl) => {
    try {
      const response = await fetch(`${BASE_URL}/api/reports/${reportId}/data`);
      const text = await response.text();
      if (!response.ok) {
        Alert.alert('Error', text || 'Could not load report data.');
        return;
      }
      let data = null;
      try {
        data = JSON.parse(text);
      } catch (e) {
        Alert.alert('Error', 'Unexpected server response.');
        return;
      }

      navigation.navigate('ReportPreview', {
        userId,
        reportId,
        reportData: data,
        downloadUrl,
      });
    } catch (err) {
      Alert.alert('Error', 'Could not open report.');
    }
  };

  return (
    <Container>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
        <Title>Saved Reports</Title>
        <Subtle>Tap a report to view and share.</Subtle>

        {loading ? (
          <LoadingWrapper>
            <ActivityIndicator />
          </LoadingWrapper>
        ) : reports.length === 0 ? (
          <EmptyState>
            <EmptyTitle>No reports yet</EmptyTitle>
            <EmptyText>Generate your first report to see it here.</EmptyText>
          </EmptyState>
        ) : (
          reports.map((report) => (
            <ReportCard
              key={report.reportId}
              onPress={() => openReport(report.reportId, report.downloadUrl)}
            >
              <ReportTitle>{report.title}</ReportTitle>
              <ReportMeta>
                {report.startDate} → {report.endDate}
              </ReportMeta>
              <ReportMeta>Created: {report.createdAt}</ReportMeta>
            </ReportCard>
          ))
        )}
      </ScrollView>
    </Container>
  );
}

const Container = styled.View`
  flex: 1;
  background-color: #f5efe6;
`;

const Title = styled.Text`
  font-size: 22px;
  font-weight: 700;
  color: #2f2f2f;
`;

const Subtle = styled.Text`
  font-size: 13px;
  color: #6b5e58;
  margin-top: 4px;
  margin-bottom: 16px;
`;

const LoadingWrapper = styled.View`
  padding: 30px 0;
  align-items: center;
`;

const EmptyState = styled.View`
  background-color: #ffffff;
  border-radius: 20px;
  padding: 20px;
  shadow-color: #000;
  shadow-opacity: 0.08;
  shadow-radius: 10px;
  elevation: 4;
`;

const EmptyTitle = styled.Text`
  font-size: 16px;
  font-weight: 700;
  color: #2f2f2f;
`;

const EmptyText = styled.Text`
  font-size: 13px;
  color: #6b5e58;
  margin-top: 6px;
`;

const ReportCard = styled.TouchableOpacity`
  background-color: #ffffff;
  border-radius: 20px;
  padding: 16px;
  margin-bottom: 12px;
  shadow-color: #000;
  shadow-opacity: 0.08;
  shadow-radius: 8px;
  elevation: 3;
`;

const ReportTitle = styled.Text`
  font-size: 15px;
  font-weight: 700;
  color: #2f2f2f;
`;

const ReportMeta = styled.Text`
  font-size: 12px;
  color: #6b5e58;
  margin-top: 4px;
`;
