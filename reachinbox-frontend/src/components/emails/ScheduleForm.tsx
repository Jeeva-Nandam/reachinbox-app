import { Input } from "../ui/Input";

export interface ScheduleFormValues {
  startTime: string; // datetime-local value
  delayBetweenEmailsSeconds: number;
  hourlyLimit: number;
}

interface ScheduleFormProps {
  values: ScheduleFormValues;
  onChange: (values: ScheduleFormValues) => void;
  errors: Partial<Record<keyof ScheduleFormValues, string>>;
}

export function ScheduleForm({ values, onChange, errors }: ScheduleFormProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Input
        label="Start time"
        type="datetime-local"
        value={values.startTime}
        error={errors.startTime}
        onChange={(e) => onChange({ ...values, startTime: e.target.value })}
      />
      <Input
        label="Delay between emails"
        type="number"
        min={0}
        step={1}
        value={values.delayBetweenEmailsSeconds}
        error={errors.delayBetweenEmailsSeconds}
        hint="seconds"
        onChange={(e) => onChange({ ...values, delayBetweenEmailsSeconds: Number(e.target.value) })}
      />
      <Input
        label="Hourly limit"
        type="number"
        min={1}
        step={1}
        value={values.hourlyLimit}
        error={errors.hourlyLimit}
        hint="emails/hour"
        onChange={(e) => onChange({ ...values, hourlyLimit: Number(e.target.value) })}
      />
    </div>
  );
}
