export const conditionConfig = {
  likeNew: {
    label: 'Like New',
    variant: 'success' as const,
    description: 'Appears unplayed or played once. Components pristine.',
  },
  veryGood: {
    label: 'Very Good',
    variant: 'default' as const,
    description: 'Minimal wear. All components present and in great shape.',
  },
  good: {
    label: 'Good',
    variant: 'warning' as const,
    description: 'Shows play wear but fully functional. All components present.',
  },
  acceptable: {
    label: 'Acceptable',
    variant: 'warning' as const,
    description: 'Significant wear but playable. May have minor damage.',
  },
  forParts: {
    label: 'For Parts',
    variant: 'error' as const,
    description: 'Incomplete or damaged. Sold as-is for parts/crafts.',
  },
};
