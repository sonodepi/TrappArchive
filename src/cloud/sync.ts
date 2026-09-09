/**
 * Riconciliazione fra la copia locale e quella nel cloud.
 *
 * Funzioni pure: prendono due elenchi e dicono cosa fare. Non parlano con
 * Firestore, non toccano lo stato di React. È deliberato — è la parte in cui
 * si perdono i testi se si sbaglia, quindi dev'essere verificabile senza rete.
 */

export interface Reconciliation<T> {
  /** Voci in cui la copia locale è più recente: vanno caricate. */
  toPush: T[];
  /** Voci in cui la copia nel cloud è più recente: vanno applicate qui. */
  toApply: T[];
  /** Voci eliminate altrove, da rimuovere anche qui. */
  toDelete: string[];
  /**
   * Voci cambiate su entrambi i lati dall'ultima sincronizzazione: ha vinto la
   * più recente, ma chi sincronizza deve saperlo.
   */
  conflicts: string[];
  /** Voci già allineate. */
  unchanged: number;
}

export interface ReconcileInput<T> {
  local: T[];
  remote: T[];
  /** Quando è avvenuta l'ultima sincronizzazione riuscita, in millisecondi. */
  lastSyncAt: number;
  updatedAtOf: (item: T) => number;
  isDeleted?: (item: T) => boolean;
  idOf?: (item: T) => string;
}

/**
 * Decide, voce per voce, da che parte sta la versione buona.
 *
 * La regola è: vince chi è stato toccato per ultimo. È sufficiente perché ogni
 * traccia, album o bozza si modifica in un posto alla volta; e quando invece
 * la stessa voce è cambiata da entrambe le parti dopo l'ultima
 * sincronizzazione, la cosa viene dichiarata invece di avvenire in silenzio.
 *
 * Il confronto con `lastSyncAt` serve proprio a questo: senza, "modificata solo
 * qui" e "modificata da entrambe le parti" sarebbero indistinguibili, perché in
 * tutti e due i casi una data è più alta dell'altra.
 */
export function reconcile<T>({
  local,
  remote,
  lastSyncAt,
  updatedAtOf,
  isDeleted = () => false,
  idOf = (item: T) => (item as unknown as { id: string }).id,
}: ReconcileInput<T>): Reconciliation<T> {
  const result: Reconciliation<T> = {
    toPush: [], toApply: [], toDelete: [], conflicts: [], unchanged: 0,
  };

  const remoteById = new Map(remote.map(r => [idOf(r), r]));
  const localById = new Map(local.map(l => [idOf(l), l]));

  for (const mine of local) {
    const id = idOf(mine);
    const theirs = remoteById.get(id);

    if (!theirs) {
      // Il cloud non ce l'ha. Se è nato dopo l'ultima sincronizzazione è
      // nuovo e va caricato; se esisteva già, vuol dire che è stato eliminato
      // altrove con la lapide poi ripulita, e va tolto anche qui.
      if (updatedAtOf(mine) > lastSyncAt) result.toPush.push(mine);
      else result.toDelete.push(id);
      continue;
    }

    const mineAt = updatedAtOf(mine);
    const theirsAt = updatedAtOf(theirs);

    if (mineAt === theirsAt) {
      result.unchanged++;
      continue;
    }

    // Toccata da entrambi dopo l'ultimo allineamento: qualcosa si perde.
    if (mineAt > lastSyncAt && theirsAt > lastSyncAt) {
      result.conflicts.push(id);
    }

    if (theirsAt > mineAt) {
      if (isDeleted(theirs)) result.toDelete.push(id);
      else result.toApply.push(theirs);
    } else {
      result.toPush.push(mine);
    }
  }

  // Quello che c'è solo nel cloud: arrivato da un altro dispositivo.
  for (const theirs of remote) {
    const id = idOf(theirs);
    if (localById.has(id)) continue;
    // Una lapide per qualcosa che qui non esiste non ha niente da eliminare.
    if (isDeleted(theirs)) continue;
    result.toApply.push(theirs);
  }

  return result;
}

/** Riassunto leggibile di una sincronizzazione, con numeri veri. */
export function describeSync(parts: Array<{ label: string; r: Reconciliation<unknown> }>): string {
  let pushed = 0, applied = 0, deleted = 0;
  const conflicts: string[] = [];

  for (const { label, r } of parts) {
    pushed += r.toPush.length;
    applied += r.toApply.length;
    deleted += r.toDelete.length;
    if (r.conflicts.length > 0) conflicts.push(`${r.conflicts.length} in ${label}`);
  }

  if (pushed + applied + deleted === 0) return 'Già allineato: nessuna modifica da scambiare.';

  const bits: string[] = [];
  if (pushed > 0) bits.push(`${pushed} inviate`);
  if (applied > 0) bits.push(`${applied} ricevute`);
  if (deleted > 0) bits.push(`${deleted} rimosse`);

  let text = `Sincronizzato: ${bits.join(', ')}.`;
  if (conflicts.length > 0) {
    text += ` Attenzione: ${conflicts.join(', ')} modificate su due dispositivi;` +
            ' ha vinto la versione più recente.';
  }
  return text;
}
