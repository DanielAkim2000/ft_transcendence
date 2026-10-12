import { parentPort, workerData } from 'worker_threads';
import { AiLevel, chooseMove } from './chess-ai';

// Le calcul tourne hors du thread principal pour ne pas bloquer les sockets.
const { fen, level } = workerData as { fen: string; level: AiLevel };
parentPort?.postMessage(chooseMove(fen, level));
