import { useRef, useState } from 'react';
import { ViewToken } from 'react-native';

/**
 * Tracks which item of a FlatList is ≥ 60 % visible.
 * Returns { index, onViewableItemsChanged, viewConfig }.
 */
export function useViewableIndex() {
  const [index, setIndex] = useState(0);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        setIndex(viewableItems[0].index ?? 0);
      }
    }
  ).current;

  const viewConfig = { itemVisiblePercentThreshold: 60 };

  return { index, onViewableItemsChanged, viewConfig };
}
