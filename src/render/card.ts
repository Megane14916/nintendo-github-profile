import type { GamePresence } from '../model/presence';
import type { CardAssets } from './assets';
import { getCardCopy, type CardCopyOptions } from './copy';
import { renderAlternateCard } from './layouts/alternate';
import { concepts } from './layouts/concepts';
import { renderConcept } from './layouts/concepts/drawing';
import { renderDefaultCard } from './layouts/default';
import { cardLayouts } from './layouts/presets';
import { greenTheme, redTreatments, switchTheme } from './themes';

const emptyAssets: CardAssets = {
  avatarDataUri: null,
  gameImageDataUri: null,
};

const proposals = new Map(
  Object.entries(cardLayouts).flatMap(([layoutName, layout]) =>
    Object.entries(redTreatments).map(([treatment, theme]) =>
      [layoutName + '-' + treatment, { layout, theme }] as const,
    ),
  ),
);

type ProposalStyle = `${keyof typeof cardLayouts}-${keyof typeof redTreatments}`;
type ConceptStyle = keyof typeof concepts;
type CardStyle = 'default' | 'green' | ProposalStyle | ConceptStyle;

function isConceptStyle(value: string): value is ConceptStyle {
  return Object.hasOwn(concepts, value);
}

export function resolveCardStyle(value: string | undefined): CardStyle {
  if (value === 'profile') return 'profile-white';
  if (value === 'editorial') return 'reverse-serif';
  if (value === 'green' || (value && isConceptStyle(value))) return value;
  return value && proposals.has(value) ? value as ProposalStyle : 'default';
}

export function renderCard(
  presence: GamePresence,
  assets: CardAssets = emptyAssets,
  style: CardStyle = 'default',
  options?: CardCopyOptions,
): string {
  const copy = getCardCopy(presence, options);
  if (isConceptStyle(style)) return renderConcept(presence, assets, concepts[style], copy);
  const proposal = proposals.get(style);
  if (proposal) return renderAlternateCard(presence, assets, proposal.theme, proposal.layout, copy);
  return renderDefaultCard(presence, assets, style === 'green' ? greenTheme : switchTheme, copy);
}
