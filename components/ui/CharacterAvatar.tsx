import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { getCharacterStyle, CharacterStyleId } from '@/src/theme/characterStyles';

type CharacterAvatarProps = {
  styleId: CharacterStyleId | null;
  size?: number;
  accentColor: string;
  backgroundColor?: string;
};

export function CharacterAvatar({
  styleId,
  size = 56,
  accentColor,
  backgroundColor,
}: CharacterAvatarProps) {
  const motionReduced = useReducedMotion();
  const progress = useSharedValue(0);
  const character = styleId ? getCharacterStyle(styleId) : null;

  useEffect(() => {
    if (!character || motionReduced) {
      progress.value = 0;
      return;
    }
    progress.value = withRepeat(
      withTiming(1, { duration: character.duration, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [character, motionReduced, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    if (!character || motionReduced) return {};
    return {
      transform: [
        { translateY: -Math.sin(progress.value * Math.PI) * character.lift },
        { rotate: `${Math.sin(progress.value * Math.PI * 2) * character.rotation}deg` },
        { scale: 1 + Math.sin(progress.value * Math.PI) * character.scale },
      ],
    };
  }, [character, motionReduced]);

  if (!character) return null;

  return (
    <Animated.View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${character.label} character`}
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: backgroundColor ?? `${accentColor}22`,
        },
        animatedStyle,
      ]}>
      <View style={[styles.accent, { backgroundColor: accentColor }]} />
      <Text accessibilityElementsHidden style={{ fontSize: size * 0.52, lineHeight: size * 0.68 }}>
        {character.emoji}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  accent: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.1,
  },
});
