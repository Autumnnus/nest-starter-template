import { z } from 'zod';

export const zBooleanFlag = z.preprocess((value) => {
  if (typeof value !== 'string') return undefined;

  const v = value.trim().toLowerCase();
  if (v === 'true') return true;

  if (v === 'false') return false;

  return undefined;
}, z.boolean().optional());

export const zNumberFromEnv = (opts?: {
  int?: boolean;
  positive?: boolean;
  min?: number;
  max?: number;
}) => {
  let s = z.coerce.number();
  if (opts?.int) s = s.int();

  if (opts?.positive) s = s.positive();

  if (opts?.min !== undefined) s = s.min(opts.min);

  if (opts?.max !== undefined) s = s.max(opts.max);

  return s;
};

export const zStringList = (delim = ',') =>
  z.string().transform((v) =>
    v
      .split(delim)
      .map((x) => x.trim())
      .filter(Boolean),
  );
