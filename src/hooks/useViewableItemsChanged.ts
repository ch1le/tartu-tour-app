/* ---------- src/hooks/useViewableItemsChanged.ts ---------- */
import { useState, useRef, useCallback } from 'react';
import { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';

/**
 * useViewableItemsChanged
 * -----------------------
 * Tracks which card's bottom has crossed the top of the ScrollView,
 * based on scroll events and registered item layouts. Returns an
 * onScroll handler, activeIndex, and a layout registration callback.
 */
export function useViewableItemsChanged(thresholdOffset: number = 1) {
  const [activeIndex, setActive] = useState(0);
  const scrollY = useRef(0);
  const rowLayouts = useRef<Record<number, { y: number; height: number }>>({});

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      scrollY.current = y;

      // Determine new active index: when a card's bottom crosses threshold
      let newIdx = 0;
      Object.entries(rowLayouts.current).forEach(([key, layout]) => {
        const idx = Number(key);
        if (y >= layout.y + layout.height * thresholdOffset) {
          newIdx = idx + 1;
        }
      });

      // Clamp
      const max = Object.keys(rowLayouts.current).length - 1;
      newIdx = Math.min(Math.max(newIdx, 0), max);

      if (newIdx !== activeIndex) {
        setActive(newIdx);
      }
    },
    [activeIndex, thresholdOffset]
  );

  const registerLayout = useCallback(
    (index: number) => (e: { nativeEvent: { layout: { y: number; height: number } } }) => {
      rowLayouts.current[index] = {
        y: e.nativeEvent.layout.y,
        height: e.nativeEvent.layout.height,
      };
    },
    []
  );

  return { onScroll, activeIndex, registerLayout };
}