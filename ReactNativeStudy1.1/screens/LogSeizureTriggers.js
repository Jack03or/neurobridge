import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView } from 'react-native';
import styled from 'styled-components/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { BASE_URL } from '../config';

export default function LogSeizureTriggers({ route, navigation }) {
  const payload = route.params;
  const { userId } = payload;

  const tiles = useMemo(
    () => [
      { key: 'Sleep Deprivation', icon: 'sleep' },
      { key: 'Photosensitivity', icon: 'brightness-6' },
      { key: 'Illness / Fever', icon: 'thermometer' },
      { key: 'Missed Medication', icon: 'pill-off' },
      { key: 'Stress', icon: 'heart-pulse' },
      { key: 'Hours Since Last Meal', icon: 'food-outline' },
    ],
    []
  );

  const [selectedTriggers, setSelectedTriggers] = useState(payload.potentialTriggers || []);
  const [hoursSinceLastMeal, setHoursSinceLastMeal] = useState(
    payload.hoursSinceLastMeal != null ? String(payload.hoursSinceLastMeal) : ''
  );
  const [mealModalOpen, setMealModalOpen] = useState(false);
  const [dashboardInfo, setDashboardInfo] = useState({ sleepHours: null, hrv: null });

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const response = await fetch(`${BASE_URL}/api/dashboard/by-user/${userId}`);
        const text = await response.text();
        if (!response.ok) return;
        const data = text ? JSON.parse(text) : {};
        setDashboardInfo({
          sleepHours: data.sleepHours ?? null,
          hrv: data.hrv ?? null,
          medicationTakenToday: data.medicationTakenToday ?? null,
        });
      } catch (err) {
        setDashboardInfo({ sleepHours: null, hrv: null, medicationTakenToday: null });
      }
    };

    loadDashboard();
  }, [userId]);

  const toggle = (key) => {
    if (key === 'Hours Since Last Meal') {
      setMealModalOpen(true);
      return;
    }

    setSelectedTriggers((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  };

  const parsedHours = hoursSinceLastMeal.trim() === '' ? null : Math.max(0, parseInt(hoursSinceLastMeal, 10) || 0);

  const renderMetricHint = (key) => {
    if (key === 'Sleep Deprivation') {
      return dashboardInfo.sleepHours != null ? `${dashboardInfo.sleepHours.toFixed(1)} hrs last night` : 'No sleep data yet';
    }
    if (key === 'Stress') {
      return dashboardInfo.hrv != null ? `HRV ${dashboardInfo.hrv} today` : 'No HRV data yet';
    }
    if (key === 'Missed Medication') {
      if (dashboardInfo.medicationTakenToday === true) return 'Taken today';
      if (dashboardInfo.medicationTakenToday === false) return 'Not taken today';
      return 'No medication data yet';
    }
    if (key === 'Hours Since Last Meal') {
      return parsedHours != null ? `${parsedHours} hours selected` : 'Tap to add hours';
    }
    return null;
  };

  return (
    <Container>
      <TopBar>
        <BackBtn onPress={() => navigation.goBack()}>
          <TopIcon name="chevron-left" />
        </BackBtn>
        <TopTitle>Potential Triggers</TopTitle>
        <TopSpacer />
      </TopBar>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 30 }}>
        <Title>Potential triggers</Title>
        <SubTitle>Select anything that may have contributed, or skip if unknown.</SubTitle>

        <Grid>
          {tiles.map((tile) => {
            const isMeal = tile.key === 'Hours Since Last Meal';
            const active = isMeal ? parsedHours != null : selectedTriggers.includes(tile.key);
            const hint = renderMetricHint(tile.key);

            return (
              <Tile key={tile.key} active={active} onPress={() => toggle(tile.key)}>
                <TileInner>
                  <TileIcon name={tile.icon} active={active} />
                  <TileText active={active}>{tile.key}</TileText>
                  {hint ? <TileSubText active={active}>{hint}</TileSubText> : null}
                </TileInner>
              </Tile>
            );
          })}
        </Grid>

        <ContinueBtn
          onPress={() =>
            navigation.navigate('LogSeizureDetails', {
              ...payload,
              potentialTriggers: selectedTriggers,
              hoursSinceLastMeal: parsedHours,
            })
          }
        >
          <ContinueText>Continue</ContinueText>
        </ContinueBtn>
      </ScrollView>

      <Modal transparent visible={mealModalOpen} animationType="fade">
        <ModalBackdrop onPress={() => setMealModalOpen(false)}>
          <ModalCard>
            <ModalTitle>Hours Since Last Meal</ModalTitle>
            <ModalBody>Add the number of hours since the last meal, if known.</ModalBody>

            <MealInput
              keyboardType="number-pad"
              value={hoursSinceLastMeal}
              onChangeText={setHoursSinceLastMeal}
              placeholder="Enter hours"
              placeholderTextColor="#8b7e76"
            />

            <ModalActionRow>
              <SecondaryBtn onPress={() => setHoursSinceLastMeal('')}>
                <SecondaryBtnText>Clear</SecondaryBtnText>
              </SecondaryBtn>
              <ModalBtn onPress={() => setMealModalOpen(false)}>
                <ModalBtnText>Continue</ModalBtnText>
              </ModalBtn>
            </ModalActionRow>
          </ModalCard>
        </ModalBackdrop>
      </Modal>
    </Container>
  );
}

