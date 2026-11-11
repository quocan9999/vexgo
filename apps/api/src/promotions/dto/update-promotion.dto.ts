import { CreatePromotionDto } from './create-promotion.dto.js';

// Editing replaces all configurable fields; usage counters and scope are server-owned.
export class UpdatePromotionDto extends CreatePromotionDto {}
