import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView } from 'react-native';
import styled from 'styled-components/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function LogSeizureSymptoms({ route, navigation }) {
  const { userId } = route.params;

  const tiles = useMemo(
    () => [
      { key: 'Twitch', icon: 'flash-outline' },
      { key: 'Muscle spasm', icon: 'arm-flex-outline' },
      { key: 'Jerk', icon: 'lightning-bolt-outline' },
      { key: 'Eye roll', icon: 'eye-outline' },
      { key: 'Convulsions', icon: 'pulse' },
      { key: 'Awareness', icon: 'head-outline' }, // opens modal
    ],
    []
  );

  const [selected, setSelected] = useState([]); // symptoms (excluding awareness option)
  const [symptomsNone, setSymptomsNone] = useState(false);

  const [videoModal, setVideoModal] = useState(null); // tile key
  const [awarenessModalOpen, setAwarenessModalOpen] = useState(false);
  const [awareness, setAwareness] = useState(null); // required

  const toggle = (key) => {
    if (key === 'Awareness') {
      setAwarenessModalOpen(true);
      return;
    }

    // if user pressed None previously, remove it
    setSymptomsNone(false);

    setSelected((prev) => {
      if (prev.includes(key)) return prev.filter((x) => x !== key);
      return [...prev, key];
    });
  };

  const pressNone = () => {
    setSelected([]);
    setSymptomsNone(true);
  };

  const pressOther = () => {
    // we treat "Other" as a symptom selection
    setSymptomsNone(false);
    setSelected((prev) => (prev.includes('Other') ? prev : [...prev, 'Other']));
  };

  const canContinue = awareness != null && (symptomsNone || selected.length > 0);

  return (
    <Container>
      <TopBar>
        <BackBtn onPress={() => navigation.goBack()}>
          <TopIcon name="chevron-left" />
        </BackBtn>
        <TopTitle>Log Seizure</TopTitle>
        <TopSpacer />
      </TopBar>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 30 }}>
        <Title>Select what happened</Title>
        <SubTitle>Choose symptoms, then continue.</SubTitle>
        <SubTitle>Awareness must be selected.</SubTitle>

        <Grid>
          {tiles.map((t) => {
            const isAwareness = t.key === 'Awareness';
            const isSelected = selected.includes(t.key);
            const showSelected = isSelected || (isAwareness && awareness != null);

            return (
              <Tile key={t.key} active={showSelected} onPress={() => toggle(t.key)}>
                <TileInner>
                  <TileIcon name={t.icon} active={showSelected} />
                  <TileText active={showSelected}>
                    {t.key === 'Awareness' && awareness
                      ? `Awareness: ${labelAwareness(awareness)}`
                      : t.key}
                  </TileText>

                  <PlayBtn
                    onPress={() => {
                      // placeholder modal for now
                      setVideoModal(t.key);
                    }}
                  >
                    <PlayIcon name="play-circle-outline" active={showSelected} />
                  </PlayBtn>
                </TileInner>
              </Tile>
            );
          })}
        </Grid>

        <BottomRow>
          <SlimBtn onPress={pressOther} active={selected.includes('Other')}>
            <SlimBtnText active={selected.includes('Other')}>Other</SlimBtnText>
          </SlimBtn>

          <SlimBtn onPress={pressNone} active={symptomsNone}>
            <SlimBtnText active={symptomsNone}>None</SlimBtnText>
          </SlimBtn>
        </BottomRow>

        <ContinueBtn
          disabled={!canContinue}
          onPress={() =>
            navigation.navigate('LogSeizureDetails', {
              userId,
              symptoms: selected,
              symptomsNone,
              awareness,
            })
          }
        >
          <ContinueText disabled={!canContinue}>Continue</ContinueText>
        </ContinueBtn>
      </ScrollView>

      {/* VIDEO PLACEHOLDER MODAL */}
      <Modal transparent visible={videoModal != null} animationType="fade">
        <ModalBackdrop onPress={() => setVideoModal(null)}>
          <ModalCard>
            <ModalTitle>Video demo</ModalTitle>
            <ModalBody>
              Placeholder for: <Bold>{videoModal}</Bold>
              {'\n\n'}Later you’ll swap this for a real video.
            </ModalBody>

            <ModalBtn onPress={() => setVideoModal(null)}>
              <ModalBtnText>Close</ModalBtnText>
            </ModalBtn>
          </ModalCard>
        </ModalBackdrop>
      </Modal>

      {/* AWARENESS MODAL */}
      <Modal transparent visible={awarenessModalOpen} animationType="fade">
        <ModalBackdrop onPress={() => setAwarenessModalOpen(false)}>
          <ModalCard>
            <ModalTitle>Awareness</ModalTitle>
            <ModalBody>Select one option (required).</ModalBody>

            {[
              { k: 'LOSS_OF_CONSCIOUSNESS', label: 'Loss of consciousness' },
              { k: 'IMPAIRED', label: 'Impaired awareness' },
              { k: 'AWARE', label: 'Aware (fully responsive)' },
            ].map((o) => (
              <OptionRow
                key={o.k}
                onPress={() => setAwareness(o.k)}
                active={awareness === o.k}
              >
                <OptionDot active={awareness === o.k} />
                <OptionText active={awareness === o.k}>{o.label}</OptionText>
              </OptionRow>
            ))}

            <ModalBtn
              onPress={() => setAwarenessModalOpen(false)}
              disabled={awareness == null}
            >
              <ModalBtnText>Continue</ModalBtnText>
            </ModalBtn>
          </ModalCard>
        </ModalBackdrop>
      </Modal>
    </Container>
  );
}

