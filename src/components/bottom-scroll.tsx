import { ArrowDown } from "lucide-react";

export function BottomScroll({
  bottomRef,
}: {
  bottomRef: React.RefObject<HTMLDivElement> | null;
}) {
  if (bottomRef === null) return;
  return (
    <button
      onClick={() => bottomRef.current?.scrollIntoView()}
      className="bg-muted hover:bg-slate-800 duration-300 p-2 aspect-square rounded-full absolute bottom-8 right-4"
    >
      <ArrowDown />
    </button>
  );
}
