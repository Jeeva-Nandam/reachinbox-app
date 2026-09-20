import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../ui/Modal";
import { Input, Textarea, Select } from "../ui/Input";
import { Button } from "../ui/Button";
import { CsvUploader } from "./CsvUploader";
import { ScheduleForm, ScheduleFormValues } from "./ScheduleForm";
import { useSenders, useCreateSender } from "../../hooks/useSenders";
import { scheduleEmails } from "../../api/emails.api";
import { CsvParsePreview } from "../../utils/csv";
import { useToast } from "../../context/ToastContext";
import { defaultScheduleStart } from "../../utils/format";
import { ApiError } from "../../api/client";

interface ComposeEmailProps {
  isOpen: boolean;
  onClose: () => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ComposeEmail({ isOpen, onClose }: ComposeEmailProps) {
  const { data: senders, isLoading: sendersLoading } = useSenders();
  const createSenderMutation = useCreateSender();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [senderId, setSenderId] = useState("");
  const [manualRecipientInput, setManualRecipientInput] = useState("");
  const [manualRecipients, setManualRecipients] = useState<string[]>([]);
  const [csvPreview, setCsvPreview] = useState<CsvParsePreview | null>(null);
  const [schedule, setSchedule] = useState<ScheduleFormValues>({
    startTime: defaultScheduleStart(),
    delayBetweenEmailsSeconds: 2,
    hourlyLimit: 100,
  });
  const [showAddSender, setShowAddSender] = useState(false);
  const [newSender, setNewSender] = useState({ email: "", displayName: "", smtpUser: "", smtpPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const recipients = useMemo(() => {
    const combined = [...manualRecipients, ...(csvPreview?.valid ?? [])];
    return Array.from(new Set(combined.map((r) => r.trim().toLowerCase()))).map(
      (norm) => combined.find((r) => r.trim().toLowerCase() === norm)!
    );
  }, [manualRecipients, csvPreview]);

  const scheduleMutation = useMutation({
    mutationFn: scheduleEmails,
    onSuccess: (result) => {
      showToast(`✓ ${result.created.length} email${result.created.length === 1 ? "" : "s"} scheduled successfully.`, "success");
      queryClient.invalidateQueries({ queryKey: ["emails", "scheduled"] });
      resetAndClose();
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : "Unable to schedule emails. Please try again.";
      showToast(message, "error");
    },
  });

  function resetAndClose() {
    setSubject("");
    setBody("");
    setSenderId("");
    setManualRecipientInput("");
    setManualRecipients([]);
    setCsvPreview(null);
    setSchedule({ startTime: defaultScheduleStart(), delayBetweenEmailsSeconds: 2, hourlyLimit: 100 });
    setErrors({});
    onClose();
  }

  function addManualRecipient() {
    const value = manualRecipientInput.trim().replace(/,$/, "");
    if (!value) return;
    if (!EMAIL_REGEX.test(value)) {
      setErrors((e) => ({ ...e, manualRecipient: `"${value}" is not a valid email address` }));
      return;
    }
    setManualRecipients((prev) => (prev.includes(value) ? prev : [...prev, value]));
    setManualRecipientInput("");
    setErrors((e) => ({ ...e, manualRecipient: "" }));
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!subject.trim()) next.subject = "Subject is required";
    if (!body.trim()) next.body = "Body is required";
    if (!senderId) next.senderId = "Select a sender";
    if (recipients.length === 0) next.recipients = "Add at least one recipient (manually or via CSV)";
    if (!schedule.startTime) next.startTime = "Start time is required";
    else if (new Date(schedule.startTime).getTime() < Date.now() - 60_000) {
      next.startTime = "Start time cannot be in the past";
    }
    if (schedule.delayBetweenEmailsSeconds < 0) next.delayBetweenEmailsSeconds = "Delay must be 0 or greater";
    if (schedule.hourlyLimit <= 0) next.hourlyLimit = "Hourly limit must be greater than 0";

    setErrors(next);
    return Object.keys(next).filter((k) => next[k]).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    await scheduleMutation.mutateAsync({
      subject,
      body,
      senderId,
      recipients,
      startTime: new Date(schedule.startTime).toISOString(),
      delayBetweenEmailsMs: schedule.delayBetweenEmailsSeconds * 1000,
      hourlyLimit: schedule.hourlyLimit,
    });
  }

  async function handleCreateSender() {
    if (!newSender.email || !newSender.displayName || !newSender.smtpUser || !newSender.smtpPassword) return;
    const created = await createSenderMutation.mutateAsync(newSender);
    setSenderId(created.id);
    setShowAddSender(false);
    setNewSender({ email: "", displayName: "", smtpUser: "", smtpPassword: "" });
  }

  return (
    <Modal isOpen={isOpen} onClose={resetAndClose} title="Compose New Email" size="lg">
      <div className="space-y-5">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">From</label>
          {sendersLoading ? (
            <p className="text-sm text-gray-400">Loading senders…</p>
          ) : senders && senders.length > 0 ? (
            <Select value={senderId} error={errors.senderId} onChange={(e) => setSenderId(e.target.value)}>
              <option value="">Select a sender…</option>
              {senders.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.displayName} ({s.email})
                </option>
              ))}
            </Select>
          ) : (
            <p className="text-sm text-gray-500">
              No senders yet.{" "}
              <button type="button" className="font-medium text-brand-600 hover:underline" onClick={() => setShowAddSender(true)}>
                Add one
              </button>
            </p>
          )}