function labelAwareness(a) {
  if (a === 'LOSS_OF_CONSCIOUSNESS') return 'Loss of consciousness';
  if (a === 'IMPAIRED') return 'Impaired';
  if (a === 'AWARE') return 'Aware';
  if (a === 'OTHER') return 'Other';
  if (a === 'NONE') return 'None';
  return a;
}

/* styled */
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
  min-height: 86px;
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

const PlayBtn = styled.TouchableOpacity`
  position: absolute;
  right: 0px;
  bottom: 0px;
  padding: 2px;
`;

const PlayIcon = styled(Icon)`
  font-size: 26px;
  color: ${(p) => (p.active ? '#b03060' : '#8b7e76')};
`;

const BottomRow = styled.View`
  flex-direction: row;
  justify-content: space-between;
  margin-top: 6px;
`;

const SlimBtn = styled.TouchableOpacity`
  width: 48%;
  padding: 12px;
  border-radius: 14px;
  background-color: ${(p) => (p.active ? '#e7c7d3' : '#ffffff')};
  border: 2px solid ${(p) => (p.active ? '#b03060' : '#ffffff')};
  align-items: center;
`;

const SlimBtnText = styled.Text`
  font-weight: 800;
  color: ${(p) => (p.active ? '#b03060' : '#2f2f2f')};
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

const Bold = styled.Text`font-weight: 900;`;

const ModalBtn = styled.TouchableOpacity`
  background-color: #b03060;
  padding: 12px;
  border-radius: 16px;
  align-items: center;
`;

const ModalBtnText = styled.Text`
  color: #fff;
  font-weight: 800;
`;

const OptionRow = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
  padding: 10px 6px;
  border-radius: 12px;
  background-color: ${(p) => (p.active ? '#f5efe6' : 'transparent')};
`;

const OptionDot = styled.View`
  width: 12px;
  height: 12px;
  border-radius: 6px;
  border-width: 2px;
  border-color: #b03060;
  background-color: ${(p) => (p.active ? '#b03060' : 'transparent')};
  margin-right: 10px;
`;

const OptionText = styled.Text`
  font-size: 13px;
  font-weight: ${(p) => (p.active ? '800' : '600')};
  color: ${(p) => (p.active ? '#b03060' : '#2f2f2f')};
`;
