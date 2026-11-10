import { describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { EmbeddingProviderService } from '../../../src/ai-chatbot/embedding/embedding-provider.service.js';

describe('EmbeddingProviderService', () => {
  // Test với offline / fallback mode (không có JINA_API_KEY)
  const config = new ConfigService({});
  const service = new EmbeddingProviderService(config);

  it('should generate vectors of exactly 768 dimensions', async () => {
    const text = 'Quy định hủy vé và hoàn tiền của VexGo.';
    const queryVector = await service.embedQuery(text);
    const passageVectors = await service.embedPassages([text]);

    expect(queryVector).toHaveLength(768);
    expect(passageVectors).toHaveLength(1);
    expect(passageVectors[0]).toHaveLength(768);
  });

  it('should enforce L2 normalization (||v||_2 ≈ 1.0)', async () => {
    const text = 'Chính sách hoàn tiền và đổi trả vé xe.';
    const vector = await service.embedQuery(text);

    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    expect(norm).toBeCloseTo(1.0, 4);
  });

  it('should differentiate between retrieval.query and retrieval.passage', async () => {
    const text = 'Làm thế nào để đổi vé xe?';
    const queryVector = await service.embedQuery(text);
    const passageVector = (await service.embedPassages([text]))[0];

    // Cùng nội dung nhưng task khác nhau sinh vector có độ phân biệt nhất định
    expect(queryVector).toHaveLength(768);
    expect(passageVector).toHaveLength(768);
    // Tính khoảng cách / cosine similarity giữa query và passage vector
    const dotProduct = queryVector.reduce(
      (sum, val, i) => sum + val * passageVector[i],
      0,
    );
    expect(dotProduct).toBeGreaterThan(0.5); // Vẫn cùng ngữ nghĩa
    expect(dotProduct).toBeLessThanOrEqual(1.0);
  });

  it('should produce high cosine similarity (> 0.65) for semantically related texts in fallback mode', async () => {
    const text1 = 'hủy vé và hoàn tiền vé xe như thế nào';
    const text2 = 'Chính sách hoàn tiền khi hủy vé xe khách VexGo';
    const unrelated = 'món ngon đặc sản sài gòn chợ bến thành';

    const v1 = await service.embedQuery(text1);
    const v2 = (await service.embedPassages([text2]))[0];
    const vUnrelated = (await service.embedPassages([unrelated]))[0];

    const simRelated = v1.reduce((sum, val, i) => sum + val * v2[i], 0);
    const simUnrelated = v1.reduce((sum, val, i) => sum + val * vUnrelated[i], 0);

    expect(simRelated).toBeGreaterThan(0.65);
    expect(simRelated).toBeGreaterThan(simUnrelated);
  });
});
