export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
export const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
export const round = (value: number, precision = 2) => Number(value.toFixed(precision));
