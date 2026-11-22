/**
 * O ícone de estado com o tooltip (`title`) que o diz por palavras: cor e forma, nunca só cor (tokens §3). Quem o
 * usa decide o ícone (`terminalStateMeta`, `summarizeActivity`); o invólucro dá uma área de hover maior do que os
 * 8 px do losango. `slot` reserva 14 px (alinha os ícones de uma lista); sem ele ocupa só o que mede.
 */
export function StateIcon({ icon, title, slot = false }: { icon: string; title: string; slot?: boolean }) {
  return (
    <span className={`inline-flex flex-none justify-center ${slot ? 'w-3.5' : ''}`} title={title} data-state-icon={icon}>
      <span className={`state-icon ${icon}`} aria-hidden />
    </span>
  );
}
