/**
 * Options for every function. Passed explicitly instead of `setGlobalOptions`, because with
 * ES modules the function files are evaluated before index.ts runs, so global options set
 * there arrive too late (the functions silently landed in us-central1).
 *
 * Region: close to the user (Denmark). Must match `functionsRegion` in the web app config.
 * maxInstances: a hard cap so a flood of requests can't run up costs.
 */
export const functionOptions = { region: 'europe-west1', maxInstances: 2 } as const;
