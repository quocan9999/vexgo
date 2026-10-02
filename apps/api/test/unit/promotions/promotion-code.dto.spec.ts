import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { PromotionCodeDto } from '../../../src/promotions/dto/promotion-code.dto.js';

describe('PromotionCodeDto', () => {
  it('normalizes a documented code to uppercase', async () => {
    const dto = plainToInstance(PromotionCodeDto, {
      promotionCode: ' trip20 ',
    });

    expect(dto.promotionCode).toBe('TRIP20');
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each(['A', 'CODE WITH SPACE', 'CODE-20', '長いコード'])(
    'rejects a code outside the documented format: %s',
    async (promotionCode) => {
      const dto = plainToInstance(PromotionCodeDto, { promotionCode });
      await expect(validate(dto)).resolves.not.toHaveLength(0);
    },
  );

  it('allows the promotion code to be omitted', async () => {
    const dto = plainToInstance(PromotionCodeDto, {});
    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
