import React from 'react';
import { Text, useWindowDimensions } from 'react-native';
import { PieChart } from 'react-native-chart-kit';
import styled from 'styled-components/native';

const COLORS = ['#b03060', '#d85a8a', '#e985aa', '#f2b8cd'];

export default function InsightTimingPie({ data, onSelectSlice }) {
  const { width } = useWindowDimensions();
  const labels = Array.isArray(data?.labels) ? data.labels : [];
  const values = Array.isArray(data?.values) ? data.values : [];
  const total = values.reduce((sum, val) => sum + Number(val || 0), 0);

  if (!labels.length || !values.length || total === 0) {
    return <EmptyText>Not enough data yet.</EmptyText>;
  }

  const chartWidth = Math.max(165, width - 230);

  const pieData = labels.map((label, idx) => ({
    name: label,
    count: Number(values[idx] || 0),
    color: COLORS[idx % COLORS.length],
    legendFontColor: '#5f544f',
    legendFontSize: 11,
  }));

  return (
    <ChartRow>
      <PieWrap>
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
          paddingLeft="26"
          absolute={false}
          hasLegend={false}
          style={{ marginVertical: 8 }}
        />
      </PieWrap>
      <LegendWrap>
        {pieData.map((item, index) => {
          const percent = total > 0 ? Math.round((item.count / total) * 100) : 0;
          return (
            <LegendRow key={item.name} onPress={() => onSelectSlice && onSelectSlice(index)}>
              <LegendDot style={{ backgroundColor: item.color }} />
              <LegendText>{percent}% {item.name}</LegendText>
            </LegendRow>
          );
        })}
      </LegendWrap>
    </ChartRow>
  );
}

const EmptyText = styled(Text)`
  font-size: 12px;
  color: #7b6f68;
  margin-top: 6px;
`;

const ChartRow = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
`;

const PieWrap = styled.View`
  width: 170px;
  align-items: center;
  justify-content: center;
`;

const LegendWrap = styled.View`
  flex: 1;
  margin-left: 10px;
`;

const LegendRow = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
  margin-bottom: 10px;
`;

const LegendDot = styled.View`
  width: 12px;
  height: 12px;
  border-radius: 6px;
  margin-right: 8px;
`;

const LegendText = styled(Text)`
  font-size: 11px;
  color: #5f544f;
`;