const Container = styled.View`
  flex: 1;
  background-color: #f5efe6;
`;

const TopBar = styled.View`
  height: 56px;
  background-color: #b03060;
  margin: 16px 24px 8px;
  border-radius: 18px;
  padding: 0 12px;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
`;

const BackBtn = styled.TouchableOpacity`padding: 6px;`;
const TopIcon = styled(Icon)`font-size: 26px; color: #fff;`;
const TopTitle = styled.Text`
  flex: 1;
  text-align: center;
  font-size: 18px;
  font-weight: 700;
  color: #fff;
`;
const TopSpacer = styled.View`width: 32px;`;

const Title = styled.Text`
  font-size: 20px;
  font-weight: 800;
  color: #2f2f2f;
  margin-top: 10px;
`;

const SubTitle = styled.Text`
  font-size: 13px;
  color: #6b5e58;
  margin-top: 6px;
  margin-bottom: 14px;
`;

const Grid = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: space-between;
`;

const Tile = styled.TouchableOpacity`
  width: 48%;
  background-color: ${(p) => (p.active ? '#e7c7d3' : '#ffffff')};
  border-radius: 20px;
  padding: 14px;
  margin-bottom: 14px;
  border: 2px solid ${(p) => (p.active ? '#b03060' : 'transparent')};
`;

const TileInner = styled.View`
  min-height: 92px;
  justify-content: space-between;
`;

const TileIcon = styled(Icon)`
  font-size: 26px;
  color: ${(p) => (p.active ? '#b03060' : '#6b5e58')};
`;

const TileText = styled.Text`
  font-size: 14px;
  font-weight: 700;
  color: ${(p) => (p.active ? '#b03060' : '#2f2f2f')};
  margin-top: 8px;
`;

const TileSubText = styled.Text`
  font-size: 11px;
  color: ${(p) => (p.active ? '#9b2e57' : '#8b7e76')};
  margin-top: 6px;
`;

const ContinueBtn = styled.TouchableOpacity`
  margin-top: 18px;
  background-color: ${(p) => (p.disabled ? '#d9c7cf' : '#b03060')};
  padding: 14px;
  border-radius: 18px;
  align-items: center;
`;

const ContinueText = styled.Text`
  color: #fff;
  font-weight: 800;
`;

const ModalBackdrop = styled(Pressable)`
  flex: 1;
  background-color: rgba(0, 0, 0, 0.35);
  justify-content: center;
  padding: 24px;
`;

const ModalCard = styled.View`
  background-color: #fff;
  border-radius: 22px;
  padding: 18px;
`;

const ModalTitle = styled.Text`
  font-size: 18px;
  font-weight: 900;
  color: #2f2f2f;
`;

const ModalBody = styled.Text`
  font-size: 13px;
  color: #6b5e58;
  margin-top: 8px;
  margin-bottom: 14px;
`;

const MealInput = styled.TextInput`
  background-color: #f5efe6;
  border-radius: 14px;
  padding: 12px;
  font-size: 14px;
  color: #2f2f2f;
`;

const ModalActionRow = styled.View`
  flex-direction: row;
  justify-content: space-between;
  margin-top: 14px;
`;

const SecondaryBtn = styled.TouchableOpacity`
  flex: 1;
  margin-right: 8px;
  border-radius: 16px;
  border-width: 1px;
  border-color: #b03060;
  padding: 12px;
  align-items: center;
`;

const SecondaryBtnText = styled.Text`
  color: #b03060;
  font-weight: 800;
`;

const ModalBtn = styled.TouchableOpacity`
  flex: 1;
  margin-left: 8px;
  background-color: #b03060;
  padding: 12px;
  border-radius: 16px;
  align-items: center;
`;

const ModalBtnText = styled.Text`
  color: #fff;
  font-weight: 800;
`;
