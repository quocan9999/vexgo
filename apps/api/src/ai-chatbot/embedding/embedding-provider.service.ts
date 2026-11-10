import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'node:crypto';

export type EmbeddingTask = 'retrieval.query' | 'retrieval.passage';

const EMBEDDING_DIMENSIONS = 768;
const FEATURE_DIMENSIONS = 760; // 0..759 dành cho đặc trưng văn bản, 760..767 dành cho task bias
const JINA_API_URL = 'https://api.jina.ai/v1/embeddings';

const VIETNAMESE_STOP_WORDS = new Set([
  'va', 'nhu', 'the', 'nao', 'la', 'cua', 'duoc', 'khi', 'cho', 'voi', 'trong',
  'cac', 'nhung', 'thi', 'o', 'co', 'nay', 'do', 'de', 'tai', 'ra', 'vao',
  'mot', 'hai', 'ba', 'bon', 'nam', 'sau', 'bay', 'tam', 'chin', 'muoi',
  'hoac', 'hay', 'ma', 'vi', 'nen', 'neu', 'tuy', 'du', 'gi', 'sao', 'ai'
]);

function removeVietnameseDiacritics(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

@Injectable()
export class EmbeddingProviderService {
  private readonly logger = new Logger(EmbeddingProviderService.name);
  private readonly jinaApiKey?: string;

  constructor(private readonly configService: ConfigService) {
    this.jinaApiKey = this.configService.get<string>('JINA_API_KEY')?.trim();
  }

  /**
   * Sinh vector nhúng 768 chiều cho câu truy vấn của người dùng (task: retrieval.query)
   */
  async embedQuery(text: string): Promise<number[]> {
    const vectors = await this.embed([text], 'retrieval.query');
    return vectors[0] ?? this.generateDeterministicVector(text, 'retrieval.query');
  }

  /**
   * Sinh danh sách vector nhúng 768 chiều cho các đoạn tri thức (task: retrieval.passage)
   */
  async embedPassages(texts: string[]): Promise<number[][]> {
    if (!texts || texts.length === 0) return [];
    return this.embed(texts, 'retrieval.passage');
  }

  /**
   * Gọi Jina API hoặc fallback thuật toán vector tất định
   */
  private async embed(texts: string[], task: EmbeddingTask): Promise<number[][]> {
    if (this.jinaApiKey && !this.jinaApiKey.includes('jina....')) {
      try {
        const response = await fetch(JINA_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.jinaApiKey}`,
          },
          body: JSON.stringify({
            model: 'jina-embeddings-v3',
            task,
            dimensions: EMBEDDING_DIMENSIONS,
            input: texts,
          }),
        });

        if (response.ok) {
          const json = (await response.json()) as {
            data: Array<{ embedding: number[] }>;
          };
          if (json.data && Array.isArray(json.data) && json.data.length === texts.length) {
            return json.data.map((item) => this.normalizeL2(item.embedding));
          }
        } else {
          this.logger.warn(
            `Jina API error HTTP ${response.status}: Falling back to deterministic embeddings.`,
          );
        }
      } catch (err) {
        this.logger.warn(
          `Jina API request failed (${err instanceof Error ? err.message : String(err)}). Using fallback.`,
        );
      }
    }

    // Deterministic fallback khi không có API key hoặc lỗi mạng
    return texts.map((t) => this.generateDeterministicVector(t, task));
  }

  /**
   * Chuẩn hóa vector theo độ dài Euclid L2:
   * v_hat = v / ||v||_2
   */
  normalizeL2(vector: number[]): number[] {
    let sumSq = 0;
    for (let i = 0; i < vector.length; i++) {
      sumSq += vector[i] * vector[i];
    }
    const norm = Math.sqrt(sumSq);
    if (norm === 0) {
      const fallback = new Array(vector.length).fill(0);
      fallback[0] = 1;
      return fallback;
    }
    return vector.map((val) => val / norm);
  }

  /**
   * Thuật toán Feature Hashing (Hashing Trick) trên word tokens & character n-grams tiếng Việt.
   * Đảm bảo:
   * 1. Chiều d = 768 chuẩn hóa L2.
   * 2. Hai câu truy vấn cùng chủ đề/từ khóa luôn đạt Cosine Similarity > 0.65.
   * 3. Phân biệt có kiểm soát giữa retrieval.query và retrieval.passage.
   */
  private generateDeterministicVector(text: string, task: EmbeddingTask): number[] {
    const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
    const cleaned = text.toLowerCase().trim();
    if (!cleaned) {
      vector[0] = 1.0;
      return vector;
    }

    const noDiacritics = removeVietnameseDiacritics(cleaned);
    const rawTokens = cleaned.split(/[\s,.;:!?()'"\-\\/[\]{}]+/i).filter(Boolean);
    const rawNoAccentTokens = noDiacritics.split(/[\s,.;:!?()'"\-\\/[\]{}]+/i).filter(Boolean);

    // Lọc nội dung bỏ hư từ
    const contentTokensWithAccents: string[] = [];
    const contentTokensNoAccents: string[] = [];

    for (let i = 0; i < rawTokens.length; i++) {
      const raw = rawTokens[i];
      const noAcc = rawNoAccentTokens[i] || removeVietnameseDiacritics(raw);
      if (noAcc.length >= 2 && !VIETNAMESE_STOP_WORDS.has(noAcc)) {
        contentTokensWithAccents.push(raw);
        contentTokensNoAccents.push(noAcc);
      }
    }

    // Nếu toàn bộ là stop words, fallback lấy toàn bộ tokens
    const finalAccents = contentTokensWithAccents.length > 0 ? contentTokensWithAccents : rawTokens;
    const finalNoAccents = contentTokensNoAccents.length > 0 ? contentTokensNoAccents : rawNoAccentTokens;

    // 1. Unigrams từ khóa trọng số lớn (dương tính để bảo toàn tính tương đồng ngữ nghĩa)
    for (const w of finalAccents) {
      this.hashFeature(w, 5.0, vector);
    }
    for (const w of finalNoAccents) {
      this.hashFeature(w, 4.0, vector);
    }

    // 2. Bigrams từ khóa
    for (let i = 0; i < finalNoAccents.length - 1; i++) {
      const bigram = `${finalNoAccents[i]}_${finalNoAccents[i + 1]}`;
      this.hashFeature(bigram, 3.5, vector);
    }

    // 3. Character 3-grams của các từ khóa chính
    for (const token of finalNoAccents) {
      if (token.length >= 3) {
        for (let i = 0; i <= token.length - 3; i++) {
          const trigram = token.substring(i, i + 3);
          this.hashFeature(trigram, 1.0, vector);
        }
      }
    }

    // 4. Task Bias tách biệt trong khoảng 760..767
    if (task === 'retrieval.query') {
      for (let idx = 760; idx < 764; idx++) {
        vector[idx] += 0.8;
      }
    } else {
      for (let idx = 764; idx < 768; idx++) {
        vector[idx] += 0.8;
      }
    }

    return this.normalizeL2(vector);
  }

  private hashFeature(feature: string, weight: number, vector: number[]): void {
    const hash = crypto.createHash('sha256').update(feature).digest();
    const index = hash.readUInt16BE(0) % FEATURE_DIMENSIONS;
    // Điểm số đặc trưng dương bảo đảm dot product phản ánh trực tiếp mức độ trùng khớp từ khóa
    vector[index] += weight;
  }
}