          {showAddSender && (
            <div className="mt-3 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs text-gray-500">
                Use credentials from{" "}
                <a href="https://ethereal.email/create" target="_blank" rel="noreferrer" className="underline">
                  ethereal.email
                </a>
                .
              </p>
              <Input
                placeholder="Sender email (e.g. from Ethereal)"
                value={newSender.email}
                onChange={(e) => setNewSender((s) => ({ ...s, email: e.target.value, smtpUser: e.target.value }))}
              />
              <Input
                placeholder="Display name"
                value={newSender.displayName}
                onChange={(e) => setNewSender((s) => ({ ...s, displayName: e.target.value }))}
              />
              <Input
                placeholder="SMTP password"
                type="password"
                value={newSender.smtpPassword}
                onChange={(e) => setNewSender((s) => ({ ...s, smtpPassword: e.target.value }))}
              />
              <div className="flex gap-2">
                <Button size="sm" isLoading={createSenderMutation.isPending} onClick={handleCreateSender}>
                  Save sender
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAddSender(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        <Input label="Subject" value={subject} error={errors.subject} onChange={(e) => setSubject(e.target.value)} />

        <Textarea
          label="Body"
          rows={6}
          value={body}
          error={errors.body}
          onChange={(e) => setBody(e.target.value)}
        />

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">To</label>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-300 p-2">
            {manualRecipients.map((r) => (
              <span
                key={r}
                className="flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700"
              >
                {r}
                <button
                  type="button"
                  aria-label={`Remove ${r}`}
                  onClick={() => setManualRecipients((prev) => prev.filter((x) => x !== r))}
                  className="text-brand-500 hover:text-brand-800"
                >
                  ×
                </button>
              </span>
            ))}
            <input
              className="min-w-[160px] flex-1 border-none py-1 text-sm focus:outline-none focus:ring-0"
              placeholder="Type an email and press Enter"
              value={manualRecipientInput}
              onChange={(e) => setManualRecipientInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addManualRecipient();
                }
              }}
              onBlur={addManualRecipient}
            />
          </div>
          {errors.manualRecipient && <p className="mt-1 text-xs text-red-600">{errors.manualRecipient}</p>}
          {errors.recipients && <p className="mt-1 text-xs text-red-600">{errors.recipients}</p>}
        </div>

        <CsvUploader onFileSelected={(_file, preview) => setCsvPreview(preview)} />

        {recipients.length > 0 && (
          <p className="text-sm font-medium text-gray-700">
            {recipients.length} total recipient{recipients.length === 1 ? "" : "s"}
          </p>
        )}

        <ScheduleForm values={schedule} onChange={setSchedule} errors={errors} />

        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
          <Button variant="secondary" onClick={resetAndClose}>
            Cancel
          </Button>
          <Button isLoading={scheduleMutation.isPending} onClick={handleSubmit}>
            Schedule
          </Button>
        </div>
      </div>
    </Modal>
  );
}
