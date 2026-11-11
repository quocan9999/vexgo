'use client';

import { useEffect, useState } from 'react';
import {
  AlertCircle,
  HelpCircle,
  Info,
  Loader2,
  Save,
  Sliders,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/action-button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  getAiSettings,
  updateAiSettings,
  type AiChatbotSettings,
} from '../services/ai-knowledge-service';

interface AiSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SettingInfoDetail {
  title: string;
  badge: string;
  description: string;
  example: string;
  recommendation: string;
}

const SETTING_INFO_DICTIONARY: Record<string, SettingInfoDetail> = {
  idempotencyTtlDays: {
    title: 'Thời gian lưu vết yêu cầu (Idempotency TTL)',
    badge: '1 – 90 ngày',
    description:
      'Khoảng thời gian máy chủ ghi nhớ một yêu cầu đã được xử lý để chống việc gửi trùng lặp câu hỏi khi thiết bị của khách hàng bị chập chờn kết nối mạng hoặc timeout.',
    example:
      'Khách hàng gửi "Tìm xe đi Đà Lạt", mạng 4G bị ngắt trước khi nhận câu trả lời. Hai phút sau khi có mạng, ứng dụng tự động gửi lại yêu cầu: Hệ thống nhận diện mã yêu cầu cũ và trả về ngay kết quả đã lưu trong 0.01 giây, không gọi lại mô hình AI (Groq LLM) và không bị nhân đôi tin nhắn trong khung chat.',
    recommendation: 'Khuyến nghị: 7 ngày (đủ để đối soát và tự động dọn dẹp bộ nhớ đệm).',
  },
  leaseDurationSeconds: {
    title: 'Thời hạn khóa xử lý (Lease Duration / Crash Window)',
    badge: '10 – 300 giây',
    description:
      'Thời gian máy chủ tạm thời khóa độc quyền một yêu cầu đang trong tiến trình xử lý, ngăn chặn việc nhiều luồng/máy chủ cùng gọi AI song song, đồng thời tự động mở khóa nếu máy chủ bị mất điện hoặc restart đột ngột.',
    example:
      'Nếu khách hàng sốt ruột bấm nút Gửi 5 lần liên tiếp trong 2 giây, các lần bấm sau sẽ bị chặn lại vì yêu cầu đầu tiên đang giữ khóa. Trường hợp máy chủ bị sập giữa chừng, sau đúng thời hạn này khóa sẽ hết hiệu lực, cho phép lượt gửi tiếp theo được nhận lại và xử lý bình thường mà không bị kẹt vĩnh viễn ở trạng thái "Đang xử lý".',
    recommendation: 'Khuyến nghị: 60 giây (đủ thời gian cho các câu truy vấn RAG phức tạp).',
  },
  contextHistoryLimit: {
    title: 'Số tin nhắn ngữ cảnh lịch sử (Context History Limit)',
    badge: '0 – 50 tin nhắn',
    description:
      'Số lượng tin nhắn gần nhất trong phiên hội thoại được đưa vào đầu vào cho mô hình AI đọc, giúp AI có "trí nhớ" để thấu hiểu các câu hỏi nối tiếp của khách hàng.',
    example:
      'Tin 1: "Tìm xe từ Sài Gòn đi Nha Trang ngày mai." -> Tin 2: "Có chuyến tối không?". Nếu có nạp lịch sử, AI đọc lại tin 1 và hiểu ngay "chuyến tối" là chuyến đi Nha Trang ngày mai. Nếu đặt là 0, AI sẽ mất trí nhớ và phải hỏi lại khách.',
    recommendation: 'Khuyến nghị: 10 tin nhắn gần nhất (vừa đủ nhớ ngữ cảnh, vừa phản hồi nhanh và tiết kiệm chi phí token).',
  },
  temperature: {
    title: 'Nhiệt độ sinh phản hồi của AI (LLM Temperature)',
    badge: '0.0 – 1.0',
    description:
      'Thước đo mức độ "sáng tạo bay bổng" so với "chính xác kỷ luật" của mô hình ngôn ngữ lớn. Giá trị càng thấp, câu trả lời càng nghiêm túc, tuân thủ tuyệt đối quy định và tránh bịa đặt thông tin (hallucination).',
    example:
      'Với mức 0.15: AI trích xuất chính xác theo điều khoản "Trẻ em dưới 5 tuổi được miễn vé". Nếu đặt mức cao (như 0.8), AI có thể tự sáng tác thêm "Trẻ 6-7 tuổi nếu ngoan ngoãn cũng được linh động miễn vé", dẫn đến sai lệch chính sách nhà xe.',
    recommendation: 'Khuyến nghị: 0.15 (chuẩn VexGo đảm bảo tính chính xác và an toàn nghiệp vụ cao nhất).',
  },
};

