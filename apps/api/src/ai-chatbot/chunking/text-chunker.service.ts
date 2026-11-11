import { Injectable } from '@nestjs/common';

export interface TextChunk {
  chunkIndex: number;
  headerPrefix: string;
  rawContent: string;
  groundedContent: string;
}

export interface SplitOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  separators?: string[];
}

const DEFAULT_SEPARATORS = ['\n\n', '\n', '. ', '; ', ', ', ' ', ''];
const DEFAULT_CHUNK_SIZE = 500;
const DEFAULT_CHUNK_OVERLAP = 100;

@Injectable()
export class TextChunkerService {
  /**
   * Phân đoạn văn bản đệ quy có gắn nhãn ngữ cảnh phân cấp:
   * C_i^{grounded} = H_i ⊕ C_i
   */
  splitText(
    text: string,
    hierarchyPath: string,
    options: SplitOptions = {},
  ): TextChunk[] {
    const trimmed = text.trim();
    if (!trimmed) {
      return [];
    }

    const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
    const chunkOverlap = Math.min(
      options.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP,
      Math.floor(chunkSize / 2),
    );
    const separators = options.separators ?? DEFAULT_SEPARATORS;

    const rawChunks = this.recursiveSplit(trimmed, separators, chunkSize, chunkOverlap);

    return rawChunks.map((rawContent, index) => ({
      chunkIndex: index,
      headerPrefix: hierarchyPath,
      rawContent,
      groundedContent: hierarchyPath ? `${hierarchyPath}\n\n${rawContent}` : rawContent,
    }));
  }

  private recursiveSplit(
    text: string,
    separators: string[],
    chunkSize: number,
    chunkOverlap: number,
  ): string[] {
    const trimmed = text.trim();
    if (!trimmed) return [];
    if (trimmed.length <= chunkSize) {
      return [trimmed];
    }

    // Tìm ký tự phân tách phù hợp nhất có xuất hiện trong chuỗi
    let separator = separators[separators.length - 1];
    let newSeparators: string[] = [];

    for (let i = 0; i < separators.length; i++) {
      const sep = separators[i];
      if (sep === '') {
        separator = '';
        newSeparators = [];
        break;
      }
      if (trimmed.includes(sep)) {
        separator = sep;
        newSeparators = separators.slice(i + 1);
        break;
      }
    }

    // Tách các đoạn con
    const splits = separator === '' ? Array.from(trimmed) : trimmed.split(separator);
    const goodSplits: string[] = [];

    for (const s of splits) {
      if (s.length < chunkSize) {
        goodSplits.push(s);
      } else if (newSeparators.length > 0) {
        goodSplits.push(...this.recursiveSplit(s, newSeparators, chunkSize, chunkOverlap));
      } else {
        // Cắt thô theo chunkSize nếu không còn ký tự phân tách nào
        for (let j = 0; j < s.length; j += chunkSize - chunkOverlap) {
          goodSplits.push(s.slice(j, j + chunkSize));
        }
      }
    }

    // Gộp các đoạn con lại với nhau sao cho kích thước mỗi chunk <= chunkSize có tính overlap
    return this.mergeSplits(goodSplits, separator, chunkSize, chunkOverlap);
  }

  private mergeSplits(
    splits: string[],
    separator: string,
    chunkSize: number,
    chunkOverlap: number,
  ): string[] {
    const docs: string[] = [];
    const currentDoc: string[] = [];
    let total = 0;

    for (const split of splits) {
      const trimmedPiece = split.trim();
      if (!trimmedPiece) continue;

      const pieceLen = trimmedPiece.length;
      const extraLen = currentDoc.length > 0 ? separator.length : 0;

      if (total + extraLen + pieceLen > chunkSize && currentDoc.length > 0) {
        const merged = currentDoc.join(separator).trim();
        if (merged) {
          docs.push(merged);
        }

        // Lùi lại các phần tử cuối để tạo overlap
        while (
          total > chunkOverlap ||
          (total + extraLen + pieceLen > chunkSize && total > 0)
        ) {
          const removed = currentDoc.shift();
          if (removed) {
            total -= removed.length + (currentDoc.length > 0 ? separator.length : 0);
          } else {
            break;
          }
        }
      }

      currentDoc.push(trimmedPiece);
      total += pieceLen + (currentDoc.length > 1 ? separator.length : 0);
    }

    if (currentDoc.length > 0) {
      const remaining = currentDoc.join(separator).trim();
      if (remaining && (docs.length === 0 || docs[docs.length - 1] !== remaining)) {
        docs.push(remaining);
      }
    }

    return docs;
  }
}
