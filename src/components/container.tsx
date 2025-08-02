export function Container({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 w-full lg:px-8">
      {children}
    </div>
  );
}
