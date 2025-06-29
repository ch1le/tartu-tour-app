import { useState, useRef } from 'react';
import {
  ViewToken,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';

/* enable LayoutAnimation on Android once */
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function useViewability() {
  const [activeIndex, setActive] = useState(0);
  const [visibleSet, setVisible] = useState<Set<number>>(new Set());

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

      const next = new Set<number>();
      viewableItems.forEach(v => {
        if (v.isViewable && v.index != null) {
          next.add(v.index);               // 👈 keep only truly visible ones
        }
      });
      setVisible(next);

      /* pick first *visible* row as active */
      const firstVisible = viewableItems.find(v => v.isViewable);
      if (firstVisible?.index != null) {
        setActive(firstVisible.index);
      }
    }
  ).current;

  const viewConfig = { itemVisiblePercentThreshold: 40 };

  return { activeIndex, visibleSet, onViewableItemsChanged, viewConfig };
}
