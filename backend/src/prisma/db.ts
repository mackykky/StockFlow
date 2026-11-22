import postgres from '@prisma/orm-postgres/runtime';
import { contractFromJson } from '@prisma/orm-postgres/static';
import contractJson from './contract.json' with { type: 'json' };
import type { Contract } from './contract.d.ts';

const contract = contractFromJson<Contract>(contractJson);

export const db = postgres({
  contract,
});
