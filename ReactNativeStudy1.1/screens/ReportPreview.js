import React from 'react';
import { Alert, ScrollView } from 'react-native';
import styled from 'styled-components/native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { BASE_URL } from '../config';
import InsightTrendLine from '../components/charts/InsightTrendLine';
import InsightTimingPie from '../components/charts/InsightTimingPie';

export default function ReportPreview({ route }) {
  const { reportData, downloadUrl } = route.params;

  const downloadPdf = async () => {
    try {
      const url = `${BASE_URL}${downloadUrl}`;
      const fileUri = FileSystem.documentDirectory + `report-${Date.now()}.pdf`;
      const result = await FileSystem.downloadAsync(url, fileUri);
      if (result.status !== 200) {
        throw new Error(`Download failed with status ${result.status}`);
      }
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(result.uri);
      } else {
        Alert.alert('Saved', `PDF saved to ${result.uri}`);
      }
    } catch (err) {
      Alert.alert('Error', err?.message || 'Could not download the PDF.');
    }
  };

  if (!reportData) {
    return (
      <Container>
        <EmptyText>Report data not available.</EmptyText>
      </Container>
    );
  }

  const reportCharts = reportData.charts || {
    trendSeries: { labels: [], values: [] },
    timingSplit: { labels: [], values: [] },
  };
  const trendGrouping = reportCharts?.trendSeries?.grouping === 'weekly' ? 'weekly' : 'daily';
  const trendLabels = Array.isArray(reportCharts?.trendSeries?.labels) ? reportCharts.trendSeries.labels : [];
  const trendValues = Array.isArray(reportCharts?.trendSeries?.values)
    ? reportCharts.trendSeries.values.map((v) => Number(v || 0))
    : [];
  const trendTotal = trendValues.reduce((sum, value) => sum + value, 0);
  const trendMax = trendValues.length ? Math.max(...trendValues) : 0;
  const topPeriods = trendLabels.filter((_, idx) => trendValues[idx] === trendMax && trendMax > 0);
  const trendSummary = trendTotal === 0
    ? 'No seizures logged in this report period.'
    : topPeriods.length > 1
      ? `${trendTotal} seizures in this report period. Highest ${trendGrouping === 'weekly' ? 'weeks' : 'dates'}: ${topPeriods.join(', ')} (${trendMax}).`
      : `${trendTotal} seizures in this report period. Highest ${trendGrouping === 'weekly' ? 'week' : 'date'}: ${topPeriods[0]} (${trendMax}).`;
  const timingInsight = reportData.insights?.find((item) => {
    const text = String(item || '').toLowerCase();
    return text.includes('morning') || text.includes('afternoon') || text.includes('evening') || text.includes('night');
  }) || 'Not enough data yet.';

  return (
    <Container>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
        <Title>{reportData.title}</Title>
        <Subtle>Generated: {reportData.generatedDate}</Subtle>

        <Card>
          <SectionTitle>Child Summary</SectionTitle>
          <Row>
            <Label>Name</Label>
            <Value>{reportData.childName}</Value>
          </Row>
          <Row>
            <Label>DOB</Label>
            <Value>{reportData.childDob}</Value>
          </Row>
          <Row>
            <Label>Age</Label>
            <Value>{reportData.childAge}</Value>
          </Row>
          <Row>
            <Label>Gender</Label>
            <Value>{reportData.childGender}</Value>
          </Row>
          <Row>
            <Label>Disability</Label>
            <Value>{reportData.childDisability}</Value>
          </Row>
          <Row>
            <Label>Period</Label>
            <Value>{reportData.timeframe}</Value>
          </Row>
        </Card>

        <Card>
          <SectionTitle>Highlights</SectionTitle>
          {reportData.executiveSummary?.map((item, idx) => (
            <Bullet key={`sum-${idx}`}>- {item}</Bullet>
          ))}
        </Card>

        <Card>
          <SectionTitle>Patterns & Triggers</SectionTitle>
          <ChartBlock>
            <ChartTitle>Seizure trend in this timeframe</ChartTitle>
            <ChartCaption>
              {trendGrouping === 'weekly'
                ? 'How many seizures were logged across each week in the selected period'
                : 'How many seizures were logged across the selected dates'}
            </ChartCaption>
            <InsightTrendLine data={reportCharts.trendSeries} />
            <ChartLegend>{trendSummary}</ChartLegend>
          </ChartBlock>
          <ChartBlock>
            <ChartTitle>When seizures tend to happen</ChartTitle>
            <ChartCaption>How seizure events split across the day</ChartCaption>
            <InsightTimingPie data={reportCharts.timingSplit} />
            <ChartLegend>{timingInsight}</ChartLegend>
          </ChartBlock>
        </Card>

        <Card>
          <SectionTitle>Seizure Timeline (top 10)</SectionTitle>
          {reportData.seizureTimeline?.map((row, idx) => (
            <TimelineRow key={`row-${idx}`}>
              <TimelineTime>{row.time}</TimelineTime>
              <TimelineMeta>
                {row.type} - {row.awareness} - {row.duration}
              </TimelineMeta>
              {row.notes ? <TimelineNotes>{row.notes}</TimelineNotes> : null}
            </TimelineRow>
          ))}
        </Card>

        <Card>
          <SectionTitle>Medication Summary</SectionTitle>
          <Row>
            <Label>Adherence</Label>
            <Value>{reportData.medSummary?.adherencePercent}</Value>
          </Row>
          <Row>
            <Label>Missed days</Label>
            <Value>{reportData.medSummary?.missedDays}</Value>
          </Row>
          <Row>
            <Label>Meds used</Label>
            <Value>{reportData.medSummary?.medsUsed}</Value>
          </Row>
        </Card>

        <Card>
          <SectionTitle>Sleep & Vitals</SectionTitle>
          <Row>
            <Label>Avg sleep</Label>
            <Value>{reportData.fitbitSummary?.avgSleep}</Value>
          </Row>
          <Row>
            <Label>Avg HR</Label>
            <Value>{reportData.fitbitSummary?.avgHeartRate}</Value>
          </Row>
          <Row>
            <Label>Avg HRV</Label>
            <Value>{reportData.fitbitSummary?.avgHrv}</Value>
          </Row>
          <Row>
            <Label>Low sleep days</Label>
            <Value>{reportData.fitbitSummary?.lowSleepDays}</Value>
          </Row>
        </Card>

        <Card>
          <SectionTitle>Smart Insights</SectionTitle>
          {reportData.insights?.map((item, idx) => (
            <Bullet key={`ins-${idx}`}>- {item}</Bullet>
          ))}
        </Card>

        <Card>
          <SectionTitle>Appointments</SectionTitle>
          {reportData.appointments?.length ? (
            reportData.appointments.map((appt, idx) => (
              <Bullet key={`appt-${idx}`}>
                {appt.label} - {appt.value}
              </Bullet>
            ))
          ) : (
            <EmptyText>No appointments in this period.</EmptyText>
          )}
        </Card>

        <PrimaryButton onPress={downloadPdf}>
          <PrimaryButtonText>Download PDF</PrimaryButtonText>
        </PrimaryButton>
      </ScrollView>
    </Container>
  );
}

