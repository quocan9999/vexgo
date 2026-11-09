import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { register } from 'node:module';

// Register ESM ts-loader for resolving @/... paths and transpiling .tsx
register('../../helpers/ts-loader.mjs', import.meta.url);

import React from 'react';
import { renderToString } from 'react-dom/server';

const { SupportChatMessageText } = await import(
  '@/features/support-chat/components/customer-support-chat'
);

describe('SupportChatMessageText Unit Tests', () => {
  it('returns plain text unchanged when there is no bold markdown', () => {
    const raw = 'Xin chào, tôi cần hỗ trợ đổi chuyến xe';
    const rendered = renderToString(
      React.createElement(SupportChatMessageText, { content: raw })
    );
    assert.equal(rendered, 'Xin chào, tôi cần hỗ trợ đổi chuyến xe');
  });

  it('renders bold markdown **text** with strong tag and font-semibold for incoming message', () => {
    const raw = 'Có **5 chuyến** xe từ TP.HCM đi Đà Lạt';
    const rendered = renderToString(
      React.createElement(SupportChatMessageText, { content: raw, isMe: false })
    );
    assert.match(
      rendered,
      /<strong class="font-semibold text-slate-900">5 chuyến<\/strong>/
    );
    assert.match(rendered, /Có /);
    assert.match(rendered, / xe từ TP\.HCM đi Đà Lạt/);
  });

  it('renders bold markdown **text** with font-bold text-white for outgoing message', () => {
    const raw = 'Thời gian giữ chỗ là **10 phút**';
    const rendered = renderToString(
      React.createElement(SupportChatMessageText, { content: raw, isMe: true })
    );
    assert.match(
      rendered,
      /<strong class="font-bold text-white">10 phút<\/strong>/
    );
  });

  it('handles multiline transcripts with newlines preserved', () => {
    const raw = `[Khách hàng]:\nTìm xe đi Đà Lạt\n\n[Trợ lý AI]:\nCó **3 chuyến** phù hợp:\n- **Thành Bưởi** 06:00`;
    const rendered = renderToString(
      React.createElement(SupportChatMessageText, { content: raw, isMe: false })
    );
    assert.match(rendered, /\[Khách hàng\]:\nTìm xe đi Đà Lạt/);
    assert.match(
      rendered,
      /<strong class="font-semibold text-slate-900">3 chuyến<\/strong>/
    );
    assert.match(
      rendered,
      /<strong class="font-semibold text-slate-900">Thành Bưởi<\/strong>/
    );
  });

  it('returns null when content is empty', () => {
    const rendered = renderToString(
      React.createElement(SupportChatMessageText, { content: '' })
    );
    assert.equal(rendered, '');
  });
});
