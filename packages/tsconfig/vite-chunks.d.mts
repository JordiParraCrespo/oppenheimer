/**
 * Rollup `manualChunks` callback: returns the vendor chunk a module belongs in,
 * or `undefined` to leave it where Rollup put it.
 */
export declare function vendorChunks(id: string): string | undefined;
