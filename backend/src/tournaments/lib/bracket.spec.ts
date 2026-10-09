import { planLegCorrection, resolveTie, type TieLeg } from './bracket';

const leg = (
  legNumber: number,
  scoreA: number | null,
  scoreB: number | null,
  status = 'COMPLETED',
): TieLeg => ({ legNumber, status, scoreA, scoreB });

describe('planLegCorrection', () => {
  it('single leg: a tweak that keeps the winner changes nothing else', () => {
    const plan = planLegCorrection(false, [leg(1, 10, 3)], 1, 10, 8);
    expect(plan.legWinnerFlipped).toBe(false);
    expect(plan.tieOutcomeChanged).toBe(false);
    expect(plan.after).toMatchObject({ done: true, winnerSide: 'A' });
  });

  it('single leg: swapped teams flips the leg and the tie winner', () => {
    const plan = planLegCorrection(false, [leg(1, 10, 3)], 1, 3, 10);
    expect(plan.legWinnerFlipped).toBe(true);
    expect(plan.tieOutcomeChanged).toBe(true);
    expect(plan.before.winnerSide).toBe('A');
    expect(plan.after.winnerSide).toBe('B');
  });

  it('two legs: flipping one leg can leave the aggregate winner unchanged', () => {
    // A: 10+10 = 20 vs B: 2+9 = 11 ; la manche 2 corrigée en 9-10 -> 19 vs 12, A gagne encore
    const plan = planLegCorrection(
      true,
      [leg(1, 10, 2), leg(2, 10, 9)],
      2,
      9,
      10,
    );
    expect(plan.legWinnerFlipped).toBe(true);
    expect(plan.tieOutcomeChanged).toBe(false);
    expect(plan.after.winnerSide).toBe('A');
  });

  it('two legs: a correction that creates an aggregate tie requires the decider', () => {
    // 10-5 puis 5-10 => 15-15 ; décidé avant par 10-5 / 10-9 (20-14)
    const plan = planLegCorrection(
      true,
      [leg(1, 10, 5), leg(2, 10, 9)],
      2,
      5,
      10,
    );
    expect(plan.before).toMatchObject({ done: true, winnerSide: 'A' });
    expect(plan.after).toMatchObject({ done: false, nextLegNumber: 3 });
    expect(plan.tieOutcomeChanged).toBe(true);
  });

  it('two legs + decider: a correction that breaks the tie makes the decider obsolete', () => {
    const legs = [leg(1, 10, 5), leg(2, 5, 10), leg(3, 10, 7)];
    expect(resolveTie(true, legs)).toMatchObject({
      done: true,
      winnerSide: 'A',
    });
    const plan = planLegCorrection(true, legs, 2, 3, 10);
    // agrégat 13-15 : B gagne sans belle
    expect(plan.after).toMatchObject({ done: true, winnerSide: 'B' });
    expect(plan.tieOutcomeChanged).toBe(true);
  });

  it('first leg of two: the tie stays undecided', () => {
    const plan = planLegCorrection(true, [leg(1, 10, 3)], 1, 3, 10);
    expect(plan.before.done).toBe(false);
    expect(plan.after.done).toBe(false);
    expect(plan.tieOutcomeChanged).toBe(false);
    expect(plan.legWinnerFlipped).toBe(true);
  });
});
