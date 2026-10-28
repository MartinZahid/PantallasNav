export type FontStyleKey = 'Bold' | 'Italic' | 'Underline' | 'Strikeout';

const FONT_STYLE_ORDER: FontStyleKey[] = ['Bold', 'Italic', 'Underline', 'Strikeout'];

export type VerticalAlignment = 'Top' | 'Middle' | 'Bottom';
export type HorizontalAlignment = 'Left' | 'Center' | 'Right';

export function parseFontStyles(value: string | null | undefined): Set<FontStyleKey> {
  const source = String(value ?? '').toLowerCase();
  const styles = new Set<FontStyleKey>();
  if (!source) return styles;
  if (source.includes('bold')) styles.add('Bold');
  if (source.includes('italic')) styles.add('Italic');
  if (source.includes('underline')) styles.add('Underline');
  if (source.includes('strikeout') || source.includes('strikethrough') || source.includes('strike')) {
    styles.add('Strikeout');
  }
  return styles;
}

export function toggleFontStyle(value: string | null | undefined, style: FontStyleKey): string {
  const styles = parseFontStyles(value);
  if (styles.has(style)) styles.delete(style);
  else styles.add(style);
  return FONT_STYLE_ORDER.filter((item) => styles.has(item)).join(', ');
}

export function fontCss(value: string | null | undefined): {
  fontWeight?: number;
  fontStyle?: 'italic';
  textDecorationLine?: 'underline' | 'line-through' | 'underline line-through';
} {
  const styles = parseFontStyles(value);
  const textDecorationLine =
    styles.has('Underline') && styles.has('Strikeout')
      ? 'underline line-through'
      : styles.has('Underline')
        ? 'underline'
        : styles.has('Strikeout')
          ? 'line-through'
          : undefined;
  return {
    fontWeight: styles.has('Bold') ? 800 : undefined,
    fontStyle: styles.has('Italic') ? 'italic' : undefined,
    textDecorationLine,
  };
}

export function fontHtml(value: string | null | undefined): string {
  const styles = parseFontStyles(value);
  const decorations = [
    styles.has('Underline') ? 'underline' : '',
    styles.has('Strikeout') ? 'line-through' : '',
  ].filter(Boolean);
  return [
    `font-weight: ${styles.has('Bold') ? 'bold' : 'normal'}`,
    `font-style: ${styles.has('Italic') ? 'italic' : 'normal'}`,
    `text-decoration: ${decorations.length ? decorations.join(' ') : 'none'}`,
  ].join('; ');
}

export function splitAlignment(value: string | null | undefined): {
  vertical: VerticalAlignment;
  horizontal: HorizontalAlignment;
} {
  const source = String(value ?? '');
  const vertical: VerticalAlignment = source.includes('Top')
    ? 'Top'
    : source.includes('Bottom')
      ? 'Bottom'
      : 'Middle';
  const horizontal: HorizontalAlignment = source.includes('Left')
    ? 'Left'
    : source.includes('Right')
      ? 'Right'
      : 'Center';
  return { vertical, horizontal };
}

export function composeAlignment(
  vertical: VerticalAlignment,
  horizontal: HorizontalAlignment,
): string {
  return `${vertical}${horizontal}`;
}
