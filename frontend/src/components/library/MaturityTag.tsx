import type { Maturity } from '@/types/library';
import { MATURITY_CLASS } from './libraryFormat';

type MaturityTagProps = { maturity: Maturity; raw: string };

/** A forma e a cor vêm do chip agrupado; o texto é o valor escrito no manifesto. */
export function MaturityTag({ maturity, raw }: MaturityTagProps) {
  return <span className={MATURITY_CLASS[maturity].tag}>{raw}</span>;
}
