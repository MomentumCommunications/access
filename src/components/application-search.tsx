import { useConvexQuery } from "@convex-dev/react-query";
import { useNavigate } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import {
  BookOpen,
  GraduationCap,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";

type SearchResult = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

export function ApplicationSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 150);

    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.key.toLowerCase() === "k" &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const results = useConvexQuery(
    api.classes.searchApplication,
    open && debouncedSearch
      ? {
          search: debouncedSearch,
        }
      : "skip",
  );

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSearch("");
      setDebouncedSearch("");
    }
  }

  async function openResult(result: SearchResult) {
    handleOpenChange(false);
    await navigate({ to: result.href as never });
  }

  const hasSearch = search.trim().length > 0;
  const isSearching =
    hasSearch &&
    (search.trim() !== debouncedSearch || results === undefined);
  const hasResults =
    results &&
    (results.accounts.length > 0 ||
      results.students.length > 0 ||
      results.classes.length > 0);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 cursor-pointer gap-2 px-2 sm:px-3"
        onClick={() => setOpen(true)}
        aria-label="Search application"
        title="Search (Control K or Command K)"
      >
        <Search />
        <span className="hidden sm:inline">Search</span>
        <kbd className="bg-muted text-muted-foreground pointer-events-none hidden rounded border px-1.5 py-0.5 font-sans text-[10px] md:inline">
          ⌘K
        </kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={handleOpenChange}
        title="Search application"
        description="Search accounts, students, and classes available to you."
        showCloseButton={false}
        shouldFilter={false}
        className="flex max-w-none gap-0"
        commandClassName="min-h-0"
        contentStyle={{
          width: "min(32rem, calc(100vw - 2rem))",
          maxWidth: "none",
          height: "min(28rem, calc(100vh - 2rem))",
        }}
      >
        <CommandInput
          className="min-w-0"
          value={search}
          onValueChange={setSearch}
          placeholder="Search accounts, students, and classes..."
        />
        <CommandList className="min-h-0 max-h-none flex-1">
          <CommandEmpty>
            {!hasSearch
              ? "Start typing to search."
              : isSearching
                ? "Searching..."
                : "No results found."}
          </CommandEmpty>

          {hasResults && results.accounts.length > 0 ? (
            <SearchResultGroup
              heading="Accounts"
              icon={ShieldCheck}
              results={results.accounts}
              onSelect={openResult}
            />
          ) : null}
          {hasResults && results.students.length > 0 ? (
            <SearchResultGroup
              heading="Students"
              icon={GraduationCap}
              results={results.students}
              onSelect={openResult}
            />
          ) : null}
          {hasResults && results.classes.length > 0 ? (
            <SearchResultGroup
              heading="Classes"
              icon={BookOpen}
              results={results.classes}
              onSelect={openResult}
            />
          ) : null}
        </CommandList>
      </CommandDialog>
    </>
  );
}

function SearchResultGroup({
  heading,
  icon: Icon,
  results,
  onSelect,
}: {
  heading: string;
  icon: typeof Search;
  results: SearchResult[];
  onSelect: (result: SearchResult) => void;
}) {
  return (
    <CommandGroup heading={heading}>
      {results.map((result) => (
        <CommandItem
          key={result.id}
          value={`${heading}-${result.id}`}
          onSelect={() => onSelect(result)}
        >
          <Icon className="size-4" />
          <div className="min-w-0">
            <p className="truncate font-medium">{result.title}</p>
            {result.subtitle ? (
              <p className="text-muted-foreground truncate text-xs">
                {result.subtitle}
              </p>
            ) : null}
          </div>
        </CommandItem>
      ))}
    </CommandGroup>
  );
}
