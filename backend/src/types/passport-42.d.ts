declare module 'passport-42' {
  export interface StrategyOptions {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
    scope?: string | string[];
  }

  export class Strategy {
    /** Crée la stratégie OAuth 42 avec ses options et un callback de vérification optionnel. */
    constructor(
      options: StrategyOptions,
      verify?: (
        accessToken: string,
        refreshToken: string,
        profile: unknown,
        done: (error: unknown, user?: unknown) => void,
      ) => void,
    );
  }
}
