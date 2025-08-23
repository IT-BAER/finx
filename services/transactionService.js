/**
 * DEPRECATED: This module is unused.
 * It has been replaced by controller-level logic. Keeping a stub to avoid breaking
 * any accidental imports; all methods will throw if called.
 */

const deprecated = new Proxy(
  {},
  {
    get() {
      throw new Error(
        "TransactionService is deprecated and unused. Remove the import or migrate to controllers.",
      );
    },
  },
);

module.exports = deprecated;
