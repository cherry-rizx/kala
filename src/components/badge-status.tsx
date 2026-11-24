import { labelStatus, warnaStatus } from "@/lib/booking/status";

export default function BadgeStatus({ status }: { status: string }) {
  return (
    <span className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ${warnaStatus(status)}`}>
      {labelStatus(status)}
    </span>
  );
}
