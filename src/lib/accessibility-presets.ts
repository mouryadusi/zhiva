// Every preset maps to one or more CSS classes applied to <html> (see
// AccessibilityProvider). Adding a new option means: add it here, add
// its CSS rules in globals.css, done — no component-level branching.

export type A11yCategory = 'vision' | 'movement' | 'cognitive' | 'temporary' | 'night';

export interface A11yOption {
  id: string;
  label: string;
  description: string;
  categories: A11yCategory[];
  cssClasses: string[];
}

export const A11Y_OPTIONS: A11yOption[] = [
  {
    id: 'night',
    label: 'Night Mode',
    description: 'Deep dark surfaces with softened contrast, easier on the eyes after dark.',
    categories: ['vision', 'night'],
    cssClasses: ['a11y-night'],
  },
  {
    id: 'high-contrast',
    label: 'High Contrast',
    description: 'Maximizes separation between text, controls, and surfaces.',
    categories: ['vision'],
    cssClasses: ['a11y-high-contrast'],
  },
  {
    id: 'low-vision',
    label: 'Low Vision',
    description: 'Larger text and touch targets throughout the app.',
    categories: ['vision'],
    cssClasses: ['a11y-low-vision'],
  },
  {
    id: 'dyslexia',
    label: 'Dyslexia',
    description: 'Adjusted typography, letter spacing, and rhythm for easier reading.',
    categories: ['vision', 'cognitive'],
    cssClasses: ['a11y-dyslexia'],
  },
  {
    id: 'visual-fatigue',
    label: 'Visual Fatigue',
    description: 'Calmer contrast and reduced visual noise for tired eyes.',
    categories: ['vision', 'temporary'],
    cssClasses: ['a11y-comfortable-spacing'],
  },
  {
    id: 'green-colour-blindness',
    label: 'Green Colour Blindness',
    description: 'Removes reliance on green/red distinctions for meaning (status, charts).',
    categories: ['vision'],
    cssClasses: ['a11y-colour-safe'],
  },
  {
    id: 'red-colour-blindness',
    label: 'Red Colour Blindness',
    description: 'Removes reliance on red/green distinctions for meaning (status, charts).',
    categories: ['vision'],
    cssClasses: ['a11y-colour-safe'],
  },
  {
    id: 'blue-colour-blindness',
    label: 'Blue Colour Blindness',
    description: 'Removes reliance on blue/yellow distinctions for meaning.',
    categories: ['vision'],
    cssClasses: ['a11y-colour-safe'],
  },
  {
    id: 'achromatopsia',
    label: 'Achromatopsia',
    description: 'Interface relies on shape, label, and contrast rather than colour alone.',
    categories: ['vision'],
    cssClasses: ['a11y-colour-safe', 'a11y-high-contrast'],
  },
  {
    id: 'cataract',
    label: 'Cataract',
    description: 'Stronger contrast and larger text to compensate for clouded vision.',
    categories: ['vision'],
    cssClasses: ['a11y-high-contrast', 'a11y-low-vision'],
  },
  {
    id: 'visual-impairment',
    label: 'Visual Impairment',
    description: 'Maximum text size, spacing, and contrast throughout.',
    categories: ['vision'],
    cssClasses: ['a11y-low-vision', 'a11y-high-contrast', 'a11y-comfortable-spacing'],
  },
  {
    id: 'retinal-migraine',
    label: 'Retinal Migraine',
    description: 'Removes motion and softens contrast during an episode.',
    categories: ['vision', 'temporary'],
    cssClasses: ['a11y-reduced-motion', 'a11y-comfortable-spacing'],
  },
  {
    id: 'amd',
    label: 'AMD',
    description: 'Larger central text and stronger contrast for macular degeneration.',
    categories: ['vision'],
    cssClasses: ['a11y-low-vision', 'a11y-high-contrast'],
  },
  {
    id: 'presbyopia',
    label: 'Presbyopia',
    description: 'Larger text sized for comfortable reading at a distance.',
    categories: ['vision'],
    cssClasses: ['a11y-low-vision'],
  },
  {
    id: 'blue-light',
    label: 'Blue Light',
    description: 'Warmer, dimmer surfaces to reduce blue light exposure.',
    categories: ['vision', 'night'],
    cssClasses: ['a11y-night'],
  },
  {
    id: 'comfortable-spacing',
    label: 'Comfortable Spacing',
    description: 'More breathing room between targets — helpful for tremor or imprecise movement.',
    categories: ['movement'],
    cssClasses: ['a11y-comfortable-spacing'],
  },
  {
    id: 'imprecise-movement',
    label: 'Imprecise Movements',
    description: 'Larger tap targets and generous spacing between interactive elements.',
    categories: ['movement'],
    cssClasses: ['a11y-comfortable-spacing', 'a11y-low-vision'],
  },
  {
    id: 'parkinsons',
    label: "Parkinson's Disease",
    description: 'Larger, more spaced targets to accommodate tremor when tapping.',
    categories: ['movement'],
    cssClasses: ['a11y-comfortable-spacing', 'a11y-low-vision'],
  },
  {
    id: 'essential-tremor',
    label: 'Essential Tremor',
    description: 'Larger, more spaced targets to reduce mis-taps.',
    categories: ['movement'],
    cssClasses: ['a11y-comfortable-spacing', 'a11y-low-vision'],
  },
  {
    id: 'osteoarthritis',
    label: 'Osteoarthritis',
    description: 'Larger touch targets that need less precise movement to hit.',
    categories: ['movement'],
    cssClasses: ['a11y-comfortable-spacing'],
  },
  {
    id: 'multiple-sclerosis',
    label: 'Multiple Sclerosis',
    description: 'Reduced motion and larger, more forgiving controls.',
    categories: ['movement'],
    cssClasses: ['a11y-comfortable-spacing', 'a11y-reduced-motion'],
  },
  {
    id: 'reduced-motion',
    label: 'Reduced Motion',
    description: 'Removes non-essential animation and motion throughout ZHIVA.',
    categories: ['movement', 'cognitive'],
    cssClasses: ['a11y-reduced-motion'],
  },
  {
    id: 'attention',
    label: 'Attention Support',
    description: 'Quiets secondary information so the primary task stands out.',
    categories: ['cognitive'],
    cssClasses: ['a11y-focus'],
  },
  {
    id: 'focus',
    label: 'Focus',
    description: 'Quiets secondary information so the primary task stands out.',
    categories: ['cognitive'],
    cssClasses: ['a11y-focus'],
  },
  {
    id: 'larger-text',
    label: 'Larger Text',
    description: 'Increases text size throughout the app.',
    categories: ['cognitive', 'vision'],
    cssClasses: ['a11y-low-vision'],
  },
];

export const A11Y_PRESETS: { id: string; label: string; optionIds: string[] }[] = [
  { id: 'night', label: 'Night', optionIds: ['night'] },
  { id: 'focus', label: 'Focus', optionIds: ['focus', 'reduced-motion'] },
  { id: 'low-vision', label: 'Low Vision', optionIds: ['low-vision', 'high-contrast'] },
  { id: 'reduced-motion', label: 'Reduced Motion', optionIds: ['reduced-motion'] },
  { id: 'high-contrast', label: 'High Contrast', optionIds: ['high-contrast'] },
  { id: 'comfortable', label: 'Comfortable', optionIds: ['comfortable-spacing', 'dyslexia'] },
];

export function classesForOptionIds(ids: string[]): string[] {
  const set = new Set<string>();
  for (const id of ids) {
    const opt = A11Y_OPTIONS.find((o) => o.id === id);
    opt?.cssClasses.forEach((c) => set.add(c));
  }
  return Array.from(set);
}
