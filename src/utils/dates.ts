export const startOfUTCDay = (date = new Date()): Date => {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
};

export const endOfUTCDay = (date = new Date()): Date => {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
};

export const nowUtc = (): Date => {
  return new Date();
};
