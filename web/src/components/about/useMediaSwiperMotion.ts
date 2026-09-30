'use client';

import { useSyncExternalStore } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { mediaSwiperSpeed } from './mediaSwiperPolicy';
import 'swiper/css';
import 'swiper/css/a11y';

const query = '(prefers-reduced-motion: reduce)';
function subscribe(listener: () => void) {
  const preference = window.matchMedia(query);
  preference.addEventListener('change', listener);
  return () => preference.removeEventListener('change', listener);
}
const browserSnapshot = () => window.matchMedia(query).matches;
const serverSnapshot = () => false;

/** CSS가 모션을 끌 때 Swiper의 animating 상태도 즉시 완료되도록 합니다. */
export function useMediaSwiperSpeed(): number {
  const { motion } = useTheme();
  const systemReduced = useSyncExternalStore(subscribe, browserSnapshot, serverSnapshot);
  return mediaSwiperSpeed(motion, systemReduced);
}