export function AiSettingsDialog({ open, onOpenChange }: AiSettingsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [idempotencyTtlDays, setIdempotencyTtlDays] = useState(7);
  const [leaseDurationSeconds, setLeaseDurationSeconds] = useState(60);
  const [contextHistoryLimit, setContextHistoryLimit] = useState(10);
  const [temperature, setTemperature] = useState(0.15);

  // State cho Info dialog giải thích chi tiết
  const [infoKey, setInfoKey] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let isCancelled = false;

    async function fetchSettings() {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await getAiSettings();
        if (!isCancelled) {
          setIdempotencyTtlDays(data.idempotencyTtlDays);
          setLeaseDurationSeconds(data.leaseDurationSeconds);
          setContextHistoryLimit(data.contextHistoryLimit);
          setTemperature(data.temperature);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          const msg =
            err instanceof Error ? err.message : 'Không thể tải cấu hình AI.';
          setLoadError(msg);
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    void fetchSettings();
    return () => {
      isCancelled = true;
    };
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateAiSettings({
        idempotencyTtlDays: Number(idempotencyTtlDays),
        leaseDurationSeconds: Number(leaseDurationSeconds),
        contextHistoryLimit: Number(contextHistoryLimit),
        temperature: Number(temperature),
      });
      toast.success('Cập nhật cấu hình hệ thống AI thành công!');
      onOpenChange(false);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Cập nhật cấu hình thất bại.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const currentInfo = infoKey ? SETTING_INFO_DICTIONARY[infoKey] : null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <Sliders className="w-5 h-5 text-primary" />
              Cấu hình tham số hệ thống Trợ lý ảo AI
            </DialogTitle>
            <DialogDescription>
              Tinh chỉnh các tham số vận hành cho mô hình AI, bộ nhớ ngữ cảnh và cơ chế chống gửi trùng lặp.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Đang tải cấu hình AI...</p>
            </div>
          ) : loadError ? (
            <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-lg">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <p>{loadError}</p>
            </div>
          ) : (
            <form id="ai-settings-form" onSubmit={handleSubmit} className="space-y-4 py-2">
              {/* 1. Idempotency TTL */}
              <Field>
                <div className="flex items-center justify-between mb-1">
                  <FieldLabel htmlFor="idempotencyTtlDays" className="flex items-center gap-1.5 font-medium text-sm">
                    Thời gian lưu vết yêu cầu (Idempotency TTL)
                    <button
                      type="button"
                      aria-label="Thông tin Idempotency TTL"
                      onClick={() => setInfoKey('idempotencyTtlDays')}
                      className="text-muted-foreground hover:text-primary transition-colors focus:outline-none"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </FieldLabel>
                  <span className="text-xs text-muted-foreground">Đơn vị: Ngày</span>
                </div>
                <Input
                  id="idempotencyTtlDays"
                  type="number"
                  min={1}
                  max={90}
                  required
                  value={idempotencyTtlDays}
                  onChange={(e) => setIdempotencyTtlDays(Number(e.target.value))}
                  placeholder="Ví dụ: 7"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Thời hạn lưu kết quả đệm để chống gửi trùng khi mất mạng (từ 1 đến 90 ngày).
                </p>
              </Field>

              {/* 2. Lease Duration */}
              <Field>
                <div className="flex items-center justify-between mb-1">
                  <FieldLabel htmlFor="leaseDurationSeconds" className="flex items-center gap-1.5 font-medium text-sm">
                    Thời hạn khóa xử lý (Lease Duration)
                    <button
                      type="button"
                      aria-label="Thông tin Thời hạn khóa xử lý"
                      onClick={() => setInfoKey('leaseDurationSeconds')}
                      className="text-muted-foreground hover:text-primary transition-colors focus:outline-none"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </FieldLabel>
                  <span className="text-xs text-muted-foreground">Đơn vị: Giây</span>
                </div>
                <Input
                  id="leaseDurationSeconds"
                  type="number"
                  min={10}
                  max={300}
                  required
                  value={leaseDurationSeconds}
                  onChange={(e) => setLeaseDurationSeconds(Number(e.target.value))}
                  placeholder="Ví dụ: 60"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Thời hạn giữ khóa tránh tranh chấp luồng và tự giải phóng khi máy chủ gặp sự cố (10 đến 300 giây).
                </p>
              </Field>

              {/* 3. Context History Limit */}
              <Field>
                <div className="flex items-center justify-between mb-1">
                  <FieldLabel htmlFor="contextHistoryLimit" className="flex items-center gap-1.5 font-medium text-sm">
                    Số tin nhắn ngữ cảnh lịch sử
                    <button
                      type="button"
                      aria-label="Thông tin Số tin nhắn ngữ cảnh"
                      onClick={() => setInfoKey('contextHistoryLimit')}
                      className="text-muted-foreground hover:text-primary transition-colors focus:outline-none"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </FieldLabel>
                  <span className="text-xs text-muted-foreground">Đơn vị: Tin nhắn</span>
                </div>
                <Input
                  id="contextHistoryLimit"
                  type="number"
                  min={0}
                  max={50}
                  required
                  value={contextHistoryLimit}
                  onChange={(e) => setContextHistoryLimit(Number(e.target.value))}
                  placeholder="Ví dụ: 10"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Số tin nhắn gần nhất nạp vào LLM để hiểu câu hỏi nối tiếp (từ 0 đến 50 tin nhắn).
                </p>
              </Field>

              {/* 4. Temperature */}
              <Field>
                <div className="flex items-center justify-between mb-1">
                  <FieldLabel htmlFor="temperature" className="flex items-center gap-1.5 font-medium text-sm">
                    Nhiệt độ sinh phản hồi (LLM Temperature)
                    <button
                      type="button"
                      aria-label="Thông tin Nhiệt độ sinh phản hồi"
                      onClick={() => setInfoKey('temperature')}
                      className="text-muted-foreground hover:text-primary transition-colors focus:outline-none"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </FieldLabel>
                  <span className="text-xs text-muted-foreground">Thang đo: 0.0 – 1.0</span>
                </div>
                <Input
                  id="temperature"
                  type="number"
                  step="0.01"
                  min={0.0}
                  max={1.0}
                  required
                  value={temperature}
                  onChange={(e) => setTemperature(Number(e.target.value))}
                  placeholder="Ví dụ: 0.15"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Mức độ sáng tạo vs chính xác của AI. Giá trị thấp (0.15) giúp câu trả lời chuẩn quy chế, tránh bịa đặt.
                </p>
              </Field>
            </form>
          )}

          <DialogFooter className="mt-4 gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              form="ai-settings-form"
              disabled={loading || saving}
              className="gap-1.5"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang lưu...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Lưu cấu hình
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Info Dialog Giải thích chi tiết theo yêu cầu người dùng */}
      <Dialog open={Boolean(infoKey)} onOpenChange={(open) => !open && setInfoKey(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <HelpCircle className="w-5 h-5 text-primary flex-shrink-0" />
              {currentInfo?.title}
            </DialogTitle>
            <DialogDescription className="inline-block">
              <span className="inline-block px-2 py-0.5 mt-1 text-xs font-medium rounded-full bg-primary/10 text-primary">
                Phạm vi: {currentInfo?.badge}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-sm">
            <div>
              <h4 className="font-medium text-foreground mb-1">Mục đích và ý nghĩa:</h4>
              <p className="text-muted-foreground leading-relaxed">{currentInfo?.description}</p>
            </div>

            <div className="p-3 bg-muted/60 rounded-lg border border-border/50">
              <h4 className="font-medium text-foreground mb-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                Ví dụ thực tế:
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">{currentInfo?.example}</p>
            </div>

            <p className="text-xs text-primary font-medium">{currentInfo?.recommendation}</p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => setInfoKey(null)}
            >
              Đã hiểu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
