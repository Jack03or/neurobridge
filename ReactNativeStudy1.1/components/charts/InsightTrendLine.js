import React from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import styled from 'styled-components/native';

export default function InsightTrendLine({ data, onSelectDay }) {
  const { width } = useWindowDimensions();
  const labels = Array.isArray(data?.labels) ? data.labels : [];
  const values = Array.isArray(data?.values) ? data.values : [];
  const hasData = values.some((v) => Number(v) > 0);

  if (!labels.length || !values.length || !hasData) {
    return <EmptyText>Not enough data yet.</EmptyText>;
  }

  const chartWidth = Math.max(190, width - 132);

  return (
    <View>
      <BarChart
        data={{ labels, datasets: [{ data: values }] }}
        width={chartWidth}
        height={170}
        fromZero
        fromNumber={5}
        withInnerLines
        showValuesOnTopOfBars
        yAxisLabel=""
        yAxisSuffix=""
        formatYLabel={(value) => String(Math.round(Number(value)))}
        chartConfig={{
          backgroundGradientFrom: '#ffffff',
          backgroundGradientTo: '#ffffff',
          decimalPlaces: 0,
          color: (opacity = 1) => `rgba(176, 48, 96, ${opacity})`,
          labelColor: (opacity = 1) => `rgba(80, 70, 65, ${opacity})`,
          barPercentage: 0.5,
          propsForBackgroundLines: {
            strokeDasharray: '4 6',
            stroke: '#ead9df',
          },
        }}
        style={{ marginVertical: 8, borderRadius: 12 }}
        withHorizontalLabels
        segments={5}
        verticalLabelRotation={0}
        onDataPointClick={({ index }) => {
          if (typeof onSelectDay === 'function' && index != null) {
            onSelectDay(index);
          }
        }}
      />

    </View>
  );
}

const EmptyText = styled(Text)`
  font-size: 12px;
  color: #7b6f68;
  margin-top: 6px;
`;
