import React from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import styled from 'styled-components/native';

export default function InsightSleepSeizureLine({ data }) {
  const { width } = useWindowDimensions();
  const labels = Array.isArray(data?.labels) ? data.labels : [];
  const sleepValues = Array.isArray(data?.sleepValues) ? data.sleepValues.map((v) => Number(v || 0)) : [];
  const seizureMarkers = Array.isArray(data?.seizureMarkers) ? data.seizureMarkers.map((v) => (v == null ? null : Number(v))) : [];
  const hasSleepData = sleepValues.some((v) => Number(v) > 0);

  if (!labels.length || !sleepValues.length || !hasSleepData) {
    return <EmptyText>Not enough sleep data yet.</EmptyText>;
  }

  const chartWidth = Math.max(190, width - 132);
  const safeMarkers = seizureMarkers.map((v) => (v == null ? 0 : v));
  const hidePointsAtIndex = seizureMarkers
    .map((v, idx) => (v == null ? idx : null))
    .filter((v) => v !== null);

  return (
    <View>
      <LineChart
        data={{
          labels,
          datasets: [
            {
              data: sleepValues,
              color: (opacity = 1) => `rgba(63, 122, 164, ${opacity})`,
              strokeWidth: 3,
            },
            {
              data: safeMarkers,
              color: () => 'rgba(176, 48, 96, 0)',
              strokeWidth: 0,
            },
          ],
          legend: ['Sleep hours'],
        }}
        width={chartWidth}
        height={190}
        fromZero
        fromNumber={10}
        bezier={false}
        withInnerLines
        withOuterLines={false}
        withShadow={false}
        withDots
        hidePointsAtIndex={hidePointsAtIndex}
        formatYLabel={(value) => String(Math.round(Number(value)))}
        yAxisLabel=""
        yAxisSuffix=""
        chartConfig={{
          backgroundGradientFrom: '#ffffff',
          backgroundGradientTo: '#ffffff',
          decimalPlaces: 0,
          color: (opacity = 1) => `rgba(63, 122, 164, ${opacity})`,
          labelColor: (opacity = 1) => `rgba(80, 70, 65, ${opacity})`,
          propsForBackgroundLines: {
            strokeDasharray: '4 6',
            stroke: '#ead9df',
          },
          propsForDots: {
            r: '4',
            strokeWidth: '2',
            stroke: '#b03060',
            fill: '#ffffff',
          },
          propsForLabels: {
            fontSize: 11,
          },
        }}
        style={{ marginVertical: 8, borderRadius: 12 }}
        segments={5}
        getDotColor={(_, index) => (seizureMarkers[index] == null ? 'transparent' : '#b03060')}
      />

      <LegendRow>
        <LegendItem>
          <LegendLine />
          <LegendText>Sleep hours</LegendText>
        </LegendItem>
        <LegendItem>
          <LegendDot />
          <LegendText>Seizure day</LegendText>
        </LegendItem>
      </LegendRow>
    </View>
  );
}

const EmptyText = styled(Text)`
  font-size: 12px;
  color: #7b6f68;
  margin-top: 6px;
`;

const LegendRow = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  margin-top: 2px;
`;

const LegendItem = styled.View`
  flex-direction: row;
  align-items: center;
  margin-right: 14px;
`;

const LegendLine = styled.View`
  width: 16px;
  height: 3px;
  border-radius: 2px;
  background-color: #3f7aa4;
  margin-right: 6px;
`;

const LegendDot = styled.View`
  width: 9px;
  height: 9px;
  border-radius: 4.5px;
  background-color: #b03060;
  margin-right: 6px;
`;

const LegendText = styled.Text`
  font-size: 11px;
  color: #6b5e58;
`;
