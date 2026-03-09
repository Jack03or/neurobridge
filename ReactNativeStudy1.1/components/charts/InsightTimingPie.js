import React from 'react';
import { Text, useWindowDimensions } from 'react-native';
import { PieChart } from 'react-native-chart-kit';
import styled from 'styled-components/native';

const COLORS = ['#b03060', '#d85a8a', '#e985aa', '#f2b8cd'];

export default function InsightTimingPie({ data }) {
  const { width } = useWindowDimensions();
  const labels = Array.isArray(data?.labels) ? data.labels : [];
  const values = Array.isArray(data?.values) ? data.values : [];
  const total = values.reduce((sum, val) => sum + Number(val || 0), 0);

  if (!labels.length || !values.length || total === 0) {
    return <EmptyText>Not enough data yet.</EmptyText>;
  }

  const chartWidth = Math.max(220, width - 88);

  const pieData = labels.map((label, idx) => ({
    name: label,
    count: Number(values[idx] || 0),
    color: COLORS[idx % COLORS.length],
    legendFontColor: '#5f544f',
    legendFontSize: 11,
  }));

  return (
    <PieChart
      data={pieData}
      width={chartWidth}
      height={170}
      chartConfig={{
        color: (opacity = 1) => `rgba(176, 48, 96, ${opacity})`,
        labelColor: (opacity = 1) => `rgba(80, 70, 65, ${opacity})`,
      }}
      accessor="count"
      backgroundColor="transparent"
      paddingLeft="8"
      absolute={false}
      hasLegend
      style={{ marginVertical: 8 }}
    />
  );
}

const EmptyText = styled(Text)`
  font-size: 12px;
  color: #7b6f68;
  margin-top: 6px;
`;
