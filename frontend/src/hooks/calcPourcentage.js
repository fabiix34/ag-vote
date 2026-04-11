
export const calcPourcentage = (part, total) => {
  if (!total || total === 0) return 0;
  return Math.round((part / total) * 100);
};
