import { ArrowDown } from "lucide-react";

export function BottomScroll({
  bottomRef,
}: {
  bottomRef: React.RefObject<HTMLDivElement> | undefined;
}) {
  if (!bottomRef) return null;
  return (
    <button
      onClick={() => bottomRef.current?.scrollIntoView()}
      className="bg-slate-900 hover:bg-slate-800 animate-[bounce_3s] duration-300 p-2 aspect-square rounded-full absolute bottom-28 right-4"
    >
      <ArrowDown color="white" />
    </button>
  );
}