const Container = styled.View`
  flex: 1;
  background-color: #f5efe6;
`;

const Title = styled.Text`
  font-size: 20px;
  font-weight: 700;
  color: #2f2f2f;
`;

const Subtle = styled.Text`
  font-size: 12px;
  color: #6b5e58;
  margin-top: 4px;
  margin-bottom: 12px;
`;

const Card = styled.View`
  background-color: #ffffff;
  border-radius: 20px;
  padding: 16px;
  margin-bottom: 12px;
  shadow-color: #000;
  shadow-opacity: 0.08;
  shadow-radius: 8px;
  elevation: 3;
`;

const SectionTitle = styled.Text`
  font-size: 14px;
  font-weight: 700;
  color: #2f2f2f;
  margin-bottom: 8px;
`;

const Row = styled.View`
  flex-direction: row;
  justify-content: space-between;
  margin-bottom: 6px;
`;

const Label = styled.Text`
  font-size: 12px;
  color: #6b5e58;
  max-width: 45%;
`;

const Value = styled.Text`
  font-size: 12px;
  color: #2f2f2f;
  text-align: right;
  max-width: 50%;
`;

const Bullet = styled.Text`
  font-size: 12px;
  color: #2f2f2f;
  margin-bottom: 4px;
`;

const TimelineRow = styled.View`
  border-bottom-width: 1px;
  border-bottom-color: #f1f1f1;
  padding-bottom: 8px;
  margin-bottom: 8px;
`;

const TimelineTime = styled.Text`
  font-size: 12px;
  font-weight: 700;
  color: #2f2f2f;
`;

const TimelineMeta = styled.Text`
  font-size: 11px;
  color: #6b5e58;
  margin-top: 2px;
`;

const TimelineNotes = styled.Text`
  font-size: 11px;
  color: #2f2f2f;
  margin-top: 4px;
`;

const ChartBlock = styled.View`
  margin-bottom: 16px;
`;

const ChartTitle = styled.Text`
  font-size: 13px;
  font-weight: 700;
  color: #2f2f2f;
`;

const ChartCaption = styled.Text`
  font-size: 11px;
  color: #6b5e58;
  margin-bottom: 8px;
`;

const ChartLegend = styled.Text`
  font-size: 11px;
  color: #6b5e58;
  margin-top: 6px;
`;

const EmptyText = styled.Text`
  font-size: 12px;
  color: #6b5e58;
`;

const PrimaryButton = styled.TouchableOpacity`
  margin-top: 8px;
  background-color: #b03060;
  padding: 14px 18px;
  border-radius: 20px;
  align-items: center;
`;

const PrimaryButtonText = styled.Text`
  color: #ffffff;
  font-size: 14px;
  font-weight: 700;
`;
